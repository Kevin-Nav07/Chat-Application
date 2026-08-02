class APIResponseObj {


    constructor(responseStatusCode, responseBody, responseTitle = null) {
        this.responseBody = responseBody;
        this.responseStatusCode = responseStatusCode;
        this.responseTitle = responseTitle

    }


}

module.exports = APIResponseObj;