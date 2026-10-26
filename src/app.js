
//importing Pool and Client for db connection through the pg library for node-posgres connection
//this import uses these enviornment variable names to retrieve env variables:https://www.postgresql.org/docs/9.1/libpq-envars.html

// Load environment variables from .env file

require('dotenv').config();//this line loads the environemnt variables into process.env as an object



const DbPool = require('./DbPool');
const RedisConnection = require('./RedisConnector');
const { registerAllRoutes } = require("./Router");

const { server } = require("./server");
const createWebsocketServer = require("./WebsocketServer")



async function main() {
    //each pool will use environment variables for connection info
    DbPool.createPool();
    registerAllRoutes();
    server.listen(process.env.PORT, process.env.HOST);//make server start listening for connections

    //redis connection setup
    const redisConnection = new RedisConnection();
    await redisConnection.connectClient();//waits so websocket clients cannot connect before redis pub/sub is ready

    createWebsocketServer(server, DbPool, redisConnection);
    console.log("Server is actively listening for connections");











}

main().catch((error) => {//without this a failed startup (for example redis being down) would be an unhandled rejection
    console.log("Server failed to start:", error);
    process.exit(1);
})

