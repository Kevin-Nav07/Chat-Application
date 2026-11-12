// Turns a comma separated environment variable such as "a.com, b.com" into a clean array, or null when it is not set
function readListFromEnv(name) {
    const raw = process.env[name];
    if (raw == null || raw.trim() === '') {
        return null;
    }
    return raw.split(',').map((item) => item.trim()).filter((item) => item.length > 0);
}

const currentPort = process.env.PORT || '5043';

// Origins allowed to call the API from a browser.
// In production set CORS_ORIGINS to the deployed site, for example "https://ember.onrender.com".
// Without it the local Vite dev server and this server's own local address are allowed, so development works with no extra setup
const ALLOWED_ORIGINS = readListFromEnv('CORS_ORIGINS') ?? [
    'http://localhost:5173', // local development frontend url
    'https://localhost:5173', // secure local development frontend url
    `https://localhost:${currentPort}` // this server itself, when it serves the built frontend locally
];

// Host header values this server answers to, which blocks host header injection.
// In production set ALLOWED_HOSTS to the public domain the server is reached on, for example "api.ember.example.com"
const ALLOWED_HOSTS = readListFromEnv('ALLOWED_HOSTS') ?? [
    `localhost:${currentPort}`, // dynamically resolved local development port from environment
    `127.0.0.1:${currentPort}`, // dynamically resolved loopback ip address with port
    'localhost:5043', // fallback local development port 5043
    'localhost:8443', // fallback secure local development port 8443
    'localhost', // local hostname without port
    '127.0.0.1:5043', // fallback loopback ip address with port 5043
    '127.0.0.1:8443', // fallback loopback ip address with port 8443
    '127.0.0.1' // loopback ip address without port
];

// True when a request's Origin header names one of our own frontends.
// Browsers always send Origin on websocket handshakes and on cross site POST, PUT and DELETE requests, and a web page
// cannot fake it, so checking it stops other websites from using a visitor's cookies against this server
function isAllowedOrigin(origin) {
    return typeof origin === 'string' && ALLOWED_ORIGINS.includes(origin);
}

// List of allowed HTTP verbs for cross-origin requests
const ALLOWED_METHODS = 'GET, POST, PUT, DELETE, OPTIONS';

// List of allowed headers the frontend may send in requests
const ALLOWED_HEADERS = 'Content-Type, Authorization';

// True when a Host header names this server. Exported so the websocket upgrade can run the same check as HTTP requests
function isAllowedHost(host) {
    return typeof host === 'string' && ALLOWED_HOSTS.includes(host);
}

// The policy for API (JSON) responses and plain files: JSON never needs to load anything, so nothing is allowed
const API_CONTENT_SECURITY_POLICY = "default-src 'none'; frame-ancestors 'none'";

// The policy for the HTML page itself. Every directive lists exactly what the React app needs and nothing more:
// its own scripts and styles, Google Fonts (a stylesheet from fonts.googleapis.com, font files from fonts.gstatic.com),
// a data: image the fire's CSS embeds, and requests to this server's API and websocket.
// script-src has no 'unsafe-inline', so even if someone injected a <script> tag into the page the browser would not run it.
// host has already passed the Host check (validateHostHeader) before this runs, so it is safe to write into the header
function buildPageContentSecurityPolicy(host) {
    return [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' https://fonts.googleapis.com",
        "font-src https://fonts.gstatic.com",
        "img-src 'self' data:",
        `connect-src 'self' wss://${host}`, // 'self' covers fetch to /api; the wss:// entry is the websocket, which older browsers do not count as 'self'
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
        "form-action 'self'",
    ].join('; ');
}

// Applies general security headers to the outgoing response to protect against common web vulnerabilities.
// contentSecurityPolicy defaults to the strict API policy; the static file server passes the page policy for HTML
function applySecurityHeaders(res, contentSecurityPolicy = API_CONTENT_SECURITY_POLICY) {
    res.setHeader('X-Content-Type-Options', 'nosniff'); // instructs the browser not to guess or sniff the MIME type of the response
    res.setHeader('X-Frame-Options', 'DENY'); // prevents the page from being rendered inside an iframe, protecting against clickjacking
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains'); // enforces https connections for all future requests within one year
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin'); // limits referrer details sent to external domains to protect private path data
    res.setHeader('Content-Security-Policy', contentSecurityPolicy); // limits where the browser may load anything from, see the policies above
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
    if (!isAllowedHost(host)) {
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
    validateHostHeader,
    isAllowedOrigin,
    isAllowedHost,
    buildPageContentSecurityPolicy
};

