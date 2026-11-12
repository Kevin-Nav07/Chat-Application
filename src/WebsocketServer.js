const { WebSocketServer, WebSocket } = require('ws');
const WebsocketManager = require('./WebsocketManager');
const { verifyJWT } = require('./helpers/UserAuthenticator');
const { parseCookies } = require('./helpers/Parsers');
const APIResponseObj = require('./Models/APIResponseObj');
const ServiceContext = require('./ServiceContext');

const MAX_CONTENT_LENGTH = 4000; // longest message, in characters, after trimming
const MAX_CLIENT_MESSAGE_ID_LENGTH = 100; // the browser generates a UUID (36 characters), this leaves generous room

// Sends a JSON object to one socket, skipping sockets that are no longer open so a late reply never throws
function sendJson(ws, payload) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
    }
}

// Sends a message:error to the sender only, in the format agreed in PLAN.md
function sendMessageError(ws, room_id, client_message_id, code, error) {
    sendJson(ws, { type: "message:error", room_id: room_id ?? null, client_message_id: client_message_id ?? null, code, error });
}

// Writes a plain HTTP error onto the raw socket during the upgrade handshake, before it has become a websocket
function rejectUpgrade(socket, statusCode, statusText, body) {
    if (!socket.writable) {
        return;
    }
    socket.write(
        `HTTP/1.1 ${statusCode} ${statusText}\r\n` +
        'Content-Type: text/plain\r\n' +
        'Connection: close\r\n' +
        `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n` +
        body
    );
    socket.destroy(); // frees the TCP connection
}

// Configures and mounts the WebSocket server with authentication, persistence, and Redis pub/sub
function createWebSocketServer(server, DbPool, redisConnector) {
    // noServer mode lets the upgrade request be authenticated before it becomes a websocket
    const wss = new WebSocketServer({ noServer: true });
    const socketManager = new WebsocketManager(redisConnector);

    // Checks the access token cookie on the HTTP upgrade request, then upgrades the connection only if it is valid
    server.on('upgrade', async function upgrade(request, socket, head) {
        try {
            const result = await verifyJWT(parseCookies(request));
            if (result instanceof APIResponseObj) { // verification failed, result holds the 401 or 500 to send back
                rejectUpgrade(socket, result.responseStatusCode, result.responseTitle ?? "Unauthorized", String(result.responseBody));
                return;
            }
            const user_id = result?.user_id;
            if (user_id == null || !Number.isFinite(user_id)) {
                rejectUpgrade(socket, 401, "Unauthorized", "No valid user id in token");
                return;
            }
            wss.handleUpgrade(request, socket, head, function done(ws) {
                ws.user_id = user_id; // every later handler trusts this id, it came from the verified token
                wss.emit("connection", ws);
            });
        } catch (error) {
            console.error('[WebSocket Upgrade Error]:', error);
            rejectUpgrade(socket, 500, "Internal Server Error", "Unexpected error during upgrade request");
        }
    });

    // Loads the ids of every room the user belongs to and joins this socket to them.
    // Every room is loaded, not only the first 50, so sending in an older room works too
    async function joinUserRooms(ws) {
        const serviceContext = await ServiceContext.create(DbPool);
        let roomIds;
        try {
            const roomService = serviceContext.createRoomService();
            roomIds = await serviceContext.callServiceMethod(roomService, (service) => service.getRoomIdsForUserAsync(ws.user_id));
        } finally {
            await serviceContext.close(); // always gives the database client back to the pool
        }
        await socketManager.joinRooms(ws, roomIds ?? []); // skips the work if the socket closed during the query above
    }

    // Validates one incoming client message, saves it, then publishes it so every member's socket receives it
    async function handleClientMessage(ws, data) {
        let payload;
        try {
            payload = JSON.parse(data.toString("utf-8"));
        } catch {
            sendMessageError(ws, null, null, "INVALID_MESSAGE", "Payload must be valid JSON");
            return;
        }

        const room_id = payload?.room_id;
        const rawClientId = payload?.client_message_id;
        // the id is only echoed back so the browser can match the reply to what it sent, so anything unusual is dropped rather than rejected
        const client_message_id = typeof rawClientId === "string" && rawClientId.length <= MAX_CLIENT_MESSAGE_ID_LENGTH ? rawClientId : null;
        const content = payload?.content;

        if (payload?.type !== "message:send") {
            sendMessageError(ws, room_id, client_message_id, "INVALID_MESSAGE", "Unknown message type");
            return;
        }
        if (!Number.isInteger(room_id) || typeof content !== "string") {
            sendMessageError(ws, room_id, client_message_id, "INVALID_MESSAGE", "room_id and a content string are required");
            return;
        }
        const trimmedContent = content.trim();
        if (trimmedContent.length < 1 || trimmedContent.length > MAX_CONTENT_LENGTH) {
            sendMessageError(ws, room_id, client_message_id, "INVALID_MESSAGE", `Message must be between 1 and ${MAX_CONTENT_LENGTH} characters`);
            return;
        }

        try {
            // saveMessageAsync checks membership in the database, which is the source of truth. There is no separate
            // in-memory membership check any more: that copy could be out of date, for example for a room created after the socket connected
            const serviceContext = await ServiceContext.create(DbPool);
            let savedMessage;
            try {
                const messageService = serviceContext.createMessageService();
                savedMessage = await serviceContext.callServiceMethod(messageService, (service) =>
                    service.saveMessageAsync(room_id, ws.user_id, trimmedContent));
            } finally {
                await serviceContext.close();
            }

            // the database just confirmed this user is a member, so make sure this socket is in the room.
            // normally it already is; this repairs the case where a room:new event was missed, so the sender still gets their own message
            await socketManager.joinRoom(ws, room_id);

            await socketManager.publishRoomMessage(room_id, { type: "message:new", client_message_id, message: savedMessage }, ws.user_id);
        } catch (error) {
            console.error("Error saving or publishing message:", error);
            const code = error.statusCode === 403 ? "NOT_A_MEMBER" : error.statusCode === 400 ? "INVALID_MESSAGE" : "SERVER_ERROR";
            // HttpError messages are written for users, anything else is internal and replaced with a generic message
            const message = error.statusCode != null ? error.message : "Failed to send message";
            sendMessageError(ws, room_id, client_message_id, code, message);
        }
    }

    // Sets up one newly connected socket
    wss.on('connection', (ws) => {
        // Heartbeat: the interval below pings every socket, and a socket that did not answer the previous ping is closed
        ws.isAlive = true;
        ws.on("pong", () => {
            ws.isAlive = true;
        });

        // Registered synchronously, before anything awaits, so a socket that closes during setup is always cleaned up
        socketManager.registerConnection(ws).catch((error) => {
            console.error("Failed to subscribe to the user's channel:", error); // live room:new events will not arrive, everything else still works
        });

        // 'error' is always followed by 'close', and removeConnection is safe to call twice
        const cleanUp = () => {
            socketManager.removeConnection(ws).catch((error) => console.error("Error cleaning up closed socket:", error));
        };
        ws.on('close', cleanUp);
        ws.on('error', (error) => {
            console.error("WebSocket error:", error);
            cleanUp();
        });

        // Resolves to true once the socket has joined its rooms, or false if that failed.
        // It never rejects, because a rejected promise that nobody awaits crashes Node
        const ready = joinUserRooms(ws).then(
            () => true,
            (error) => {
                console.error("Failed to load rooms for new socket:", error);
                ws.close(1011, "Could not load rooms"); // 1011 means a server error; the client reconnects and tries again
                return false;
            }
        );

        // Attached immediately so messages sent during setup are not lost. Each one waits for setup to finish,
        // so it is never handled against a half loaded room list. Waiting handlers run in the order they arrived
        ws.on('message', async (data) => {
            try {
                if (!(await ready)) {
                    return;
                }
                await handleClientMessage(ws, data);
            } catch (error) {
                console.error("Unexpected error handling websocket message:", error);
            }
        });
    });

    wss.on('error', (error) => {
        console.error("Encountered error with WebSocket server:", error);
    });

    // Every 30 seconds, close sockets that did not answer the last ping, then ping the rest
    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (!ws.isAlive) {
                return ws.terminate();
            }
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);

    wss.on('close', () => {
        clearInterval(interval); // prevents a timer leak if the server is ever closed
    });
}

module.exports = createWebSocketServer;
