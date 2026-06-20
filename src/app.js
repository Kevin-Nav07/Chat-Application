
//importing Pool and Client for db connection through the pg library for node-posgres connection
//this import uses these enviornment variable names to retrieve env variables:https://www.postgresql.org/docs/9.1/libpq-envars.html

// Load environment variables from .env file

require('dotenv').config();//this line loads the environemnt variables into process.env as an object


const http = require('node:http');//importing http module from node
const DbPool = require('./DbPool');
const { registerAllRoutes } = require("./Router");

const { server } = require("./server");

const Ajv = require("ajv")
const ajv = new Ajv({ coerceTypes: true })//schema validaiton library
//coercetypes allows for type conversion for string to integer
const { createsUserSchema } = require('./Models/Schemas')


function main() {
    //each pool will use environment variables for connection info
    DbPool.createPool();
    registerAllRoutes();
    server.listen(process.env.PORT, process.env.HOST);//make server start listening for connections
    console.log("Server is actively listening for connections");


}

main()

