const redis = require('redis')
const fs = require('node:fs');//for file reading


class RedisConnection {




    static redisClient
    #subscribeConnection

    constructor() {


        // The local certificate files are only attached when they exist. They are gitignored, so on a hosting
        // platform they are missing, and reading them unconditionally crashed the server at startup
        const socketOptions = { tls: true };
        const keyPath = process.env.TLS_KEY_PATH || 'certs/localhost+2-key.pem';
        const certPath = process.env.TLS_CERT_PATH || 'certs/localhost+2.pem';
        if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
            socketOptions.key = fs.readFileSync(keyPath);
            socketOptions.cert = fs.readFileSync(certPath);
        }

        this.redisClient = redis.createClient({
            url: process.env.REDIS_URL,
            RESP: 3,
            socket: socketOptions,
        })



        this.redisClient.on('error', (error) => {
            console.log("Encountered error connecting to redis, ", error);
        });


    }

    async connectClient() {

        this.#subscribeConnection = this.redisClient.duplicate();

        await Promise.all([
            this.redisClient.connect(),
            this.#subscribeConnection.connect()


        ]);


        console.log("Redis connected successfully")
    }

    async testConnection() {
        await this.redisClient.set("kevon", "214");
        return await this.redisClient.get("kevon");
    }

    async subscribe(room_id, callback) {//subscribe our server to the channel with room_id to listen to anything that comes through for that room
        await this.#subscribeConnection.subscribe(`chat:room_${room_id}`, callback)
    }

    async publish(room_id, message, user_id) {
        await this.redisClient.publish(`chat:room_${room_id}`, JSON.stringify({ room_id, message, user_id }));
    }

    async unsubscribe(room_id) {
        await this.#subscribeConnection.unsubscribe(`chat:room_${room_id}`);
    }

    //each user also gets a personal channel. Events that are about a user rather than a room, such as
    //"you were added to a new room", are published here so every server holding that user's sockets hears it
    async subscribeUser(user_id, callback) {
        await this.#subscribeConnection.subscribe(`chat:user_${user_id}`, callback);
    }

    async publishToUser(user_id, event) {
        await this.redisClient.publish(`chat:user_${user_id}`, JSON.stringify(event));
    }

    async unsubscribeUser(user_id) {
        await this.#subscribeConnection.unsubscribe(`chat:user_${user_id}`);
    }


    async display() {
        console.log("Pub/sub hub active channels: ", await this.#subscribeConnection.pubSubChannels());                 // PUBSUB CHANNELS *
        // console.log("Pub/sub hub channel counts ", hub.channelSubscriberCounts(channels)); // PUBSUB NUMSUB ch1 ch2 ...

    }
}






module.exports = RedisConnection;