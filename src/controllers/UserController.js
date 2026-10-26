
const { validatePathParamTypes, validateBodyFormat, validateSearchParamTypes } = require("../helpers/APIValidator")
const { errorToResponse } = require("../helpers/ErrorExtensions")


const UserService = require('../Services/UserService');

//removes the email from a user object unless the person asking is that same user, emails are private
function toVisibleUser(user, requester_id) {
    if (user.id === requester_id) {
        return user;
    }
    const { email, ...publicUser } = user;//copies every field except email into publicUser
    return publicUser;
}


class UserController {

    _service//the service will handle database transactions, the controller will configure what gets sent through and handle the requests
    constructor(connection) {
        this._service = new UserService(connection)
    }

    //GET /users/me, returns the logged in user's own profile. The frontend calls this on page load to find out
    //who is logged in, because it cannot read the HttpOnly token cookie itself
    async getCurrentUserAsync({ user_id }) {
        try {
            const user = await this._service.getUserAsync(user_id);
            if (user == null) {//token is valid but the account was deleted
                return { responseStatusCode: 404, responseBody: "User Not Found" }
            }
            return { responseStatusCode: 200, responseBody: user }
        }
        catch (error) {
            console.log(error)
            return errorToResponse(error, "Unexpected server error encountered");
        }
    }

    async getUserAsync({ pathParams, user_id }) {
        try {
            const { id } = pathParams//destructurng over an object requires thi syntax
            const user = await this._service.getUserAsync(id);
            if (user == null) {
                return { responseStatusCode: 404, responseBody: "Could not find resource" }
            }
            return { responseStatusCode: 200, responseBody: toVisibleUser(user, user_id) }
        }
        catch (error) {
            console.log(error)
            return errorToResponse(error, "Unexpected server error encountered");
        }
    }
    async getUserByNameAsync({ pathParams, user_id }) {
        //from pathParams extract the exact username
        try {
            const { username } = pathParams;
            const user = await this._service.getUserByNameAsync(username);
            if (user == null) {
                return { responseStatusCode: 404, responseBody: "User Not Found" }
            }
            return { responseStatusCode: 200, responseBody: toVisibleUser(user, user_id) }
        }
        catch (error) {
            console.log(error)
            return errorToResponse(error, "Unexpected server side error");
        }

    }
    async getUsersAsync() {
        try {
            const users = await this._service.GetUsersAsync();
            return { responseStatusCode: 200, responseBody: users };//an empty list is still a successful answer, so it is a 200 not an error
        }
        catch (error) {
            console.log("Error encountered retrieving users", error);
            return errorToResponse(error, "Unexpected server error encountered");
        }
    }

    //POST /users (sign up), returns 201 with the created user so the frontend gets the new id straight away
    async createUserAsync({ body }) {
        try {
            const user = await this._service.createUserAsync(body);
            return { responseStatusCode: 201, responseBody: user };
        }
        catch (error) {
            console.log(error)
            return errorToResponse(error, "Failed to create resource at the requested URL");//a duplicate username or email comes back as a 409
        }
    }

    //DELETE /users/:id, a user may only delete their own account
    async deleteUserAsync({ pathParams, user_id }) {
        try {
            const { id } = pathParams
            if (id !== user_id) {
                return { responseStatusCode: 403, responseBody: "You can only delete your own account" };
            }
            await this._service.deleteUserAsync(id);
            //the account is gone, so its auth cookies are cleared as well
            return { responseStatusCode: 200, responseBody: "User deleted", responseCookies: { accessToken: "", refreshToken: "" } };
        }
        catch (error) {
            console.log("Error encountered deleting user", error);
            return errorToResponse(error, "Failed to delete resource at the requested URL");
        }

    }

    //PUT /users/:id, a user may only update their own account
    async updateUserAsync({ pathParams, body, user_id }) {
        try {
            const { id } = pathParams
            if (id !== user_id) {
                return { responseStatusCode: 403, responseBody: "You can only update your own account" };
            }
            const user = await this._service.updateUserAsync(body, id);
            return { responseStatusCode: 200, responseBody: user };
        }
        catch (error) {
            console.log("Error encountered updating user", error);
            return errorToResponse(error, "Failed to update user");
        }

    }


    async handleRequest(method, body, searchParams, pathName, handler, pathParams, schema, expectedPathTypes, expectedSearchParamType, refreshToken, user_id) {
        //take the request and handle it by validating any relevant query paramaters or body if needed
        /*
        In POST: always pass in body
        IN GET: always pass in optional pathParams, searchParams
        IN DELETE: alway spass in mandatory pathParams
        IN PUT: always pass in PathParams and body
        user_id is the id from the access token (undefined on routes that do not need a token),
        handlers use it to decide what the caller is allowed to see or change
        */
        try {
            validatePathParamTypes(expectedPathTypes, pathParams);
            searchParams = validateSearchParamTypes(expectedSearchParamType, searchParams);
            validateBodyFormat(schema, body);
        }
        catch (error) {
            console.log("error valdiating pathParams and SearchParamTypes", error.message);
            return { responseStatusCode: 400, responseBody: error.message };
        }
        try {

            switch (method) {
                case "GET"://call the handler and pass in the pathParams and handler
                    return await this[handler]({ pathParams, searchParams, user_id })//this is how you call a function of a class instance when that function is stored as a string
                case "POST":
                    return await this[handler]({ body })//create function
                case "DELETE":
                    return await this[handler]({ pathParams, user_id })
                case "PUT":
                    return await this[handler]({ body, pathParams, user_id })
                default:
                    console.log("request does not match a method in the user controller");
                    return { responseStatusCode: 405, responseBody: "Request does not match a method in the user controller" }

            }
        }
        catch (error) {
            console.log("Bad request", error)
            return errorToResponse(error, "Unexpected error in the user controller");
        }
    }

}

module.exports = UserController
