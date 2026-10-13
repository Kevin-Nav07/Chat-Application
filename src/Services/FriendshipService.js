const UserService = require('./UserService');

class FriendshipService {
    #_dbClient // database connection instance

    constructor(connection) {
        this.#_dbClient = connection;
    }

    // creates a friend request
    async createFriendRequest(sender_id, receiver_id) {
        try {
            if (sender_id == null || receiver_id == null) {
                throw new Error("id's are null");
            }
            if (receiver_id == sender_id) {
                throw new Error("sender and receiver cannot be the same");
            }
            const userService = new UserService(this.#_dbClient);
            const user = await userService.getUserAsync(receiver_id);
            if (user == null) {
                throw new Error("reciever is not a valid user");
            }

            this.#_dbClient.query("BEGIN");

            this.#_dbClient.query("INSERT INTO friendships(sender_id,receiver_id,created_at,updated_at) VALUES ($1,$2,$3,$4)",
                [sender_id, receiver_id]
            );
            this.#_dbClient.query("COMMIT");
        }
        catch (eror) {
            this.#_dbClient.query("ROLLBACK");
            throw error;
        }
    }

    // retrieves requests or friends based on status
    async getFriendRequests(user_id, status) {
        try {
            await this.#_dbClient.query("BEGIN");
            if (user_id == null) {
                throw new Error("token did not extract user id")
            }
            await this.#_dbClient.query("SELECT * ")



            // Write logic here

            await this.#_dbClient.query("COMMIT");
            return;
        }
        catch (error) {
            await this.#_dbClient.query("ROLLBACK");
            throw error;
        }
    }

    // accepts an existing request
    async acceptFriendRequest(request_id, user_id) {
        try {
            if (request_id == null || user_id == null) {
                throw new Error("request id is null");
            }
            await this.#_dbClient.query("BEGIN");

            const result = await this.#_dbClient.query("UPDATE friendships SET status=$1 WHERE receiver_id=$2 AND id=$3 AND status=$4", ["accepted", user_id, request_id, "pending"]);

            if (result.rowCount == 0) {
                throw new Error("could not find friend request to accept");
            }
            if (result.rowCount == 0) {
                throw new Error("could not find friendship to delete or unauthorized");
            }
            await this.#_dbClient.query("COMMIT");
            return
        }
        catch (error) {
            await this.#_dbClient.query("ROLLBACK");
            throw error;
        }
    }

    // deletes or declines a request
    async deleteFriendRequest(request_id, user_id) {

        try {
            if (request_id == null || user_id == null) {
                throw new Error("request or user id was null when deleting friendship ");

            }
            await this.#_dbClient.query("BEGIN");


            const reuslt = await this.#_dbClient.query("DELETE FROM friendships WHERE id=$1 AND (receiver_id=$2 OR sender_id =$2)",
                [request_id, user_id]);



            await this.#_dbClient.query("COMMIT");
            return;
        }
        catch (error) {
            await this.#_dbClient.query("ROLLBACK");
            throw error;
        }
    }
}

module.exports = FriendshipService;
