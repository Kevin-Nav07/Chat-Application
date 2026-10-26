const { validatePathParamTypes, validateSearchParamTypes, validateBodyFormat } = require('../helpers/APIValidator');
const { decodeCursorIntoParams, encodeParamsIntoCursor } = require('../helpers/Cursor')
const { HttpError, errorToResponse } = require('../helpers/ErrorExtensions');

const RoomService = require('../Services/RoomService')

const DEFAULT_PAGE_SIZE = 20;//how many rooms one page returns when the client does not say
const MAX_PAGE_SIZE = 50;//upper bound so one request cannot ask for every room at once

class RoomController {


    #_service//the service will handle database transactions, the controller will configure what gets sent through and handle the requests
    constructor(connection) {
        this.#_service = new RoomService(connection)

    }


    //POST /rooms, the logged in user becomes a member of the room they create
    async createRoomAsync(body, user_id) {
        try {
            const room = await this.#_service.createRoomAsync(body, user_id);
            return { responseStatusCode: 201, responseBody: room }
        }
        catch (error) {
            console.log(error.message)
            return errorToResponse(error, "Failed to create resource at the requested URL");
        }
    }


    //GET /rooms, every room the logged in user is a member of
    async getRoomsAsync(searchParams, user_id) {

        try {
            const rooms = await this.#_service.getRoomsAsync(user_id);
            return { responseStatusCode: 200, responseBody: rooms }
        }
        catch (error) {
            console.log(`Error found retrieveing rooms:\n ${error}`);
            return errorToResponse(error, "Internal Server issue retrieving rooms");
        }
    }

    //GET /rooms/cursor?limit=&cursor=, one page of the user's rooms. newCursor is null when there are no more pages,
    //otherwise the frontend passes it back as ?cursor= to get the next page
    async getRoomsForUserAsync(searchParams, user_id) {
        const expectedCursorParams = ["id", "created_at"]
        try {
            const cursor = searchParams?.cursor;
            const limit = searchParams?.limit ?? DEFAULT_PAGE_SIZE;
            if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
                throw new HttpError(400, `limit must be a whole number between 1 and ${MAX_PAGE_SIZE}`);
            }
            let cursorParams = null;
            if (cursor != null) {
                try {
                    cursorParams = decodeCursorIntoParams(cursor, expectedCursorParams)
                }
                catch (cursorError) {//a tampered or malformed cursor is the client's mistake, not a server failure
                    throw new HttpError(400, cursorError.message);
                }
            }

            const rows = await this.#_service.getRoomsPerUserAsync(user_id, cursorParams?.id, cursorParams?.created_at, limit)

            //a page smaller than the limit means we reached the end, so there is no next cursor
            const lastRow = rows[rows.length - 1]
            const newCursor = rows.length === limit
                ? encodeParamsIntoCursor({ id: lastRow.id, created_at: lastRow.cursor_created_at })
                : null;
            //cursor_created_at was only needed to build the cursor, so it is removed from what the client sees
            const rooms = rows.map(({ cursor_created_at, ...room }) => room);

            return { responseStatusCode: 200, responseBody: { rooms, newCursor } }

        }
        catch (error) {
            console.log("encountered error retrieving rooms", error.message);
            return errorToResponse(error, "Internal Server issue retrieving rooms");
        }

    }



    async handleRequest(method, body, searchParams, pathName, handler, pathParams, schema, expectedPathTypes, expectedSearchParamType, refreshToken, user_id) {
        /*
       In POST: always pass in body
       IN GET: always pass in optional pathParams, searchParams
       user_id is always passed so rooms are created by and looked up for the logged in user
       */

        try {
            validatePathParamTypes(expectedPathTypes, pathParams);
            searchParams = validateSearchParamTypes(expectedSearchParamType, searchParams);//returns a newly constructed object so it converts the searchParams from an iterable to an object if valid
            validateBodyFormat(schema, body);
        }
        catch (error) {
            console.log("error validating search or path paramaters", error.message);
            return { responseStatusCode: 400, responseBody: error.message };

        }

        try {
            switch (method) {
                case "POST":
                    return await this[handler](body, user_id);
                case "GET":
                    return await this[handler](searchParams, user_id);
                default:
                    console.log("request does not match a method in the room controller");
                    return { responseStatusCode: 405, responseBody: "Request does not match a method in the room controller" };

            }

        }
        catch (error) {
            console.log("Bad request", error)
            return errorToResponse(error, "Unexpected error trying to handle the request in the controller");
        }

    }
}

module.exports = RoomController;
