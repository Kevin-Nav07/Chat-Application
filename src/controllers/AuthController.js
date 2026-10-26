const AuthService = require('../Services/AuthService');
const { validatePathParamTypes, validateSearchParamTypes, validateBodyFormat } = require('../helpers/APIValidator');
const { errorToResponse } = require('../helpers/ErrorExtensions');

class AuthController {

    #_service;
    constructor(connection) {
        this.#_service = new AuthService(connection);

    }

    //login Generate Refresh and access token
    //POST
    //tokens go into HttpOnly cookies so browser javascript can never read them (protects against XSS token theft),
    //the body only returns the public user info so the frontend knows who is logged in
    async login(body) { // expected body { username: "example", password: "example123" }
        try {
            const { username, password } = body; // extracts username and plaintext password from request payload
            const { tokens, user } = await this.#_service.login(username, password); // passes username and password to auth service
            return { responseStatusCode: 200, responseCookies: tokens, responseBody: { message: "Login successful", user } };
        }
        catch (error) {
            console.log(`Login error encountered: ${error}`);
            return errorToResponse(error, "Unexpected login error");//bad credentials come back as a 401 HttpError from the service
        }
    }

    //this method creates a new Access token by validating an incoming unhashed refreshToken and then creating a new access token and rotating the refresh token
    //POST
    async refresh(refreshToken) {
        try {
            const tokens = await this.#_service.refresh(refreshToken);
            return { responseStatusCode: 200, responseBody: "Tokens generated", responseCookies: tokens };
        }
        catch (error) {
            //a missing, unknown or expired refresh token is a 401 so the frontend knows to send the user back to the login page
            console.log(`Error refreshing tokens: ${error}`);
            return errorToResponse(error, "Error creating refresh token");
        }
    }

    //POST
    //deletes the refresh token from the database and tells the browser to delete both cookies
    async logout(refreshToken) {
        try {
            await this.#_service.logout(refreshToken);
            //empty values make setCookies send Max-Age=0, which makes the browser remove the cookies
            return { responseStatusCode: 200, responseBody: "Successfuly logged out", responseCookies: { accessToken: "", refreshToken: "" } };
        }
        catch (error) {
            console.log("Unexpected error during logout", error);
            return errorToResponse(error, "Failed logout");
        }
    }


    async handleRequest(method, body, searchParams, pathName, handler, pathParams, schema, expectedPathTypes, expectedSearchParamType, refreshToken) {
        /*
        every auth route is a POST. login reads the credentials from the body,
        refresh and logout read the refresh token that the router pulled out of the cookies
       */

        try {
            validatePathParamTypes(expectedPathTypes, pathParams);
            validateSearchParamTypes(expectedSearchParamType, searchParams);
            validateBodyFormat(schema, body);
        }
        catch (error) {
            console.log("error validating search or path paramaters", error);
            return { responseStatusCode: 400, responseBody: error.message };

        }

        try {
            if (method !== "POST") {
                return { responseStatusCode: 405, responseBody: "Request does not match a method in the auth controller" }
            }
            if (handler === "login") {
                return await this.login(body);
            }
            return await this[handler](refreshToken);//refresh and logout
        }
        catch (error) {
            console.log("Bad request", error)
            return errorToResponse(error, "Unexpected error in the auth controller");
        }

    }

}


module.exports = AuthController;
