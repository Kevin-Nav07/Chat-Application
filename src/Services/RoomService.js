const UserService = require("./UserService")

class RoomService {

    #_dbClient  //I need a database client instance, what we can do is create an instance from the pool and pass it through
    constructor(connection) {
        this.#_dbClient = connection


    }



    async createRoomAsync(body) {
        const { room_type, name, users } = body
        const createdAt = Date.now()

        try {
            await this.#_dbClient.query('BEGIN')
            const roomValues = [room_type, name]
            let results = await this.#_dbClient.query(`INSERT INTO ROOMS (room_type,name) VALUES($1,$2) RETURNING id`, roomValues)//perform query with prepared statement
            //result variable stores the result object, which contains a lot of database information we can limit down to just the objects
            const roomId = results.rows[0].id;
            const roomMemberValues = [roomId, users, null]
            //in order to add multiple rows at the same time instead of Values(....) we use Select to basically
            //construct multiple rows or a table of rows in memory made up of the roomMemberValues
            //unnest allows us to take an array and then expand it into multiple rows
            //this alows for more efficient inserting than for of (rows)

            results = await this.#_dbClient.query((`INSERT INTO ROOM_MEMBERS (room_id, user_id, last_read_message_id) 
                SELECT $1,unnest($2::int[]), $3`), roomMemberValues)
            await this.#_dbClient.query('COMMIT')
            return results.rows//the array of objects we get back from the database
        }
        catch (exception) {
            console.log("Error occured when creating a Room: " + exception);
            await this.#_dbClient.query("ROLLBACK");//undoes everything from the transaction
            throw exception

        }
        finally {
            // this.#_dbClient.release()//releases the client/connection back into the connection pool to be used by others
        }

    }

    async getRoomsAsync(id) {//get all rooms, if there is a searchParamater for id specified, get all rooms given the id
        /*
        in this function we will get all room objcts that the given user of id is in. 
        a user is in a room if in the Room_members table, there is a row with user_id = id. So find all rows where user_id = id
        once we find all the room_id's we retrieve all rows from room table that have those room id's

        USE Join tables and indexes
        */

        try {
            await this.#_dbClient.query("BEGIN");

            let results;

            if (id !== null && id !== undefined) {//if id is not null we perform special sql
                results = await this.#_dbClient.query(`SELECT rooms.id, rooms.name,rooms.room_type, rooms.created_at FROM room_members JOIN rooms
ON rooms.id = room_members.room_id WHERE  room_members.user_id = $1`, [id]);
            }
            else {
                results = await this.#_dbClient.query(`SELECT * FROM ROOMS`);
            }
            await this.#_dbClient.query("COMMIT");
            return results.rows;
        }
        catch (error) {
            this.#_dbClient.query("ROLLBACK");
            throw error

        }
        finally {
            // this.#_dbClient.release();
        }


    }

    async getRoomAsync(id) {
        try {
            await this.#_dbClient.query("BEGIN");
            results = await this.#_dbClient.query(`SELECT * FROM ROOMS WHERE id=$1`, [id]);
            await this.#_dbClient.query("COMMIT");
            return results.rows;
        }
        catch (error) {
            this.#_dbClient.query("ROLLBACK");
            throw error
        }
        finally {
            // this.#_dbClient.release();
        }

    }








}
module.exports = RoomService;