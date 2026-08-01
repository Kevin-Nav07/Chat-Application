class APIResponseObj {


    constructor(responseStatusCode, responseMessage, responseTitle = null) {
        this.responseMessage = responseMessage;
        this.responseStatusCode = responseStatusCode;
        this.responseTitle = responseTitle

    }


}

module.exports = APIResponseObj;