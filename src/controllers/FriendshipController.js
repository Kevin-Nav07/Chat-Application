const { validatePathParamTypes, validateSearchParamTypes, validateBodyFormat } = require('../helpers/APIValidator');
const { errorToResponse } = require('../helpers/ErrorExtensions');
const FriendshipService = require('../Services/FriendshipService');

// the values of the friendship_status enum in the database, anything else would make postgres throw
const VALID_STATUSES = ["pending", "accepted", "blocked"];

class FriendshipController {
    #_service // private service instance for friendship operations

    constructor(connection) {
        this.#_service = new FriendshipService(connection); // injects database client into service
    }

    // handles POST /friendship
    async createFriendRequest(body, user_id) {
        try {
            const result = await this.#_service.createFriendRequest(user_id, body.receiver_id);//body shape was already checked by createFriendshipSchema
            return { responseStatusCode: 201, responseBody: result };
        }
        catch (error) {
            console.log("Error creating friend request:", error.message);
            return errorToResponse(error, "Failed to create friend request");
        }
    }

    // handles GET /friendship?status=pending|accepted|blocked
    async getFriendRequests(searchParams, user_id) {
        try {
            const { status = "pending" } = searchParams || {};
            if (!VALID_STATUSES.includes(status)) {
                return { responseStatusCode: 400, responseBody: `status must be one of: ${VALID_STATUSES.join(", ")}` };
            }
            const result = await this.#_service.getFriendRequests(user_id, status);
            return { responseStatusCode: 200, responseBody: result };
        }
        catch (error) {
            console.log("Error retrieving friend requests:", error);
            return errorToResponse(error, "Failed to retrieve friend requests");
        }
    }

    // handles PUT /friendship/accept
    async acceptFriendRequest(body, user_id) {
        try {
            const result = await this.#_service.acceptFriendRequest(body.request_id, user_id);//body shape was already checked by acceptFriendshipSchema
            return { responseStatusCode: 200, responseBody: result };
        }
        catch (error) {
            console.log("Error accepting friend request:", error.message);
            return errorToResponse(error, "Failed to accept friend request");
        }
    }

    // handles DELETE /friendship/:id
    async deleteFriendRequest(pathParams, user_id) {
        try {
            const { id } = pathParams;
            await this.#_service.deleteFriendRequest(id, user_id);
            return { responseStatusCode: 200, responseBody: "Resource deleted" };
        }
        catch (error) {
            console.log("Error deleting friend request:", error.message);
            return errorToResponse(error, "Failed to delete friendship");
        }
    }

    // handles routing and validation dispatching
    async handleRequest(method, body, searchParams, pathName, handler, pathParams, schema, expectedPathTypes, expectedSearchParamType, refreshToken, user_id) {
        try {
            validatePathParamTypes(expectedPathTypes, pathParams);
            searchParams = validateSearchParamTypes(expectedSearchParamType, searchParams);
            validateBodyFormat(schema, body);
        }
        catch (error) {
            console.log("Validation error:", error.message);
            return { responseStatusCode: 400, responseBody: error.message };
        }

        try {
            switch (method) {
                case "POST":
                    return await this[handler](body, user_id);
                case "GET":
                    return await this[handler](searchParams, user_id);
                case "PUT":
                    return await this[handler](body, user_id);
                case "DELETE":
                    return await this[handler](pathParams, user_id);
                default:
                    return { responseStatusCode: 405, responseBody: "Method Not Allowed" };
            }
        }
        catch (error) {
            console.log("Handler execution error:", error);
            return errorToResponse(error, "Unexpected server error");
        }
    }
}

module.exports = FriendshipController;
