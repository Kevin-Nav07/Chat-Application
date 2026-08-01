//this will map user_id to websocket connections as well as rooms to websocket connections
const { WebSocket, WebSocketServer } = require('ws');


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
        if (this.#userMap.has(user_id)) {
            roomSet = this.#userMap.get(user_id);
            for (const room of rooms) {
                roomSet.add(room)//adding a duplicate room will cause the set to ignore duplicates, sets are unique values only

            }
        }
    }

    removeUserInUser(userid) {

        this.#userMap.delete(userid);

    }

    addConnectionToRoom(room_id, connection) {//check if a room exists, then check for a connection, and then add or do nothing

        if (room_id != null && Number.isFinite(room_id) && connection instanceof WebSocket)//check if room_id is a valid number and connection is WebSocket connection
        {

            if (this.#roomMap.has(room)) {//if the room exists in the map
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
                this.#roomMap.delete(connection)

            }


        }
        else {
            throw new Error("Room_id or connection are not valid inputs");
        }



    }


    //given a room, we transmit a message to every ws connection in that room, besides the sending connection
    transmitMessageToRoom(room_id, message, wsConnection) {

        //check for valid inputs
        if (room_id != null && Number.isFinite(room_id) && message != null && wsConnection instanceof WebSocket) {
            //check for room existance, then transmit in room
            if (this.#roomMap.has(room_id)) {
                //room exists, now we transmit
                for (const con of this.#roomMap.get(room_id).keys()) {
                    if (con !== wsConnection) {
                        con.send(message);
                    }
                }
            }

        }
        else {
            throw new Error("Room_id or connection are not valid inputs");
        }


    }



}


module.exports = WebsocketManager;