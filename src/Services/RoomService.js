const { HttpError, PG_FOREIGN_KEY_VIOLATION } = require("../helpers/ErrorExtensions")

class RoomService {

    #_dbClient  //I need a database client instance, what we can do is create an instance from the pool and pass it through
    constructor(connection) {
        this.#_dbClient = connection


    }


    //creates a room and its members in one transaction. The creator is always added as a member,
    //so a user can never create a room they are not part of
    async createRoomAsync(body, creator_id) {
        const { room_type, name, users } = body
        const members = [...new Set([creator_id, ...users])]//a Set drops duplicates, for example if the creator also listed themselves

        if (members.length < 2) {
            throw new HttpError(400, "A room needs at least one other member besides the creator");
        }
        if (room_type === "direct" && members.length !== 2) {
            throw new HttpError(400, "A direct room must have exactly two members");
        }

        try {
            await this.#_dbClient.query('BEGIN')
            const roomValues = [room_type, name]
            let results = await this.#_dbClient.query(`INSERT INTO ROOMS (room_type,name) VALUES($1,$2) RETURNING id, room_type, name, created_at`, roomValues)//perform query with prepared statement
            //result variable stores the result object, which contains a lot of database information we can limit down to just the objects
            const room = results.rows[0];
            const roomMemberValues = [room.id, members, null]
            //in order to add multiple rows at the same time instead of Values(....) we use Select to basically
            //construct multiple rows or a table of rows in memory made up of the roomMemberValues
            //unnest allows us to take an array and then expand it into multiple rows
            //this alows for more efficient inserting than for of (rows)

            await this.#_dbClient.query((`INSERT INTO ROOM_MEMBERS (room_id, user_id, last_read_message_id)
                SELECT $1,unnest($2::int[]), $3`), roomMemberValues)
            await this.#_dbClient.query('COMMIT')
            return { ...room, members }
        }
        catch (exception) {
            console.log("Error occured when creating a Room: " + exception);
            await this.#_dbClient.query("ROLLBACK");//undoes everything from the transaction
            if (exception.code === PG_FOREIGN_KEY_VIOLATION) {//room_members.user_id points at users.id, so an unknown id breaks the foreign key
                throw new HttpError(400, "One or more users do not exist");
            }
            throw exception

        }

    }

    //returns every room the given user is a member of, each with its newest message as last_message (null for an empty room).
    //rooms are ordered by latest activity: the newest message, or the creation time for a room with no messages,
    //so the list order after a page reload matches the live reordering the frontend does when a message arrives
    async getRoomsAsync(user_id) {
        /*
        a user is in a room if in the Room_members table, there is a row with user_id = id.
        LEFT JOIN LATERAL runs the inner query once per room, so it can pick that room's single newest message.
        LEFT keeps rooms that have no messages yet, with null for last_message
        */
        const results = await this.#_dbClient.query(`
            SELECT rooms.id, rooms.name, rooms.room_type, rooms.created_at,
                   CASE WHEN latest.id IS NULL THEN NULL ELSE json_build_object(
                       'id', latest.id,
                       'room_id', latest.room_id,
                       'sender_id', latest.user_id,
                       'sender_username', latest.sender_username,
                       'content', latest.content,
                       'message_type', latest.message_type,
                       'created_at', latest.created_at
                   ) END AS last_message
            FROM room_members
            JOIN rooms ON rooms.id = room_members.room_id
            LEFT JOIN LATERAL (
                SELECT messages.*, users.username AS sender_username
                FROM messages
                JOIN users ON users.id = messages.user_id
                WHERE messages.room_id = rooms.id
                ORDER BY messages.created_at DESC, messages.id DESC
                LIMIT 1
            ) latest ON true
            WHERE room_members.user_id = $1
            ORDER BY COALESCE(latest.created_at, rooms.created_at) DESC, rooms.id DESC`, [user_id]);
        return results.rows;
    }

    //returns only the ids of every room the user is in. The websocket server uses this on connect,
    //because it only needs ids and the full rooms query above does extra work per room
    async getRoomIdsForUserAsync(user_id) {
        const results = await this.#_dbClient.query("SELECT room_id FROM room_members WHERE user_id = $1", [user_id]);
        return results.rows.map((row) => row.room_id);
    }

    //cursor based pagination of a user's rooms, newest first. id and created_at come from the previous page's cursor.
    //cursor_created_at is the exact timestamp as text: a javascript Date only keeps milliseconds but postgres keeps
    //microseconds, so building the next cursor from a Date could skip rooms created within the same millisecond
    async getRoomsPerUserAsync(user_id, id, created_at, limit) {

        try {
            let result;
            if (limit == null) {
                limit = 2

            }
            if (id == null || created_at == null) {//if there was no cursor
                const values = [user_id, limit];

                result = await this.#_dbClient.query("SELECT rooms.id, rooms.name,rooms.room_type, rooms.created_at, rooms.created_at::text AS cursor_created_at \
                 FROM room_members JOIN rooms ON rooms.id = room_members.room_id WHERE  room_members.user_id=($1)  \
                ORDER BY rooms.created_at DESC, rooms.id DESC LIMIT $2", values);


            }
            else {
                const values = [user_id, created_at, id, limit]
                result = await this.#_dbClient.query("SELECT rooms.id, rooms.name,rooms.room_type, rooms.created_at, rooms.created_at::text AS cursor_created_at \
                 FROM room_members JOIN rooms ON rooms.id = room_members.room_id WHERE  room_members.user_id=($1) AND (rooms.created_at,rooms.id)<($2::timestamptz,$3) \
                ORDER BY rooms.created_at DESC, rooms.id DESC LIMIT $4", values);
            }


            return result.rows;

        }
        catch (error) {
            console.log("encountered error", error)

            throw error;
        }



    }

    async getRoomAsync(id) {
        const results = await this.#_dbClient.query(`SELECT * FROM ROOMS WHERE id=$1`, [id]);
        return results.rows[0];
    }

}
module.exports = RoomService;
