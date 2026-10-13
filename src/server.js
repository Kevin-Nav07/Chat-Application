


const { route } = require('./Router')
const { parseJSON, parseCookies } = require("./helpers/Parsers")
const http = require('node:http');//importing http module from node
const https = require('node:https');//importing https module for TLS encryption
const fs = require('node:fs');//for file reading



const { setCookies } = require('./helpers/UserAuthenticator');
const { handleCorsPreflight, applySecurityAndCorsHeaders, validateHostHeader } = require('./helpers/SecurityHeaders'); // helper functions for security headers, cors handling, and host validation
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
const MAX_BODY_SIZE = 1e6; // 1 Megabyte limit to protect memory from payload attacks
const server = https.createServer(httpsOptions, function (req, res) {
    // 0. Validate incoming Host header to defend against host header injection attacks
    if (!validateHostHeader(req, res)) {
        return; // terminates request lifecycle if host header is untrusted
    }

    // 1. Intercept CORS preflight OPTIONS requests early
    if (handleCorsPreflight(req, res)) {
        return;
    }
    const method = req.method; // extract HTTP method directly from req
    const url = req.url; // extract URL path directly from req
    let body = ""; // string accumulator for stream chunks
    let bytesReceived = 0; // counter to track payload size
    res.on('error', (error) => {
        console.log("Error encountered with the response", error);
    });
    // 2. Stream chunk listener with size guarding
    req.on('data', (chunk) => {
        bytesReceived += chunk.length;
        // If client sends more data than our limit, reject to prevent Out Of Memory crashes
        if (bytesReceived > MAX_BODY_SIZE) {
            res.statusCode = 413; // 413 Payload Too Large
            applySecurityAndCorsHeaders(req, res);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ message: "Payload too large. Maximum size is 1MB." }));
            req.destroy(); // destroy the request stream to stop incoming data
            return;
        }
        body += chunk; // accumulate data chunks
    });
    req.on('end', async () => {
        try {
            let parsedBody = null; // default to null for requests without a body
            // 3. Only parse JSON if body content exists and method supports bodies
            const hasBody = body.trim().length > 0;
            const methodsWithBody = ['POST', 'PUT', 'PATCH'];
            if (methodsWithBody.includes(method) && hasBody) {
                try {
                    parsedBody = JSON.parse(body); // parse incoming JSON payload into an object
                } catch (parseError) {
                    // Fail fast on malformed JSON instead of silently passing invalid data
                    applySecurityAndCorsHeaders(req, res);
                    res.setHeader('Content-Type', 'application/json');
                    res.statusCode = 400; // 400 Bad Request
                    res.end(JSON.stringify({ message: "Invalid JSON format in request body" }));
                    return; // halt execution so routing does not run
                }
            }
            // 4. Parse incoming cookies
            const cookies = parseCookies(req);
            // 5. Delegate to Router
            const response = await route(parsedBody, url, method, cookies);
            const responseStatusCode = response.responseStatusCode || 200;
            let responseBody = response.responseBody;
            const responseCookies = response.responseCookies;
            // 6. Set response status, cookies, and security headers
            res.statusCode = responseStatusCode;
            if (responseCookies != null) {
                setCookies(res, responseCookies);
            }
            applySecurityAndCorsHeaders(req, res);
            res.setHeader('Content-Type', 'application/json');
            // 7. Format and write response body
            if (typeof responseBody === 'string') {
                responseBody = { message: responseBody };
            }
            res.end(JSON.stringify(responseBody ?? {}));
        } catch (e) {
            console.log("Problem with the request/response cycle:\n" + e + e.stack);
            if (!res.headersSent) { // check that headers were not already flushed before writing error
                applySecurityAndCorsHeaders(req, res);
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 500;
                res.end(JSON.stringify({ message: "Unexpected error encountered on the server side" }));
            }
        }
    });
    req.on('error', (error) => {
        console.log("Error encountered trying to read streamable data:\n" + error);
    });
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