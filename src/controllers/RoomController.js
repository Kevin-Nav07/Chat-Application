const { validatePathParamTypes, validateSearchParamTypes, validateBodyFormat } = require('../helpers/APIValidator');


const RoomService = require('../Services/RoomService')
class RoomController {


    _service//the service will handle database transactions, the controller will configure what gets sent through and handle the requests
    constructor(connection) {
        this._service = new RoomService(connection)

    }


    async createRoomAsync(body) {
        try {

            await this._service.createRoomAsync(body);
            return { responseStatusCode: 201, responseBody: "Object successfully created" }
        }
        catch (error) {
            console.log(error)
            return { responseStatusCode: 500, responseBody: "Failed to create resource at the requested URL" };

        }
    }


    async getRoomsAsync(pathParams, searchParams) {

        try {
            const { id = null } = searchParams || {};//if searchParams is null falls on an empty object to destructure to prevent TypeError
            let rooms = await this._service.getRoomsAsync(id);
            console.log(rooms);
            return { responseStatusCode: 200, responseBody: rooms }

        }
        catch (error) {
            console.log(`Error found retrieveing rooms:\n ${error}`);
            return { responseStatusCode: 500, responseBody: "Internal Server issue retrieving rooms" };

        }
    }



    async handleRequest(method, body, searchParams, pathName, handler, pathParams, schema, expectedPathTypes, expectedSearchParamType) {
        /*
       In POST: always pass in body
       IN GET: always pass in optional pathParams, searchParams
       IN DELETE: alway spass in mandatory pathParams
       IN PUT: always pass in PathParams
   
       for each instance we call the handler and pass in the paramaters we need too.
       for each pathParamater set we pass in we can assume it is the correct pathParams since we did validation beforehand
       //before we pass in, we need to use our ApiValidator class to validate queryParams and Body Schema(this is only needed if there is)
       */

        try {
            validatePathParamTypes(expectedPathTypes, pathParams);
            searchParams = validateSearchParamTypes(expectedSearchParamType, searchParams);//returns a newly constructed object so it converts the searchParams from an iterable to an object if valid
            validateBodyFormat(schema, body);
        }
        catch (error) {
            console.log("error validating search or path paramaters", error);
            return { responseStatusCode: 400, responseBody: error.message };

        }

        try {
            switch (method) {
                case "POST":
                    return this[handler](body);
                case "GET":
                    return this[handler](pathParams, searchParams);

            }

        }
        catch (error) {
            console.log("Bad request", error)
            return { responseStatusCode: 500, responseBody: "Request does not match a method in the user controller" }

        }

    }
}

module.exports = RoomController;