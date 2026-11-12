const { validatePathParamTypes, validateSearchParamTypes, validateBodyFormat } = require('../helpers/APIValidator');
const { decodeCursorIntoParams, encodeParamsIntoCursor } = require('../helpers/Cursor');
const { HttpError, errorToResponse } = require('../helpers/ErrorExtensions');

const RoomService = require('../Services/RoomService');
const MessageService = require('../Services/MessageService');
const { notifyRoomCreated } = require('../RealtimeNotifier');

const DEFAULT_PAGE_SIZE = 20; // default page size for room listing
const MAX_PAGE_SIZE = 50; // upper bound limit for room listing
const ROOMS_CURSOR_KIND = "rooms"; // written into every rooms cursor so it cannot be replayed on the messages endpoint
const MESSAGES_CURSOR_KIND = "messages"; // written into every messages cursor, together with the room it belongs to

class RoomController {
    #_service; // RoomService instance for managing room creation and membership
    #_messageService; // MessageService instance for managing chat messages

    constructor(connection) {
        this.#_service = new RoomService(connection); // injects database client into room service
        this.#_messageService = new MessageService(connection); // injects database client into message service
    }

    // POST /rooms, the logged in user becomes a member of the room they create.
    // Answers 201 for a new room. For a direct room that already existed it answers 200 with that room,
    // so the "Message" button can call this every time and always lands in the one conversation with that friend
    async createRoomAsync(body, user_id) {
        try {
            const { room, members, created, nameByMember } = await this.#_service.createRoomAsync(body, user_id);
            if (created) {
                // the same shape GET /rooms returns, a brand new room has no messages yet
                await notifyRoomCreated({ ...room, last_message: null }, members, nameByMember); // live sockets of every member join the room
            }
            return { responseStatusCode: created ? 201 : 200, responseBody: { ...room, members } };
        } catch (error) {
            console.log(error.message);
            return errorToResponse(error, "Failed to create resource at the requested URL");
        }
    }

    // GET /rooms, every room the logged in user is a member of
    async getRoomsAsync(searchParams, user_id) {
        try {
            const rooms = await this.#_service.getRoomsAsync(user_id);
            return { responseStatusCode: 200, responseBody: rooms };
        } catch (error) {
            console.log(`Error found retrieving rooms:\n ${error}`);
            return errorToResponse(error, "Internal Server issue retrieving rooms");
        }
    }

    // GET /rooms/cursor?limit=&cursor=, one page of the user's rooms
    async getRoomsForUserAsync(searchParams, user_id) {
        const expectedCursorParams = ["kind", "id", "created_at"];
        try {
            const cursor = searchParams?.cursor;
            const limit = searchParams?.limit ?? DEFAULT_PAGE_SIZE;
            if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
                throw new HttpError(400, `limit must be a whole number between 1 and ${MAX_PAGE_SIZE}`);
            }
            let cursorParams = null;
            if (cursor != null) {
                try {
                    cursorParams = decodeCursorIntoParams(cursor, expectedCursorParams);
                } catch (cursorError) {
                    throw new HttpError(400, cursorError.message);
                }
                // room and message cursors share a shape, so the kind field stops one being used on the other endpoint
                if (cursorParams.kind !== ROOMS_CURSOR_KIND) {
                    throw new HttpError(400, "Cursor does not belong to the rooms list");
                }
            }

            const rows = await this.#_service.getRoomsPerUserAsync(user_id, cursorParams?.id, cursorParams?.created_at, limit);

            const lastRow = rows[rows.length - 1];
            const newCursor = rows.length === limit
                ? encodeParamsIntoCursor({ kind: ROOMS_CURSOR_KIND, id: lastRow.id, created_at: lastRow.cursor_created_at })
                : null;
            const rooms = rows.map(({ cursor_created_at, ...room }) => room);

            return { responseStatusCode: 200, responseBody: { rooms, newCursor } };
        } catch (error) {
            console.log("Encountered error retrieving rooms:", error.message);
            return errorToResponse(error, "Internal Server issue retrieving rooms");
        }
    }

    // GET /rooms/:id/messages?limit=&cursor=, retrieves paginated messages for a specific room
    async getRoomMessagesAsync(searchParams, user_id, pathParams) {
        const expectedCursorParams = ["kind", "room_id", "id", "created_at"];
        try {
            const roomId = pathParams?.id; // extracts room ID from URL path segment
            if (roomId == null) {
                throw new HttpError(400, "Room ID is required");
            }

            const cursor = searchParams?.cursor; // extracts optional cursor token
            const limit = searchParams?.limit ?? 30; // defaults to 30 messages per page
            if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
                throw new HttpError(400, "limit must be a whole number between 1 and 100");
            }

            let cursorParams = null;
            if (cursor != null) {
                try {
                    cursorParams = decodeCursorIntoParams(cursor, expectedCursorParams);
                } catch (cursorError) {
                    throw new HttpError(400, cursorError.message); // rejects malformed cursor
                }
                // a message cursor only works for the endpoint and room it was issued for
                if (cursorParams.kind !== MESSAGES_CURSOR_KIND || cursorParams.room_id !== roomId) {
                    throw new HttpError(400, "Cursor does not belong to this room's messages");
                }
            }

            // Calls message service to query database with membership validation and user join
            const rows = await this.#_messageService.getRoomMessagesAsync(
                roomId,
                user_id,
                cursorParams?.id,
                cursorParams?.created_at,
                limit
            );

            // Generates next cursor token if a full page was returned
            const lastRow = rows[rows.length - 1];
            const newCursor = rows.length === limit
                ? encodeParamsIntoCursor({ kind: MESSAGES_CURSOR_KIND, room_id: roomId, id: lastRow.id, created_at: lastRow.cursor_created_at })
                : null;

            // Strips internal cursor timestamp from public response
            const messages = rows.map(({ cursor_created_at, ...msg }) => msg);

            return { responseStatusCode: 200, responseBody: { messages, newCursor } };
        } catch (error) {
            console.log("Error retrieving room messages in controller:", error.message);
            return errorToResponse(error, "Failed to retrieve room messages");
        }
    }

    // Central dispatcher validating request formats and invoking target handlers
    async handleRequest(method, body, searchParams, pathName, handler, pathParams, schema, expectedPathTypes, expectedSearchParamType, refreshToken, user_id) {
        try {
            validatePathParamTypes(expectedPathTypes, pathParams);
            searchParams = validateSearchParamTypes(expectedSearchParamType, searchParams);
            validateBodyFormat(schema, body);
        } catch (error) {
            console.log("Error validating search or path parameters:", error.message);
            return { responseStatusCode: 400, responseBody: error.message };
        }

        try {
            switch (method) {
                case "POST":
                    return await this[handler](body, user_id, pathParams);
                case "GET":
                    return await this[handler](searchParams, user_id, pathParams);
                default:
                    console.log("Request does not match a method in the room controller");
                    return { responseStatusCode: 405, responseBody: "Request does not match a method in the room controller" };
            }
        } catch (error) {
            console.log("Bad request encountered in RoomController:", error);
            return errorToResponse(error, "Unexpected error trying to handle the request in the controller");
        }
    }
}

module.exports = RoomController;
