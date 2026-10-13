// List of origins allowed to access the API from a browser
const ALLOWED_ORIGINS = [
    'http://localhost:5173', // local development frontend url
    'https://localhost:5173' // secure local development frontend url
];

const currentPort = process.env.PORT || '5043';

// List of hostnames and ports permitted to reach this server to prevent host header injection
const ALLOWED_HOSTS = [
    `localhost:${currentPort}`, // dynamically resolved local development port from environment
    `127.0.0.1:${currentPort}`, // dynamically resolved loopback ip address with port
    'localhost:5043', // fallback local development port 5043
    'localhost:8443', // fallback secure local development port 8443
    'localhost', // local hostname without port
    '127.0.0.1:5043', // fallback loopback ip address with port 5043
    '127.0.0.1:8443', // fallback loopback ip address with port 8443
    '127.0.0.1' // loopback ip address without port
];

// List of allowed HTTP verbs for cross-origin requests
const ALLOWED_METHODS = 'GET, POST, PUT, DELETE, OPTIONS';

// List of allowed headers the frontend may send in requests
const ALLOWED_HEADERS = 'Content-Type, Authorization';

// Applies general security headers to the outgoing response to protect against common web vulnerabilities
function applySecurityHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff'); // instructs the browser not to guess or sniff the MIME type of the response
    res.setHeader('X-Frame-Options', 'DENY'); // prevents the page from being rendered inside an iframe, protecting against clickjacking
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains'); // enforces https connections for all future requests within one year
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin'); // limits referrer details sent to external domains to protect private path data
    res.setHeader('Content-Security-Policy', "default-src 'self'"); // restricts resources to load only from the same origin
}

// Checks if the incoming request origin is allowed and applies cross-origin resource sharing headers
function applyCorsHeaders(req, res) {
    const origin = req.headers.origin; // reads the origin header sent by the client browser

    // Only set CORS headers if the request origin matches our allowed list
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin); // explicitly sets the allowed origin because wildcard is forbidden with credentials
        res.setHeader('Access-Control-Allow-Credentials', 'true'); // tells the browser to allow cookies and authorization headers in cross-origin requests
        res.setHeader('Vary', 'Origin'); // tells intermediary caches and proxies to store responses separately for each distinct origin
    }
}

// Convenience function to apply both security headers and CORS headers to any standard response
function applySecurityAndCorsHeaders(req, res) {
    applySecurityHeaders(res); // applies security protection headers
    applyCorsHeaders(req, res); // applies cross-origin resource sharing headers
}

// Intercepts preflight OPTIONS requests sent by browsers prior to complex cross-origin requests
function handleCorsPreflight(req, res) {
    // If the request method is not OPTIONS, let it proceed to normal routing
    if (req.method !== 'OPTIONS') {
        return false; // indicates this request is not a preflight check
    }

    const origin = req.headers.origin; // reads the origin header from the preflight request

    // Check if the preflight request comes from an authorized origin
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin); // reflects the authorized origin back to the browser
        res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS); // informs the browser which HTTP methods are permitted
        res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS); // informs the browser which custom headers are permitted
        res.setHeader('Access-Control-Allow-Credentials', 'true'); // authorizes the browser to send credentials such as cookies
        res.setHeader('Access-Control-Max-Age', '86400'); // caches the preflight response in the browser for 24 hours to reduce network roundtrips
        res.setHeader('Vary', 'Origin'); // ensures caches keep preflight responses separate per origin
    }

    res.statusCode = 204; // status 204 indicates the preflight succeeded and there is no response body to return
    res.end(); // finishes the response immediately without waiting for body parsing or database queries
    return true; // indicates this preflight request has been fully handled
}

// Validates that the incoming Host header matches our allowed server domains to prevent host header injection
function validateHostHeader(req, res) {
    const host = req.headers.host; // reads the host header sent by the client

    // Check if host header exists and is contained within our allowed hosts list
    if (!host || !ALLOWED_HOSTS.includes(host)) {
        applySecurityAndCorsHeaders(req, res); // attach security and cors headers to allow the browser to display the 400 error
        res.setHeader('Content-Type', 'application/json'); // specify json error response format
        res.statusCode = 400; // 400 Bad Request indicates an untrusted or invalid host
        res.end(JSON.stringify({ message: "Invalid or unauthorized Host header" })); // send response and terminate connection
        return false; // indicates validation failed
    }

    return true; // indicates host is valid and request may proceed
}

module.exports = {
    applySecurityHeaders,
    applyCorsHeaders,
    applySecurityAndCorsHeaders,
    handleCorsPreflight,
    validateHostHeader
};

