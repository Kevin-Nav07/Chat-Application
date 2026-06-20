const { APIValidator, } = require("../helpers/APIValidator")
const { createUserPathParams, checkValidMethod } = require("../Models/PathParamaters")


class UserController {

    //I need a database client instance, what we can do is create an instance from the pool and pass it through
    _client
    constructor(connection) {
        this._client = connection


    }



    async handleRequest(method, body, searchParameters, pathName, handler, pathParams) {
        //take the request and handle it by validating any relevant query paramaters or body if needed
        console.log("Handling request");

        try {

            switch (method) {
                case "GET":


                    break;
                case "POST":
                    const validator = new APIValidator(createUserPathParams, "createUserSchema")//this basically has two validation functions that checks the search paramaters
                    //as well as the body structure and checks according to our models if they are of the expected format
                    if (validator.validateQueryParamaters(searchParameters) && validator.validateBodyFormat(body) && checkValidMethod(method)) {//if body and search params are of the expected 

                    }
                    break;
                case "DELETE":
                    break;
                case "PUT":
                    break;
            }
        }
        catch (error) {
            return "Bad Request"
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




    async GetUserAsync(userid) {
        try {
            await this._client.query('BEGIN')
            let result = await this._client.query('SELECT * FROM USERS WHERE userid=$1', [userid])//perform query with prepared statement
            //result variable stores the result object, which contains a lot of database information we can limit down to just the objects
            await this._client.query('COMMIT')
            return result.rows//the array of objects we get back from the database
        }
        catch (exception) {
            console.log("Error occured when retrieving user: " + exception);
            await this._client.query("ROLLBACK");//undoes everything from the transaction
            throw exception

        }
        finally {

            this._client.release()//releases the client/connection back into the connection pool to be used by others

        }






    }
    GetUsersAsync() {

    }

    CreateUserAsync() {

    }
}

module.exports = UserController