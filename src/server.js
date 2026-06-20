


const { route } = require('./Router')
const { parseJSON } = require("./helpers/Parsers")
const http = require('node:http');//importing http module from node
const { validateURLFormat } = require('./helpers/APIValidator');

/*http server takes an optional Options object paramater and a RequestListener function
of form: where request is the request object representative of an IncomingMEssage object, response is a ServerResponse object
function(request,response):void {
do something
void
}
requestlistener function paramater will be a callback paramater, we can call callback like either two ways:

(req:IncomingMessage,res:ServerResponse)=> {}
    or
function (req:IncomingMessage,res:ServerResponse){}
*/



server = http.createServer(async function (req, res) {
    let body = ""

    req.on('data', function handleChunk(chunk) {
        body = body + chunk
        console.log("body chunk:" + chunk)

    })
    req.on('end', () => {
        try {
            const { method, statusCode, statusMessage, url } = parseJSON(req);
            body = JSON.parse(body)


            route(body, url, method);
        }
        catch (e) {
            console.log("problem parsing request into an object" + e)
        }


    })
    req.on('error', (error) => {
        console.log("Error encountered trying to read streamable data :\n" + error)
    })


    console.log("Client sent a request")

});



server.on("connection", () => {
    console.log("Someone connected!!!")
})

server.on('error', (error) => {
    console.log.log("error")
    if (error.code === 'EADDRINUSE') {
        console.log(`Port ${PORT} is already in use. Please free up the port or use a different one.`);
    } else if (error.code === 'EACCES') {
        console.log(`Permission denied. Port ${PORT} requires elevated privileges.`);
    } else {
        console.log('Server failed to start:', error);
    }
    process.exit(1);
});




module.exports = { server }