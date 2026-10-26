// imports the UserService class to look up and verify users in the database
const UserService = require('./UserService');
// imports the HttpError class so business rule failures carry the right status code back to the controller
const { HttpError } = require('../helpers/ErrorExtensions');

class FriendshipService {
    // private field storing the active postgres client connection passed from the pool
    #_dbClient

    // constructor assigns the database connection client to the private member
    constructor(connection) {
        this.#_dbClient = connection;
    }

    // creates a new pending friend request between two users
    async createFriendRequest(sender_id, receiver_id) {
        try {
            // checks that both user IDs are present before proceeding
            if (sender_id == null || receiver_id == null) {
                throw new HttpError(400, "Sender and receiver IDs are required");
            }
            // prevents a user from sending a friend request to their own account
            if (receiver_id === sender_id) {
                throw new HttpError(400, "Sender and receiver cannot be the same user");
            }

            // instantiates user service using the same connection to verify recipient existence
            const userService = new UserService(this.#_dbClient);
            const user = await userService.getUserAsync(receiver_id);
            // throws an error if no user was found matching the receiver ID
            if (!user) {
                throw new HttpError(404, "Receiver is not a valid user");
            }

            // starts a database transaction to ensure atomicity
            await this.#_dbClient.query("BEGIN");

            // looks for any existing request between the two users in either direction, because the table has no
            // unique constraint on the pair. If B already sent A a request, A should accept that one instead of sending a new one
            const existing = await this.#_dbClient.query(
                `SELECT id, status FROM friendships
                 WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)
                 LIMIT 1`,
                [sender_id, receiver_id]
            );
            if (existing.rowCount > 0) {
                throw new HttpError(409, `A friendship between these users already exists with status ${existing.rows[0].status}`);
            }

            // inserts the friendship row and returns the created row using RETURNING clause
            const insertQuery = `
                INSERT INTO friendships (sender_id, receiver_id, status)
                VALUES ($1, $2, 'pending')
                RETURNING *
            `;
            // executes the parameterized insert query safely to prevent SQL injection
            const result = await this.#_dbClient.query(insertQuery, [sender_id, receiver_id]);

            // commits the transaction so the change becomes permanent
            await this.#_dbClient.query("COMMIT");
            // returns the newly created friendship row back to the caller
            return result.rows[0];
        }
        catch (error) {
            // rolls back any changes made during the transaction if an error occurs
            await this.#_dbClient.query("ROLLBACK");
            // rethrows the error for the controller to catch and return proper status code
            throw error;
        }
    }

    // retrieves friend requests or friends based on status filter
    async getFriendRequests(user_id, status = 'pending') {
        try {
            // verifies that the authenticated user id is present
            if (user_id == null) {
                throw new HttpError(400, "User ID is required");
            }

            // begins a database transaction for the read operation
            await this.#_dbClient.query("BEGIN");

            // joins the users table so the query returns profile usernames instead of only raw IDs
            const queryText = `
                SELECT 
                    f.id AS request_id,
                    f.status,
                    f.created_at,
                    u.id AS other_user_id,
                    u.username AS other_username,
                    CASE 
                        WHEN f.sender_id = $1 THEN 'outgoing'
                        ELSE 'incoming'
                    END AS direction
                FROM friendships f
                INNER JOIN users u ON u.id = (
                    CASE 
                        WHEN f.sender_id = $1 THEN f.receiver_id 
                        ELSE f.sender_id 
                    END
                )
                WHERE f.status = $2 
                  AND (f.sender_id = $1 OR f.receiver_id = $1)
                ORDER BY f.created_at DESC
            `;

            // binds user_id and status to parameterized query placeholders
            const result = await this.#_dbClient.query(queryText, [user_id, status]);

            // commits the transaction to conclude the database operation
            await this.#_dbClient.query("COMMIT");
            // returns the array of friendship records with joined usernames
            return result.rows;
        }
        catch (error) {
            // rolls back the transaction in case of any database error
            await this.#_dbClient.query("ROLLBACK");
            // passes the error up to the controller layer
            throw error;
        }
    }

    // accepts an existing pending request if the caller is the recipient
    async acceptFriendRequest(request_id, user_id) {
        try {
            // ensures both request ID and user ID are provided
            if (request_id == null || user_id == null) {
                throw new HttpError(400, "Request ID and User ID are required");
            }

            // begins transaction before running update query
            await this.#_dbClient.query("BEGIN");

            // updates status to accepted only if caller is the intended recipient of a pending request
            const updateQuery = `
                UPDATE friendships 
                SET status = $1, updated_at = NOW() 
                WHERE id = $2 AND receiver_id = $3 AND status = $4
                RETURNING *
            `;
            // binds parameters: status value, request id, caller id as receiver, and required pending status
            const result = await this.#_dbClient.query(updateQuery, [
                "accepted",
                request_id,
                user_id,
                "pending"
            ]);

            // checks if no row was updated, meaning request does not exist or caller is not the receiver.
            // both cases return 404 on purpose so a stranger cannot find out whether a request id exists
            if (result.rowCount === 0) {
                throw new HttpError(404, "Could not find a pending friend request to accept");
            }

            // commits the update transaction
            await this.#_dbClient.query("COMMIT");
            // returns the updated friendship record containing the new accepted status
            return result.rows[0];
        }
        catch (error) {
            // rolls back transaction on any failure
            await this.#_dbClient.query("ROLLBACK");
            // rethrows the caught error
            throw error;
        }
    }

    // deletes, declines, or cancels a friendship record
    async deleteFriendRequest(request_id, user_id) {
        try {
            // verifies both request ID and user ID exist before querying
            if (request_id == null || user_id == null) {
                throw new HttpError(400, "Request ID and User ID are required");
            }

            // starts transaction for deletion
            await this.#_dbClient.query("BEGIN");

            // deletes row only if caller is part of the relationship as either sender or receiver
            const deleteQuery = `
                DELETE FROM friendships 
                WHERE id = $1 AND (receiver_id = $2 OR sender_id = $2)
            `;
            // executes delete query with request id and caller user id
            const result = await this.#_dbClient.query(deleteQuery, [request_id, user_id]);

            // throws error if no rows were deleted because record was missing or caller was unauthorized
            // 404 for the same reason as accepting, it hides whether the id exists from people outside the friendship
            if (result.rowCount === 0) {
                throw new HttpError(404, "Could not find friendship to delete");
            }

            // commits the deletion to the database
            await this.#_dbClient.query("COMMIT");
            // returns a confirmation object indicating successful deletion
            return { message: "Friendship removed successfully" };
        }
        catch (error) {
            // rolls back transaction on error
            await this.#_dbClient.query("ROLLBACK");
            // rethrows error up to controller
            throw error;
        }
    }
}

// exports the FriendshipService class for use in controllers
module.exports = FriendshipService;
