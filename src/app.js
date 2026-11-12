
//importing Pool and Client for db connection through the pg library for node-posgres connection
//this import uses these enviornment variable names to retrieve env variables:https://www.postgresql.org/docs/9.1/libpq-envars.html

// Load environment variables from .env file

require('dotenv').config();//this line loads the environemnt variables into process.env as an object



const DbPool = require('./DbPool');
const RedisConnection = require('./RedisConnector');
const { registerAllRoutes } = require("./Router");

const { server } = require("./server");
const createWebsocketServer = require("./WebsocketServer")
const { setRealtimePublisher } = require("./RealtimeNotifier");



// Stops the server at startup, with one clear message, if a required setting is missing or too weak.
// Without this a missing JWT_SECRET only showed up later as a confusing 500 on the first login,
// and a missing ALLOWED_HOSTS in production made every request fail the Host check
function validateEnvironment() {
    const required = ["PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE", "REDIS_URL", "JWT_SECRET", "CURSOR_SECRET", "PORT"];
    if (process.env.NODE_ENV === "production") {
        required.push("CORS_ORIGINS", "ALLOWED_HOSTS"); // locally these fall back to the localhost lists in SecurityHeaders.js
    }
    const missing = required.filter((name) => process.env[name] == null || process.env[name].trim() === "");
    if (missing.length > 0) {
        throw new Error(`Missing environment variables: ${missing.join(", ")}`); // only the names are printed, never values
    }
    // an HMAC secret shorter than this could be guessed by brute force, which would let someone forge login tokens
    for (const name of ["JWT_SECRET", "CURSOR_SECRET"]) {
        if (process.env[name].length < 32) {
            throw new Error(`${name} must be at least 32 characters long. Generate one with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`);
        }
    }
}

async function main() {
    validateEnvironment();
    //each pool will use environment variables for connection info
    DbPool.createPool();
    registerAllRoutes();
    server.listen(process.env.PORT, process.env.HOST);//make server start listening for connections

    //redis connection setup
    const redisConnection = new RedisConnection();
    await redisConnection.connectClient();//waits so websocket clients cannot connect before redis pub/sub is ready
    setRealtimePublisher(redisConnection);//lets HTTP controllers announce events such as a new room to live sockets

    createWebsocketServer(server, DbPool, redisConnection);
    console.log("Server is actively listening for connections");











}

main().catch((error) => {//without this a failed startup (for example redis being down) would be an unhandled rejection
    console.log("Server failed to start:", error);
    process.exit(1);
})

