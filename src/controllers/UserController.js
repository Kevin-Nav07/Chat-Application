const { validateAdditionalItems } = require("ajv/dist/vocabularies/applicator/additionalItems");
const { validatePathParamTypes, APIValidator } = require("../helpers/APIValidator")
const { getUserQueryParams, getUsersQueryParams } = require("../Models/QueryParamaters")

const UserService = require('../Services/UserService');
const { DatabaseError } = require("pg");
const { ValidationError } = require("ajv");


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
            const [filter = null] = searchParams//destructuring over an iterable requires this syntax

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

            const [filter = null] = searchParams
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


    async handleRequest(method, body, searchParams, pathName, handler, pathParams, schema, expectedPathTypes) {
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

            let validator
            console.log("before:", pathParams)
            validatePathParamTypes(expectedPathTypes, pathParams);
            console.log("after: ", pathParams)

            console.log("Path paramters are of valid type");
            switch (method) {
                case "GET"://call the handler and pass in the pathParams and handler

                    if (pathParams === null || pathParams === undefined) {
                        validator = new APIValidator(getUsersQueryParams)
                    }
                    else {
                        validator = new APIValidator(getUserQueryParams)
                    }

                    if (validator.validateQueryParamaters(searchParams)) {
                        return this[handler]({ pathParams, searchParams })//this is how you call a function of a class instance when that function is stored as a string
                    }


                    break;
                case "POST":
                    validator = new APIValidator(null, schema)//this basically has two validation functions that checks the search paramaters
                    //as well as the body structure and checks according to our models if they are of the expected format
                    if (validator.validateBodyFormat(body)) {//if body and search params are of the expected 
                        return this[handler]({ body })//create function
                    }
                    else {
                        return { responseStatusCode: 400, responseBody: "Body not of correct format" };
                    }

                    break;
                case "DELETE":
                    //does not need body or searchParam validation
                    return this[handler]({ pathParams })

                    break;
                case "PUT":
                    validator = new APIValidator(null, schema)
                    if (validator.validateBodyFormat(body)) {
                        return this[handler]({ body, pathParams })
                    }
                    break;
                default:
                    console.log("request does not match a method in the user controller");
                    break;

            }
        }
        catch (error) {
            console.log("Bad request", error)
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