


const { route } = require('./Router')
const { parseJSON, parseCookies } = require("./helpers/Parsers")
const http = require('node:http');//importing http module from node
const https = require('node:https');//importing https module for TLS encryption
const fs = require('node:fs');//for file reading



const { setCookies } = require('./helpers/UserAuthenticator');
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

const httpsOptions = {
    key: fs.readFileSync('certs/localhost+2-key.pem'),
    cert: fs.readFileSync('certs/localhost+2.pem'),
    // Enable all security features
    minVersion: 'TLSv1.2',
    // Recommended security settings
    secureOptions: require('constants').SSL_OP_NO_SSLv3 |
        require('constants').SSL_OP_NO_TLSv1 |
        require('constants').SSL_OP_NO_TLSv1_1
};

const server = https.createServer(httpsOptions, function (req, res) {
    let body = ""
    res.on('error', (error) => {
        console.log("Error encountered with the response", error);
    })

    req.on('data', (chunk) => {
        body += chunk
    })


    req.on('end', async () => {
        try {
            console.log("in end")
            const { method, statusCode, statusMessage, url } = parseJSON(req);

            if (body != null || body.length !== 0) {

                try {
                    body = JSON.parse(body)
                }
                catch (error) {
                    console.log("invalid body format, it must be JSON");
                    body = "{}";
                }

            }

            //parsing cookies
            let cookies = parseCookies(req);
            console.log(cookies);


            const response = await route(body, url, method, cookies);
            let responseStatusCode = response.responseStatusCode;
            let responseBody = response.responseBody;
            let responseCookies = response.responseCookies;


            res.statusCode = responseStatusCode
            if (responseCookies != null) {
                setCookies(res, responseCookies);
            }
            const headers = new Map([['Content-Type', 'application/json'], ['test-Header', 'Kevo']])

            res.setHeaders(headers);//headers must be an instance of Map or Header class

            if (typeof responseBody === 'object' || Array.isArray(responseBody)) {
                responseBody = JSON.stringify(responseBody);

            }
            else if (typeof responseBody === 'string') {
                responseBody = JSON.stringify({ responseMessage: responseBody });
            }
            else {
                responseBody = JSON.stringify(responseBody);
            }

            res.write(responseBody);
            res.end()



        }
        catch (e) {
            console.log("problem with the request/response cycle:\n" + e + e.stack);
            const headers = new Map([['Content-Type', 'application/json'], ['test-Header', 'Kevo']])

            res.setHeaders(headers);
            res.statusCode = 500;
            res.write(JSON.stringify({ "message": "Unexpected error encountered on the server side" }));
            res.end()
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
    console.log("error")
    if (error.code === 'EADDRINUSE') {
        console.log(`Port ${PORT} is already in use. Please free up the port or use a different one.`);
    } else if (error.code === 'EACCES') {
        console.log(`Permission denied. Port ${PORT} requires elevated privileges.`);
    } else {
        console.log('Server failed to start:', error);
    }
    process.exit(1);
});


//**************WEB SOCKET SERVEr ****************/



module.exports = { server }