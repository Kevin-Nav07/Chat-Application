function parseJSON(request) {


    const method = request.method;
    const statusCode = request.statusCode;
    const statusMessage = request.statusMessage;
    const url = request.url;


    return { method, statusCode, statusMessage, url };

}

//splits a request url like /friendship?status=pending into its path and its search paramaters
function parseUrl(url) {
    //URL needs a full address to parse, so a placeholder base is given; only the path and query of the result are used
    const url_obj = new URL(url, "http://localhost")
    const pathName = url_obj.pathname
    const search = url_obj.search
    const searchParameters = url_obj.searchParams
    return { pathName, search, searchParameters }

}

function parseCookies(request) {
    const cookieHeader = request.headers.cookie;
    if (!cookieHeader) return {};

    const cookies = {};

    // Split the string by the semicolon and space
    cookieHeader.split('; ').forEach(cookieStr => {
        // Split each pair by the first '=' 
        // (Using split and shift handles edge cases where the value itself contains an '=')
        const parts = cookieStr.split('=');
        const key = parts.shift().trim();
        const value = parts.join('=');

        if (key) {
            try {
                cookies[key] = decodeURIComponent(value);
            } catch (e) {
                // If decoding fails, fall back to the raw value
                cookies[key] = value;
            }
        }
    });

    return cookies;
}

// How many proxies sit in front of this server and add themselves to X-Forwarded-For.
// 0 (the default, used locally) means requests arrive straight from the browser and the header is ignored
const TRUST_PROXY_HOPS = Number.parseInt(process.env.TRUST_PROXY_HOPS ?? "0", 10) || 0;

// Works out the address of the real client, used as the key for per address rate limits.
// On a hosting platform every request reaches Node from the platform's proxy, so socket.remoteAddress is the proxy.
// The proxy appends the address it saw to X-Forwarded-For. A client can put anything it likes at the START of that
// header, so only the entry written by our own proxy is trusted: the one TRUST_PROXY_HOPS places from the end
function getClientIp(request) {
    const socketAddress = request.socket?.remoteAddress ?? "unknown";
    if (TRUST_PROXY_HOPS === 0) {
        return socketAddress;
    }
    const header = request.headers["x-forwarded-for"];
    if (typeof header !== "string" || header.trim() === "") {
        return socketAddress; // no proxy header, for example a health check from inside the platform
    }
    const entries = header.split(",").map((entry) => entry.trim()).filter((entry) => entry.length > 0);
    // with one trusted proxy the last entry is the one it wrote; with fewer entries than hops, the first is the best guess
    return entries[entries.length - TRUST_PROXY_HOPS] ?? entries[0] ?? socketAddress;
}

module.exports = { parseJSON, parseUrl, parseCookies, getClientIp }