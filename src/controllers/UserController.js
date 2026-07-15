
const { validatePathParamTypes, validateBodyFormat, validateSearchParamTypes } = require("../helpers/APIValidator")


const UserService = require('../Services/UserService');
const { DatabaseError } = require("pg");


class UserController {

    _service//the service will handle database transactions, the controller will configure what gets sent through and handle the requests
    constructor(connection) {
        this._service = new UserService(connection)



    }


    async getUserAsync({ pathParams, searchParams }) {
        //first destructure and extract pathParams nd searchParams into variables



        try {
            console.log(pathParams, searchParams);
            const { id } = pathParams//destructurng over an object requires thi syntax
            //const [filter = null] = searchParams//destructuring over an iterable requires this syntax
            const { filter } = searchParams

            console.log(filter)
            console.log(id);
            const user = await this._service.getUserAsync(id);
            if (user === undefined || user === null) {
                return { responseStatusCode: 404, responseBody: "Could not find resource" }
            }
            else {
                return { responseStatusCode: 200, responseBody: user }
            }


        }
        catch (error) {
            if (error instanceof DatabaseError) {
                console.log(error)
                return { responseStatusCode: 500, responseBody: "error on the database level" }
            }
            else {
                console.log(error)
                return { responseStatusCode: 500, responseBody: "Unexpected server error encountered" }
            }

        }


    }
    async getUsersAsync({ searchParams }) {

        try {

            const { filter } = searchParams
            console.log(filter)
            const users = await this._service.GetUsersAsync(filter);
            if (Array.isArray(users) && users.length > 0) {//users is an array and users has a length greater than 1

                return { responseStatusCode: 200, responseBody: users };
            }
            else {//users is either not an array, or is an array with length ==0 

                return { responseStatusCode: 500, responseBody: "could not fetch all users" };

            }

        }
        catch (error) {
            console.log("Error encountered destructuring our paramaters", error);
            return { responseStatusCode: 500, responseBody: "Unexpected server error encountered" }
        }
    }





    async createUserAsync({ body }) {
        console.log(body);
        console.log("Inside create user");
        try {
            await this._service.createUserAsync(body);
            return { responseStatusCode: 201, responseBody: "Object successfully created" };
        }
        catch (error) {
            console.log(error)
            return { responseStatusCode: 500, responseBody: "Failed to create resource at the requested URL" };


        }
    }
    async deleteUserAsync({ pathParams }) {

        try {
            console.log(pathParams);
            const { id } = pathParams//destructurng over an object requires thi syntax

            console.log(id);
            await this._service.deleteUserAsync(id);
            return { responseStatusCode: 200, responseBody: "User deleted" };
        }
        catch (error) {

            console.log("Error encountered destructuring our paramaters", error);
            return { responseStatusCode: 500, responseBody: "Failed to delete resource at the requested URL" };
        }


    }

    async updateUserAsync({ pathParams, body }) {

        try {
            console.log(pathParams);
            const { id } = pathParams//destructurng over an object requires thi syntax



            console.log(id, body);
            await this._service.updateUserAsync(body, id);
            return { responseStatusCode: 200, responseBody: "updated user" };
        }
        catch (error) {
            console.log("Error encountered destructuring our paramaters", error);
            return { responseStatusCode: 500, responseBody: "faild to update user" };
        }

    }


    async handleRequest(method, body, searchParams, pathName, handler, pathParams, schema, expectedPathTypes, expectedSearchParamType) {
        //take the request and handle it by validating any relevant query paramaters or body if needed
        //we come in with a method,body(optional), searchParamaters(optional), pathName, handler, pathParams(optional)
        //we can either route by the method and then call the handler and pass in the appropriate paramaters.
        //how do we decide what to pass in. P
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
            searchParams = validateSearchParamTypes(expectedSearchParamType, searchParams);
            validateBodyFormat(schema, body);
            console.log("after search:", searchParams)

        }
        catch (error) {
            console.log("error valdiating pathParams and SearchParamTypes", error);
            return { responseStatusCode: 400, responseBody: error.message };


        }
        console.log("Path paramters are of valid type");
        try {

            switch (method) {
                case "GET"://call the handler and pass in the pathParams and handler
                    return this[handler]({ pathParams, searchParams })//this is how you call a function of a class instance when that function is stored as a string
                    break;
                case "POST":
                    return this[handler]({ body })//create function
                    break;
                case "DELETE":
                    //does not need body or searchParam validation
                    return this[handler]({ pathParams })
                    break;
                case "PUT":
                    return this[handler]({ body, pathParams })
                    break;
                default:
                    console.log("request does not match a method in the user controller");
                    return { responseStatusCode: 400, responseBody: "Request does not match a method in the user controller" }
                    break;

            }
        }
        catch (error) {
            console.log("Bad request", error)
            return { responseStatusCode: 500, responseBody: "Request does not match a method in the user controller" }
        }
    }


    // if (method.trim() === "GET") {
    //     if (searchParameters === undefined) {
    //         return await this.GetUserAsync()
    //     }
    //     else if (searchParameters.has("userid")) {




    //         return await this.GetUserAsync(searchParameters.get("userid"))
    //     }
    // }

}

module.exports = UserController