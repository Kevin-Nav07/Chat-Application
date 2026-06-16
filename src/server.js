

//be able to create a get request for server-side users
users = [
    {
        id: 1,
        username: "kevin",
        email: "kevinnaveen@"
    },

    {
        id: 2,
        username: "joe",
        email: "joe@gmail.com",

    },
    {
        id: 3,
        username: "garrus",
        email: "garrusvakarian@gmail.com"
    }
]

const http = require('node:http');//importing http module from node

const port = 5042;
const host = "localhost"
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
server = http.createServer(function (req, res) {
    if (req.method === "GET" && req.url === "/users") {
        response = (JSON.stringify(users));
        res.statusCode = 200;
        res.end(response);
    }
    else {
        response = {
            message: "response"
        }
        res.statusCode = 404;
        res.end(JSON.stringify(response));
    }

    console.log("connected?");








});

server.listen(port, host);

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