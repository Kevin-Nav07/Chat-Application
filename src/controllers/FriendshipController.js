const { validatePathParamTypes, validateSearchParamTypes, validateBodyFormat } = require('../helpers/APIValidator');
const FriendshipService = require('../Services/FriendshipService');

class FriendshipController {
    #_service // private service instance for friendship operations

    constructor(connection) {
        this.#_service = new FriendshipService(connection); // injects database client into service
    }

    // handles POST /friendship
    async createFriendRequest(body, user_id) {
        try {
            if (body?.receiver_id == null) {
                return { responseStatusCode: 400, responseBody: "receiver_id is null" }
            }
            const result = await this.#_service.createFriendRequest(user_id, body.receiver_id);

            return { responseStatusCode: 201, responseBody: result };
        }
        catch (error) {
            console.log("Error creating friend request:", error);
            return { responseStatusCode: 500, responseBody: error.message };
        }
    }

    // handles GET /friendship
    async getFriendRequests(searchParams, user_id) {
        try {
            const { status = "pending" } = searchParams || {};
            const result = await this.#_service.getFriendRequests(user_id, status);
            return { responseStatusCode: 200, responseBody: result };
        }
        catch (error) {
            console.log("Error retrieving friend requests:", error);
            return { responseStatusCode: 500, responseBody: "Failed to retrieve friend requests" };
        }
    }

    // handles PUT /friendship/accept
    async acceptFriendRequest(body, user_id) {
        try {
            const { request_id } = body || {};
            const result = await this.#_service.acceptFriendRequest(request_id, user_id);
            return { responseStatusCode: 200, responseBody: result };
        }
        catch (error) {
            console.log("Error accepting friend request:", error);
            return { responseStatusCode: 500, responseBody: error.message };
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
            console.log("Error deleting friend request:", error);
            return { responseStatusCode: 500, responseBody: error.message };
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
            console.log("Validation error:", error);
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
            return { responseStatusCode: 500, responseBody: "Unexpected server error" };
        }
    }
}

module.exports = FriendshipController;