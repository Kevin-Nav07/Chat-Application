//this will map user_id to websocket connections as well as rooms to websocket connections
const { WebSocket, WebSocketServer } = require('ws');
const { unpack, pack } = require('msgpackr');

/* THE CLASS WILL FULLFILL THESE FUNCTIONS

    -Store a map where the key's are room_ids and the values are SETS of active WS connections of users currently connected
    -Store a map where the key's are user_ids and the value is a set of room_ids for that user
    -When a new websocket connection is made to this server, we add it to the connection maps
    - When a web socket connection is removed, either voluntarily or forcibly, we remove all the pointers to the ws connection in both maps
    - When a message for a specific user or room comes in, we transmit the message to whoever needs it.
    -it will communicate with redis to either do db lookups or route messages to redis, or recieve newly transmited messages from redis.
    */
class WebsocketManager {

    #roomMap;
    #userMap;
    constructor() {
        this.#roomMap = new Map();
        this.#userMap = new Map();

    }

    addRoomsToUser(rooms, user_id) {//rooms has to be an iterable

        if (rooms == null || user_id == null) {
            throw new Error("could not add rooms to user");
        }
        if (this.#userMap.has(user_id)) {
            const roomSet = this.#userMap.get(user_id);
            for (const room of rooms) {
                roomSet.add(room?.id)//adding a duplicate room will cause the set to ignore duplicates, sets are unique values only
            }
        }
        else {
            this.#userMap.set(user_id, new Set());
            const roomSet = this.#userMap.get(user_id);
            for (const room of rooms) {
                roomSet.add(room?.id)//adding a duplicate room will cause the set to ignore duplicates, sets are unique values only
            }
        }
    }

    addConnectionToRooms(rooms, connection) {
        if (rooms == null || connection == null) {
            throw new Error("Error adding connection to rooms, paramater error");
        }
        for (const room of rooms) {
            this.addConnectionToRoom(room.id, connection)
        }
    }



    addConnectionToRoom(room_id, connection) {//check if a room exists, then check for a connection, and then add or do nothing

        if (room_id != null && Number.isFinite(room_id) && connection instanceof WebSocket)//check if room_id is a valid number and connection is WebSocket connection
        {
            if (this.#roomMap.has(room_id)) {//if the room exists in the map
                //check if the connection exists
                if (!this.#roomMap.get(room_id).has(connection)) {//does not have connection
                    //add connection to the set
                    this.#roomMap.get(room_id).add(connection);
                }
                else {//does have connection.
                    //do nothing?
                }
            }
            else {//room does not exist in the map
                //add room to the map and then add the connection
                this.#roomMap.set(room_id, new Set());
                this.#roomMap.get(room_id).add(connection);
            }
        }
        else {//if inputs are not valid
            throw new Error("Room_id or connection are not valid inputs");
        }
    }

    deleteConnectionInRoom(room_id, connection) {
        //standard deleting a connection in a room if it exists
        if (room_id != null && Number.isFinite(room_id) && connection instanceof WebSocket)//check if room_id is a valid number and connection is WebSocket connection
        {//valid inputs
            if (this.#roomMap.has(room_id)) {//check if the room exists then try to delete the reference
                this.#roomMap.get(room_id).delete(connection)
            }
        }
        else {
            throw new Error("Room_id or connection are not valid inputs");
        }
    }

    deleteUser(user_id, connection) {//connection is a pointer to an object
        //process deletes a user and all their connections
        //first delete the connections by going through all of the user rooms

        for (const room_id of this.#userMap.get(user_id)) {
            //delete each connection in each room
            this.deleteConnectionInRoom(room_id, connection);
            //if the room is empty delete the room from the map
            if (this.#roomMap.get(room_id).size === 0) {
                this.#roomMap.delete(room_id);
            }

        }

        //after deleting the connections delete the user_id from the usermap
        return this.#userMap.delete(user_id);

    }


    //given a room, we transmit a message to every ws connection in that room, besides the sending connection
    transmitMessageToRoom(room_id, message, wsConnection) {

        //check for valid inputs

        if (room_id != null && Number.isFinite(room_id) && message != null && wsConnection instanceof WebSocket) {
            //check for room existance, then transmit in room
            if (this.checkUserRoomMembership(wsConnection.user_id, room_id)) {//check if the user is in that room

                if (this.#roomMap.has(room_id)) {
                    //room exists, now we transmit
                    for (const con of this.#roomMap.get(room_id).keys()) {
                        if (con != null && con !== wsConnection && con instanceof WebSocket) {
                            this.sendMessage(con, room_id, message)
                        }
                    }
                }
            }
            else {//user is not in room
                throw new Error("User cannot send to that room");

            }

        }
        else {
            throw new Error("Room_id or connection are not valid inputs");
        }


    }


    checkUserRoomMembership(user_id, room_id) {
        //check if a user is in a room, T if in room,F if not
        if (this.#userMap.get(user_id)?.has(room_id)) {
            return true;
        }
        else {
            return false;
        }
    }


    display() {
        console.log("Room map size:", this.#roomMap.size);
        for (const [roomId, connections] of this.#roomMap) {
            // Extract user_ids from the connections Set/Array and join them with commas
            const userIds = Array.from(connections, (conn) => conn?.user_id).join(', ');
            console.log(`roomID: ${roomId} | ws id's: [ ${userIds} ]`);
        }

        console.log();
        console.log("USER MAP size:", this.#userMap.size);
        for (const [userId, roomIds] of this.#userMap) {
            // Convert the roomIds Set/Array to a clean comma-separated string
            const rooms = Array.from(roomIds).join(', ');
            console.log(`userId: ${userId} | roomIds: [ ${rooms} ]`);
        }
    }

    sendMessage(connection, room_id, messageContent) {
        //pack 
        //check for valid content
        if (room_id != null && Number.isFinite(room_id) && messageContent != null && connection instanceof WebSocket) {
            //parameters are valid, now pack them
            let data = { room_id: room_id, message: messageContent };
            // data = pack(data);
            connection.send(JSON.stringify(data));
        }
        else {
            console.log(`Could not send message to ${room_id}, to user ${connection?.user_id} of content ${messageContent}`)
        }

    }



}


module.exports = WebsocketManager;