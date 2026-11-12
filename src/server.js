


const { route } = require('./Router')
const { parseCookies, getClientIp } = require("./helpers/Parsers")
const http = require('node:http');//importing http module from node
const https = require('node:https');//importing https module for TLS encryption
const fs = require('node:fs');//for file reading



const { setCookies } = require('./helpers/UserAuthenticator');
const { handleCorsPreflight, applySecurityAndCorsHeaders, validateHostHeader, isAllowedOrigin } = require('./helpers/SecurityHeaders'); // helper functions for security headers, cors handling, host and origin validation
const { createFrontendHandler } = require('./StaticFiles');

// Every API address starts with this. The prefix keeps API paths apart from the React app's own page addresses,
// which would otherwise clash: /auth/login is both a page (GET, in the browser) and an API route (POST)
const API_PREFIX = '/api';

// Serves the built React app when FRONTEND_DIST_PATH points at its dist folder, or is null when it does not
// (in development Vite serves the frontend itself, so the backend only answers the API)
const serveFrontend = createFrontendHandler(process.env.FRONTEND_DIST_PATH);
console.log(serveFrontend ? `Serving the frontend from ${process.env.FRONTEND_DIST_PATH}` : "Frontend not served by this server (API only)");

// Ends a request early with a JSON error, used by the checks that run before routing
function rejectRequest(req, res, statusCode, message) {
    applySecurityAndCorsHeaders(req, res);
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = statusCode;
    res.end(JSON.stringify({ message }));
}
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

// Where the TLS certificate files live. They can be moved with TLS_KEY_PATH and TLS_CERT_PATH in .env
const TLS_KEY_PATH = process.env.TLS_KEY_PATH || 'certs/localhost+2-key.pem';
const TLS_CERT_PATH = process.env.TLS_CERT_PATH || 'certs/localhost+2.pem';

// Locally the server runs https with the mkcert certificate, because the auth cookies are Secure.
// Most hosting platforms handle https in front of the app and forward plain http to it, and the certs folder is
// gitignored so it will not exist there. In that case the server starts as plain http instead of crashing on a missing file
const useHttps = fs.existsSync(TLS_KEY_PATH) && fs.existsSync(TLS_CERT_PATH);

const httpsOptions = useHttps ? {
    key: fs.readFileSync(TLS_KEY_PATH),
    cert: fs.readFileSync(TLS_CERT_PATH),
    // Enable all security features
    minVersion: 'TLSv1.2',
    // Recommended security settings
    secureOptions: require('constants').SSL_OP_NO_SSLv3 |
        require('constants').SSL_OP_NO_TLSv1 |
        require('constants').SSL_OP_NO_TLSv1_1
} : null;
const MAX_BODY_SIZE = 1e6; // 1 Megabyte limit to protect memory from payload attacks

// The first stop for every HTTP request. It decides which lane the request belongs to:
//   /healthz       a tiny "I am alive" answer for Render's health checks
//   /api/...       the JSON API, handled by handleApiRequest and the router
//   anything else  a file from the built React app (or index.html for page addresses like /dashboard)
function handleRequest(req, res) {
    // Health check first, even before the Host check: Render's checker may call the app by an internal address instead of
    // the public hostname. It is safe to answer early because it reveals nothing and touches no database
    if (req.url === '/healthz') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store'); // a cached "ok" would hide a server that has since died
        res.end('ok');
        return;
    }

    // 0. Validate incoming Host header to defend against host header injection attacks
    if (!validateHostHeader(req, res)) {
        return; // terminates request lifecycle if host header is untrusted
    }

    const pathOnly = req.url.split('?')[0]; // the path without any ?query part, used only to choose the lane
    if (pathOnly === API_PREFIX || pathOnly.startsWith(API_PREFIX + '/')) {
        // the prefix is removed before routing, so the router and every controller keep seeing paths like /users/me
        const apiUrl = req.url.slice(API_PREFIX.length) || '/';
        handleApiRequest(req, res, apiUrl);
        return;
    }

    if (serveFrontend == null) {
        rejectRequest(req, res, 404, "Not found");
        return;
    }
    serveFrontend(req, res).catch((error) => { // async, so its failures arrive as a rejected promise and are caught here
        console.error("Error serving frontend file:", error);
        if (!res.headersSent) {
            rejectRequest(req, res, 500, "Unexpected error encountered on the server side");
        }
    });
}

// Handles one API request: answers CORS preflights, checks origin and content type, reads the body, then hands it to the router.
// url is the request's address with the /api prefix already removed
function handleApiRequest(req, res, url) {
    // 1. Intercept CORS preflight OPTIONS requests early
    if (handleCorsPreflight(req, res)) {
        return;
    }
    const method = req.method; // extract HTTP method directly from req

    // 1b. A request that changes something must come from our own frontend. Browsers attach the Origin header to these,
    // so a page on another website trying to act with a visitor's cookies is refused here. Requests without an Origin
    // (curl, server to server) carry no visitor cookies, so they are left to the normal token checks
    const changesState = method === 'POST' || method === 'PUT' || method === 'DELETE';
    if (changesState && req.headers.origin != null && !isAllowedOrigin(req.headers.origin)) {
        rejectRequest(req, res, 403, "Requests from this origin are not allowed");
        return;
    }

    // 1c. Bodies must be declared as JSON. A browser only sends a cross site request WITHOUT asking permission first
    // when the type is something like text/plain, so requiring application/json closes that gap as well
    const contentType = req.headers['content-type'] ?? '';
    const declaresBody = Number(req.headers['content-length'] ?? 0) > 0 || req.headers['transfer-encoding'] != null;
    if ((method === 'POST' || method === 'PUT') && declaresBody && !contentType.toLowerCase().startsWith('application/json')) {
        rejectRequest(req, res, 415, "Request body must be JSON (Content-Type: application/json)");
        return;
    }

    const clientIp = getClientIp(req); // the real client address, used by the router's per address rate limits
    const chunks = []; // raw byte chunks, joined once the body has fully arrived
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
        chunks.push(chunk); // kept as bytes, because decoding each chunk separately breaks characters like emoji that are split across two chunks
    });
    req.on('end', async () => {
        try {
            const body = Buffer.concat(chunks).toString('utf8'); // decodes the whole body at once so no character is split
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
            const response = await route(parsedBody, url, method, cookies, { clientIp });
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
}

// https when certificates are available, plain http otherwise (see useHttps above)
const server = useHttps ? https.createServer(httpsOptions, handleRequest) : http.createServer(handleRequest);
console.log(`Server will use ${useHttps ? "https" : "http (no certificates found)"}`);




server.on('error', (error) => {
    console.log("error")
    if (error.code === 'EADDRINUSE') {
        console.log(`Port ${process.env.PORT} is already in use. Please free up the port or use a different one.`);
    } else if (error.code === 'EACCES') {
        console.log(`Permission denied. Port ${process.env.PORT} requires elevated privileges.`);
    } else {
        console.log('Server failed to start:', error);
    }
    process.exit(1);
});



//**************WEB SOCKET SERVEr ****************/



module.exports = { server }