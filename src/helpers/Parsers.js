function parseJSON(request) {


    const method = request.method;
    const statusCode = request.statusCode;
    const statusMessage = request.statusMessage;
    const url = request.url;


    return { method, statusCode, statusMessage, url };

}

function parseUrl(url, url_host) {
    const url_obj = URL.parse(`http://${url_host}${url}`)//put it into aurl object which will naturally destructure it into parts
    pathName = url_obj.pathname
    search = url_obj.search
    searchParameters = url_obj.searchParams
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




//takes in an incoming message object

//have to break down the chunks of the message and return all of them



module.exports = { parseJSON, parseUrl, parseCookies }