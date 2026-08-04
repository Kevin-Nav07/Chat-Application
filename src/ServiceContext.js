const AuthService = require('./Services/AuthService');
const RoomService = require('./Services/RoomService');
const UserService = require('./Services/UserService');

class ServiceContext {
    #_dbClient;
    #_dbPool;

    constructor(pool) {
        this.#_dbPool = pool;
    }

    static async create(pool) {
        const context = new ServiceContext(pool);
        context.#_dbClient = await pool.provideClient()
        return context;
    }

    createUserService() {
        return new UserService(this.#_dbClient);
    }

    createRoomService() {
        return new RoomService(this.#_dbClient);
    }

    createAuthService() {
        return new AuthService(this.#_dbClient);
    }

    async close() {
        if (this.#_dbClient) {
            this.#_dbClient.release();
        }
    }

    async callServiceMethod(service, callback) {
        if (!this.#_dbClient) {
            return null;
        }
        try {

            return await callback(service)

        }
        catch (error) {
            console.log("error recieved", error);
            this.close()
            throw error

        }

    }
}

module.exports = ServiceContext;