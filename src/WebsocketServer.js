const { WebSocketServer } = require('ws');
const WebsocketManager = require('./WebsocketManager')
const { unpack, pack } = require('msgpackr');
const { verifyJWT } = require('./helpers/UserAuthenticator');
const { parseCookies } = require('./helpers/Parsers');
const APIResponseObj = require('./Models/APIResponseObj');
const ServiceContext = require('./ServiceContext');

//wss
function createWebSocketServer(server, DbPool) {


    //we use no server mode to handle the 'upgrade' event manually from our server file
    const wss = new WebSocketServer({ noServer: true });//wss is the websocket server that listens for incomign websocket connections
    const socketManager = new WebsocketManager();

    server.on('upgrade', async function upgrade(request, socket, head) {//triggered right before the websocket connection
        //is completed on an upgrade request for http
        //verify JWT and extract user_id
        try {
            //parsing cookies
            const cookies = parseCookies(request);
            const result = await verifyJWT(cookies)//result can either be the JWT payload or a APIResponseObj
            if (result == null) {
                throw new Error("Failed to get validation object");
            }
            else if (result instanceof APIResponseObj) {
                if (socket.writable) {
                    socket.write(
                        `HTTP/1.1 ${result.responseStatusCode} ${result.responseTitle}\r\n` +
                        'Content-Type: text/plain\r\n' +
                        'Connection: close\r\n' +
                        `Content-Length: ${Buffer.byteLength(result.responseBody)}\r\n` +
                        '\r\n' +
                        result.responseBody
                    );
                    // Always physically sever the TCP connection to prevent memory leaks
                    socket.destroy();
                }
            }
            else {//result is indeed the jwt object
                const user_id = result?.user_id;//grab the user_id
                if (user_id == null || !Number.isFinite(user_id)) {
                    throw new Error("No id associated with token");
                }
                //verification complete, now upgrade the request
                //handleUpgrade is what we call for a websocket server to handle an http update
                //this function does all the heavy lifting for us. we just need to pas in the request, the raw TCP socket, the upgradeHead
                //it takes a callback at the very end which only gets called when the request has been updated to a ws connection, and then ws connection
                wss.handleUpgrade(request, socket, head, function done(ws) {
                    //label the id here
                    ws.user_id = user_id;
                    //server emits connection event with the ws connection we just got from the upgrade
                    wss.emit("connection", ws);
                })

            }
        }
        catch (error) {
            //Log the actual error for your own debugging
            console.error('[WebSocket Upgrade Error]:', error);
            let responseBody = "unexpected error with upgrade request";
            let responseStatusCode = 500
            let responseTitle = "Internal Server Error";
            // Only attempt to send a response if client hasnt been disconnected
            if (socket.writable) {
                socket.write(
                    `HTTP/1.1 ${responseStatusCode} ${responseTitle}\r\n` +
                    'Content-Type: text/plain\r\n' +
                    'Connection: close\r\n' +
                    `Content-Length: ${Buffer.byteLength(responseBody)}\r\n` +
                    '\r\n' +
                    responseBody
                );
                // Always physically sever the TCP connection to prevent memory leaks
                socket.destroy();
            }
        }
    });



    wss.on('connection', async (ws) => {//for every connection there is a ws(websocket) object for that connection
        console.log("Connected");
        //get rooms associated with the user
        //use the service context to create a room service for us
        const serviceContext = await ServiceContext.create(DbPool);
        const roomService = serviceContext.createRoomService();

        //use the roomService to retrieve the rooms we need on connection
        const rooms = await serviceContext.callServiceMethod(roomService, async (service) => {
            return await service.getRoomsPerUserAsync(ws.user_id, null, null, 50);
        })
        console.log(rooms);
        //add rooms to the socketManager

        socketManager.addRoomsToUser(rooms, ws?.user_id);//adds rooms to a user
        socketManager.addConnectionToRooms(rooms, ws);
        socketManager.display();



        //primary events: message,close,error
        ws.on('message', (data, isBinary) => {
            //data is in form Buffer
            try {
                let message, room_id;
                if (!isBinary) {
                    data = JSON.parse(data.toString("utf-8"));//can convert a Buffer to a string like this
                    room_id = data?.room_id;
                    message = data?.message;

                }
                else {
                    data = unpack(data);
                    room_id = data?.room_id;
                    message = data?.message;
                }
                console.log(`Binary was: ${isBinary} and data is ${data} ${typeof datae}`);
                //ws.id is how you give connections unique id's
                if (room_id != null && message != null) {//if we were inded able to extract room and message from the incoming data
                    if (message.toLowerCase().trim() === 'close') {
                        ws.close();
                    }
                    socketManager.transmitMessageToRoom(room_id, message, ws);
                    console.log("transmitted Message")
                }
                else {
                    console.log("could not extract data");
                }

            }
            catch (error) {
                console.log("Encountered error processing Message", error);
                ws.send(pack({ content: "Unexpected error processing message" }));

            }

        })//WebSocket object inherits from EventEmitter, so it can emit events

        ws.on('close', () => {
            try {
                //closing a connection means we need to remove the user associated with the connection and then also remove the connection
                socketManager.deleteUser(ws?.user_id, ws);
                socketManager.display()
            }
            catch (error) {
                console.log("error deleting the user on the close event: ", error);

            }
        })
        ws.on('error', (error) => {
            try {
                //closing a connection means we need to remove the user associated with the connection and then also remove the connection
                socketManager.deleteUser(ws?.user_id, ws);
                socketManager.display()

            }
            catch (error) {
                console.log("error deleting the user on the error event: ", error);

            }
        })

        //websocket is deemed as alive
        ws.isAlive = true;
        ws.on("pong", () => {//when the webv socket recieves the "pong" event from the client, then it is alive so we set alive to true
            ws.isAlive = true;
        });
    })

    wss.on('error', (error) => {
        console.log("Encountered error with websocket server", error);
    })

    //Heart beat ping/pong 
    const interval = setInterval(() => {//every 30 seconds we go through each client and ping that client and turn their alive boolean false
        wss.clients.forEach((ws) => {
            if (!ws.isAlive) return ws.terminate();
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);

}
module.exports = createWebSocketServer