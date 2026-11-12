const { WebSocketServer } = require('ws');
const WebsocketManager = require('./WebsocketManager');
// const { unpack, pack } = require('msgpackr'); // msgpack commented out in favor of JSON-only messaging
const { verifyJWT } = require('./helpers/UserAuthenticator');
const { parseCookies } = require('./helpers/Parsers');
const APIResponseObj = require('./Models/APIResponseObj');
const ServiceContext = require('./ServiceContext');

// Configures and mounts the WebSocket server with authentication, persistence, and Redis pub/sub
function createWebSocketServer(server, DbPool, redisConnector) {
    // Uses noServer mode so the HTTP upgrade handshake can be inspected and authenticated first
    const wss = new WebSocketServer({ noServer: true }); // creates unattached WebSocket server instance
    const socketManager = new WebsocketManager(redisConnector); // manages connection maps and Redis routing
    redisConnector.display(); // logs initial redis state

    // Intercepts HTTP upgrade requests to verify JWT session cookies before upgrading the socket
    server.on('upgrade', async function upgrade(request, socket, head) {
        try {
            const cookies = parseCookies(request); // parses incoming HTTP request cookies
            console.log('[WebSocket Upgrade] Headers origin:', request.headers.origin);
            const result = await verifyJWT(cookies); // validates session token from cookie
            console.log('[WebSocket Upgrade] JWT verification result:', result);

            if (result == null) {
                throw new Error("Failed to get validation object"); // rejects if token parser returns null
            } else if (result instanceof APIResponseObj) {
                console.warn(`[WebSocket Upgrade Rejected]: ${result.responseStatusCode} ${result.responseTitle}`);
                if (socket.writable) {
                    socket.write(
                        `HTTP/1.1 ${result.responseStatusCode} ${result.responseTitle}\r\n` +
                        'Content-Type: text/plain\r\n' +
                        'Connection: close\r\n' +
                        `Content-Length: ${Buffer.byteLength(result.responseBody)}\r\n\r\n` +
                        result.responseBody
                    ); // returns HTTP 401/403 status to client
                    socket.destroy(); // terminates TCP socket to free resources
                }
            } else {
                const user_id = result?.user_id; // extracts verified user ID from JWT payload
                if (user_id == null || !Number.isFinite(user_id)) {
                    throw new Error("No valid user ID associated with token"); // rejects token with missing ID
                }

                // Upgrades the raw TCP socket to a full WebSocket stream
                wss.handleUpgrade(request, socket, head, function done(ws) {
                    ws.user_id = user_id; // stamps connection instance with authenticated user ID
                    wss.emit("connection", ws); // dispatches connection event to listeners
                });
            }
        } catch (error) {
            console.error('[WebSocket Upgrade Error]:', error); // logs failure
            if (socket.writable) {
                const responseBody = "Unexpected error during upgrade request";
                socket.write(
                    "HTTP/1.1 500 Internal Server Error\r\n" +
                    "Content-Type: text/plain\r\n" +
                    "Connection: close\r\n" +
                    `Content-Length: ${Buffer.byteLength(responseBody)}\r\n\r\n` +
                    responseBody
                ); // sends 500 status on internal exception
                socket.destroy(); // tears down socket connection
            }
        }
    });

    // Configures listeners and room memberships for each newly connected socket
    wss.on('connection', async (ws) => {
        console.log(`WebSocket client connected for user ${ws.user_id}`);

        // Marks socket as alive for heartbeat ping/pong tracking
        ws.isAlive = true;
        ws.on("pong", () => {
            ws.isAlive = true; // resets alive flag on receiving pong response
        });

        // Handles socket disconnection
        ws.on('close', async () => {
            try {
                await socketManager.deleteUser(ws?.user_id, ws); // unbinds connection from room maps
                socketManager.display();
            } catch (error) {
                console.error("Error deleting user on close event:", error); // logs disconnect error
            }
        });

        // Handles socket transmission errors
        ws.on('error', async (error) => {
            try {
                await socketManager.deleteUser(ws?.user_id, ws); // unbinds connection on error
                socketManager.display();
            } catch (err) {
                console.error("Error deleting user on error event:", err);
            }
        });

        // Message handler attached immediately so early messages are not dropped while database queries run
        ws.on('message', async (data) => {
            let parsedPayload;
            try {
                // Parses incoming data as UTF-8 JSON
                parsedPayload = JSON.parse(data.toString("utf-8")); // converts Buffer to object
            } catch (parseError) {
                console.warn("Received malformed JSON over WebSocket:", parseError);
                ws.send(JSON.stringify({
                    type: "message:error",
                    code: "INVALID_MESSAGE",
                    error: "Payload must be valid JSON"
                })); // notifies sender of parse failure
                return;
            }

            // Normalizes payload supporting both draft format { content } and legacy { message }
            const room_id = parsedPayload?.room_id; // target room identifier
            const client_message_id = parsedPayload?.client_message_id || null; // browser-generated tracking ID
            const content = parsedPayload?.content ?? parsedPayload?.message; // extracts message text

            // Validates presence and types of required fields
            if (room_id == null || !Number.isFinite(room_id) || typeof content !== 'string') {
                ws.send(JSON.stringify({
                    type: "message:error",
                    room_id: room_id || null,
                    client_message_id,
                    code: "INVALID_MESSAGE",
                    error: "room_id and non-empty content string are required"
                })); // rejects missing attributes
                return;
            }

            // Validates character length boundary
            const trimmedContent = content.trim(); // strips surrounding whitespace
            if (trimmedContent.length < 1 || trimmedContent.length > 4000) {
                ws.send(JSON.stringify({
                    type: "message:error",
                    room_id,
                    client_message_id,
                    code: "INVALID_MESSAGE",
                    error: "Message content must be between 1 and 4000 characters"
                })); // rejects empty or oversized text
                return;
            }

            // Verifies sender enrollment in the target room
            if (!socketManager.checkUserRoomMembership(ws.user_id, room_id)) {
                ws.send(JSON.stringify({
                    type: "message:error",
                    room_id,
                    client_message_id,
                    code: "NOT_A_MEMBER",
                    error: "You are not a member of this room"
                })); // rejects message to non-member room
                return;
            }

            try {
                // Persists message to PostgreSQL before broadcasting (Option A)
                const serviceContext = await ServiceContext.create(DbPool); // opens database client from pool
                let savedMessage;
                try {
                    const messageService = serviceContext.createMessageService(); // instantiates message service
                    savedMessage = await serviceContext.callServiceMethod(messageService, async (service) => {
                        return await service.saveMessageAsync(room_id, ws.user_id, trimmedContent); // executes database insert
                    });
                } finally {
                    await serviceContext.close(); // releases database client back to pool
                }

                // Prepares broadcast payload formatted according to draft message protocol
                const broadcastPayload = {
                    type: "message:new",
                    client_message_id, // echoes back sender's client ID for optimistic matching
                    message: savedMessage, // includes official ID, sender username, and server timestamp
                };

                // Publishes confirmed message through Redis to deliver to all room subscribers
                await socketManager.transmitMessageToRedis(room_id, broadcastPayload, ws);
                console.log(`Saved and broadcast message in room ${room_id} for user ${ws.user_id}`);
            } catch (error) {
                console.error("Error processing and persisting message:", error);
                ws.send(JSON.stringify({
                    type: "message:error",
                    room_id,
                    client_message_id,
                    code: error.statusCode === 403 ? "NOT_A_MEMBER" : "SERVER_ERROR",
                    error: error.message || "Failed to save message"
                })); // sends error feedback strictly to sender
            }
        });

        // Loads rooms associated with this user from the database and subscribes to their Redis channels
        const serviceContext = await ServiceContext.create(DbPool);
        let rooms = [];
        try {
            const roomService = serviceContext.createRoomService();
            rooms = await serviceContext.callServiceMethod(roomService, async (service) => {
                return await service.getRoomsPerUserAsync(ws.user_id, null, null, 50); // fetches up to 50 user rooms
            });
        } catch (err) {
            console.error("Failed to load user rooms on connection:", err);
        } finally {
            await serviceContext.close(); // guarantees client release to avoid exhausting pool
        }

        // Binds socket and user to the loaded rooms
        socketManager.addRoomsToUser(rooms, ws?.user_id); // registers room IDs in user map
        await socketManager.addConnectionToRooms(rooms, ws); // adds socket to room maps and Redis subscribers
        socketManager.display();
        await redisConnector.display();
    });

    // Error handler for the WebSocket server instance
    wss.on('error', (error) => {
        console.error("Encountered error with WebSocket server:", error);
    });

    // Heartbeat ping interval: terminates dead connections every 30 seconds
    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (!ws.isAlive) {
                return ws.terminate(); // forcefully closes socket if no pong was returned
            }
            ws.isAlive = false; // clears alive flag before issuing new ping
            ws.ping(); // sends heartbeat ping frame to client
        });
    }, 30000);

    // Clears heartbeat timer if server closes
    wss.on('close', () => {
        clearInterval(interval); // prevents timer leak on server shutdown
    });
}

module.exports = createWebSocketServer;
