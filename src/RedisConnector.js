const redis = require('redis')
const fs = require('node:fs');//for file reading


class RedisConnection {




    static redisClient
    #subscribeConnection

    constructor() {


        this.redisClient = redis.createClient({
            url: process.env.REDIS_URL,
            RESP: 3,
            socket: {

                tls: true,
                key: fs.readFileSync('certs/localhost+2-key.pem'),
                cert: fs.readFileSync('certs/localhost+2.pem'),

            },

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
        console.log("Subscribed");
        await this.#subscribeConnection.subscribe(`chat:room_${room_id}`, callback)
    }

    async publish(room_id, message, user_id) {
        console.log("Published to:", room_id, "Where message sent was: ", message)
        await this.redisClient.publish(`chat:room_${room_id}`, JSON.stringify({ room_id, message, user_id }));
    }

    async unsubscribe(room_id) {
        await this.#subscribeConnection.unsubscribe(`chat:room_${room_id}`);
    }


    async display() {
        console.log("Pub/sub hub active channels: ", await this.#subscribeConnection.pubSubChannels());                 // PUBSUB CHANNELS *
        // console.log("Pub/sub hub channel counts ", hub.channelSubscriberCounts(channels)); // PUBSUB NUMSUB ch1 ch2 ...

    }
}






module.exports = RedisConnection;