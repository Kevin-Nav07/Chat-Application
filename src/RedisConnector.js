const { createClient } = require('redis')


class RedisConnection {




    static redisClient
    constructor() {
        this.redisClient = createClient({ url: process.env.REDIS_URL });


        this.redisClient.on('error', (error) => {
            console.log("Encountered error connecting to redis, ", error);
        });


    }

    async connectClient() {
        await this.redisClient.connect();
        console.log("Redis connected successfully")
    }

    async testConnection() {
        await this.redisClient.set("kevon", "214");
        return await this.redisClient.get("kevon");
    }
}






module.exports = RedisConnection;