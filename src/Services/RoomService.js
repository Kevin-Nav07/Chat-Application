const { HttpError, PG_FOREIGN_KEY_VIOLATION } = require("../helpers/ErrorExtensions")

// The name a room is shown under, as a SQL expression for a query where $1 is the id of the person looking.
// A group shows its own name. A direct room has no stored name; each member sees the OTHER member's username,
// so Alex sees "sam" and Sam sees "alex". If the other person deleted their account the room says so
const ROOM_DISPLAY_NAME_SQL = `
    CASE WHEN rooms.room_type = 'direct' THEN COALESCE((
        SELECT u.username FROM room_members other
        JOIN users u ON u.id = other.user_id
        WHERE other.room_id = rooms.id AND other.user_id <> $1
        LIMIT 1
    ), 'Deleted account') ELSE rooms.name END`;

class RoomService {

    #_dbClient  //I need a database client instance, what we can do is create an instance from the pool and pass it through
    constructor(connection) {
        this.#_dbClient = connection


    }


    //creates a room and its members in one transaction. The creator is always added as a member,
    //so a user can never create a room they are not part of.
    //
    //Every other member must be an accepted friend of the creator. Without this check anyone could put any stranger
    //into a room and message them, and the only way out would be deleting their account.
    //
    //A direct room is unique per pair of people: asking for one that already exists returns the existing room
    //instead of a second copy, which is what the "Message" button on a friend relies on.
    //
    //Returns { room, members, created, nameByMember }:
    //  room          the room as the creator sees it (same shape as GET /rooms, without last_message)
    //  members       every member's id, including the creator
    //  created       false when an existing direct room was returned, so the caller does not announce it again
    //  nameByMember  for a direct room, the name each member sees it under, keyed by member id
    async createRoomAsync(body, creator_id) {
        const { room_type, users } = body
        const name = typeof body.name === "string" ? body.name.trim() : ""
        const members = [...new Set([creator_id, ...users])]//a Set drops duplicates, for example if the creator also listed themselves
        const otherMembers = members.filter((id) => id !== creator_id)

        if (otherMembers.length < 1) {
            throw new HttpError(400, "A room needs at least one other member besides the creator");
        }
        if (room_type === "direct" && members.length !== 2) {
            throw new HttpError(400, "A direct room must have exactly two members");
        }
        if (room_type === "group" && name.length === 0) {
            throw new HttpError(400, "A group needs a name");
        }

        try {
            await this.#_dbClient.query('BEGIN')

            //keeps only the requested members who are accepted friends of the creator, in either direction of the request.
            //a user id that does not exist simply is not anybody's friend, so it fails this check too
            const friendResult = await this.#_dbClient.query(
                `SELECT u.id, u.username FROM users u
                 WHERE u.id = ANY($2::int[])
                   AND EXISTS (
                       SELECT 1 FROM friendships f
                       WHERE f.status = 'accepted'
                         AND ((f.sender_id = $1 AND f.receiver_id = u.id) OR (f.receiver_id = $1 AND f.sender_id = u.id))
                   )`,
                [creator_id, otherMembers]
            );
            if (friendResult.rowCount !== otherMembers.length) {
                throw new HttpError(403, "You can only add your friends to a room");
            }

            let nameByMember = null;
            if (room_type === "direct") {
                const friend = friendResult.rows[0];
                const creatorResult = await this.#_dbClient.query("SELECT username FROM users WHERE id = $1", [creator_id]);
                nameByMember = { [creator_id]: friend.username, [friend.id]: creatorResult.rows[0]?.username ?? "Deleted account" };

                //locks this pair of people until the transaction ends, so two clicks at the same moment cannot both
                //see "no room yet" and create two. The smaller id goes first so both people ask for the same lock
                await this.#_dbClient.query(
                    "SELECT pg_advisory_xact_lock(LEAST($1::int, $2::int), GREATEST($1::int, $2::int))",
                    [creator_id, friend.id]
                );
                const existing = await this.#_dbClient.query(
                    `SELECT rooms.id, rooms.room_type, rooms.created_at FROM rooms
                     JOIN room_members mine ON mine.room_id = rooms.id AND mine.user_id = $1
                     JOIN room_members theirs ON theirs.room_id = rooms.id AND theirs.user_id = $2
                     WHERE rooms.room_type = 'direct'
                     ORDER BY rooms.id
                     LIMIT 1`,
                    [creator_id, friend.id]
                );
                if (existing.rowCount > 0) {
                    await this.#_dbClient.query('COMMIT')//nothing was written, this only releases the lock
                    const room = { ...existing.rows[0], name: friend.username };
                    return { room, members, created: false, nameByMember };
                }
            }

            //a direct room stores no name of its own, see ROOM_DISPLAY_NAME_SQL
            const storedName = room_type === "direct" ? null : name;
            let results = await this.#_dbClient.query(`INSERT INTO ROOMS (room_type,name) VALUES($1,$2) RETURNING id, room_type, name, created_at`, [room_type, storedName])//perform query with prepared statement
            //result variable stores the result object, which contains a lot of database information we can limit down to just the objects
            const room = results.rows[0];
            if (room_type === "direct") {
                room.name = nameByMember[creator_id]; //the creator sees the friend's username
            }
            const roomMemberValues = [room.id, members, null]
            //in order to add multiple rows at the same time instead of Values(....) we use Select to basically
            //construct multiple rows or a table of rows in memory made up of the roomMemberValues
            //unnest allows us to take an array and then expand it into multiple rows
            //this alows for more efficient inserting than for of (rows)

            await this.#_dbClient.query((`INSERT INTO ROOM_MEMBERS (room_id, user_id, last_read_message_id)
                SELECT $1,unnest($2::int[]), $3`), roomMemberValues)
            await this.#_dbClient.query('COMMIT')
            return { room, members, created: true, nameByMember }
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
            SELECT rooms.id, ${ROOM_DISPLAY_NAME_SQL} AS name, rooms.room_type, rooms.created_at,
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

                result = await this.#_dbClient.query(`SELECT rooms.id, ${ROOM_DISPLAY_NAME_SQL} AS name, rooms.room_type, rooms.created_at, rooms.created_at::text AS cursor_created_at
                 FROM room_members JOIN rooms ON rooms.id = room_members.room_id WHERE room_members.user_id=($1)
                 ORDER BY rooms.created_at DESC, rooms.id DESC LIMIT $2`, values);


            }
            else {
                const values = [user_id, created_at, id, limit]
                result = await this.#_dbClient.query(`SELECT rooms.id, ${ROOM_DISPLAY_NAME_SQL} AS name, rooms.room_type, rooms.created_at, rooms.created_at::text AS cursor_created_at
                 FROM room_members JOIN rooms ON rooms.id = room_members.room_id WHERE room_members.user_id=($1) AND (rooms.created_at,rooms.id)<($2::timestamptz,$3)
                 ORDER BY rooms.created_at DESC, rooms.id DESC LIMIT $4`, values);
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
