function parseJSON(request) {


    const method = request.method;
    const statusCode = request.statusCode;
    const statusMessage = request.statusMessage;
    const url = request.url;


    return { method, statusCode, statusMessage, url };


}

//what sanitizations do we need?
//1. only processing relevant query paramaters
//2. checking for valid url ending
//3. check for valid method
//4. check for statusMessage
//5. check for valid headers(find out what valid headers there are)
//6. check for path paramaters(find out how path paramaters differ from query paramaters)

//takes in an incoming message object

//have to break down the chunks of the message and return all of them



module.exports = { parseJSON }