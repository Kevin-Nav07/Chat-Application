function parseJSON(request) {


    const method = request.method;
    const statusCode = request.statusCode;
    const statusMessage = request.statusMessage;
    const url = request.url;


    return { method, statusCode, statusMessage, url };

}

function parseUrl(url, url_host) {
    const url_obj = URL.parse(`http://${url_host}${url}`)//put it into aurl object which will naturally destructure it into parts
    path_name = url_obj.pathname
    search = url_obj.search
    searchParameters = url_obj.searchParams
    return { path_name, search, searchParameters }

}


//takes in an incoming message object

//have to break down the chunks of the message and return all of them



module.exports = { parseJSON, parseUrl }