const { WebSocketServer } = require('ws');

const { unpack, pack } = require('msgpackr');


//wss
function createWebSocketServer(server) {

    const wss = new WebSocketServer({ server: server });//wss is the websocket server that listens for incomign websocket connections

    wss.on('connection', (ws) => {//for every connection there is a ws(websocket) object for that connection
        console.log("Connected");

        //primary events: message,close,error
        ws.on('message', (data, isBinary) => {
            //data is in form Buffer
            let message, room;
            if (!isBinary) {
                message = data.toString("utf-8");//can convert a Buffer to a string like this


            }
            else {
                data = unpack(data);
                ({ room, message } = data);

            }
            console.log(`Binary was: ${isBinary} and data is ${data} ${typeof datae}`);


            //ws.id is how you give connections unique id's
            wss.clients.forEach((ws2) => {
                if (ws2 !== ws) {

                    ws2.send(message);
                }


            })
            console.log("New Message: ", message);
            // if (message.toLowerCase().trim() === 'close') {
            //     ws.close();
            // }
        })//WebSocket object inherits from EventEmitter, so it can emit events

        ws.on('close', () => {
            console.log("Conneciton closed by client");
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