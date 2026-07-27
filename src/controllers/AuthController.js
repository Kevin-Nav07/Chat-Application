const { error } = require('ajv/dist/vocabularies/applicator/dependencies');
const AuthService = require('../Services/AuthService');
const { validatePathParamTypes, validateSearchParamTypes, validateBodyFormat } = require('../helpers/APIValidator');

class AuthController {

    #_service;
    constructor(connection) {
        this.#_service = new AuthService(connection);

    }

    //login Generate Refresh and access token
    //POST
    async login(body)//expected body {id: 21, password: example123}
    //try loggin in, if any error occurs throw a 500, but we can also have a custom error later down the line to simulate failed Logins
    {

        try {
            const { password, user_id } = body;
            if (password == null || user_id == null) {
                return { responseStatusCode: 400, responseBody: "Missing Password or User" };
            }
            const tokens = await this.#_service.login(user_id, password);
            return { responseStatusCode: 200, responseCookies: tokens, responseBody: "Login successful" };


        }
        catch (error) {

            //include custom messages for failed logins and other stuff
            console.log(`Unexpected error occured: ${error}`);
            return { responseStatusCode: 500, responseBody: "Unexpected logging in" }


        }


    }

    //this method creates a new Access token by validating an incoming unhashed refreshToken and then creating a new access token and rotating the refresh token
    //POST
    async refresh(refreshToken) {
        try {
            const tokens = await this.#_service.refresh(refreshToken);

        }
        catch (error) {
            //catch different error types like refresh token expired, refresh token malformed/incorrect
            console.log(`Unexpected erorr encountered: ${error}`);
            return { responseStatusCode: 500, responseBody: "Error creating refresh token" };
        }


    }
    //Refresh(generate new access token)
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


            }

        }
        catch (error) {
            console.log("Bad request", error)
            return { responseStatusCode: 500, responseBody: "Request does not match a method in the user controller" }

        }

    }

    //

}


module.exports = AuthController;