// Maps user IDs and room IDs to active WebSocket connections and handles pub/sub routing
const { WebSocket } = require('ws');
// const { unpack, pack } = require('msgpackr'); // msgpack commented out in favor of JSON-only messaging

class WebsocketManager {
    #roomMap; // stores room_id -> Set of active WebSocket connections
    #userMap; // stores user_id -> Set of room_ids for that user
    #redisConnector; // handles cross-server pub/sub message broadcasting

    constructor(redisConnector) {
        this.#roomMap = new Map(); // initializes map of active room connections
        this.#userMap = new Map(); // initializes map of user room memberships
        this.#redisConnector = redisConnector; // stores redis connector instance
    }

    // Registers a list of rooms for a specific user ID
    addRoomsToUser(rooms, user_id) {
        if (rooms == null || user_id == null) {
            throw new Error("Could not add rooms to user: invalid parameters"); // ensures valid inputs
        }
        if (!this.#userMap.has(user_id)) {
            this.#userMap.set(user_id, new Set()); // initializes set if this is the first connection for the user
        }
        const roomSet = this.#userMap.get(user_id); // retrieves active room set
        for (const room of rooms) {
            roomSet.add(room?.id); // set automatically ignores duplicate IDs
        }
    }

    // Associates an active WebSocket connection with all of a user's rooms
    async addConnectionToRooms(rooms, connection) {
        if (rooms == null || connection == null) {
            throw new Error("Error adding connection to rooms: parameter error"); // validates arguments
        }
        for (const room of rooms) {
            await this.addConnectionToRoom(room.id, connection); // binds connection to each individual room
        }
        await this.#redisConnector.display(); // logs current pub/sub state for debugging
    }

    // Associates an active connection with a specific room and ensures Redis subscription
    async addConnectionToRoom(room_id, connection) {
        if (room_id != null && Number.isFinite(room_id) && connection instanceof WebSocket) {
            if (this.#roomMap.has(room_id)) {
                this.#roomMap.get(room_id).add(connection); // adds connection pointer to existing room set
            } else {
                this.#roomMap.set(room_id, new Set([connection])); // creates new room set with this connection
                // Subscribes server to Redis channel so messages from other instances reach this room
                await this.#redisConnector.subscribe(room_id, async (data) => {
                    const parsedMessage = JSON.parse(data); // deserializes Redis message payload
                    const message = parsedMessage?.message; // extracts message content or object
                    const targetRoomId = parsedMessage?.room_id; // extracts target room ID
                    const senderUserId = parsedMessage?.user_id; // extracts sender user ID
                    console.log("Received message from Redis subscription:", message, targetRoomId);
                    await this.fromRedisTransmitMessage(targetRoomId, message, senderUserId); // delivers to local clients
                });
            }
        } else {
            throw new Error("Room_id or connection are not valid inputs"); // guards against improper types
        }
    }

    // Removes a single WebSocket connection from a room
    async deleteConnectionInRoom(room_id, connection) {
        if (room_id != null && Number.isFinite(room_id) && connection instanceof WebSocket) {
            if (this.#roomMap.has(room_id)) {
                this.#roomMap.get(room_id).delete(connection); // removes connection reference from set
            }
        } else {
            throw new Error("Room_id or connection are not valid inputs"); // validates arguments
        }
    }

    // Cleans up a closing connection without wiping the user room list if other tabs remain open
    async deleteUser(user_id, connection) {
        if (!user_id || !this.#userMap.has(user_id)) {
            return false; // nothing to delete if user is not in map
        }

        const userRooms = this.#userMap.get(user_id); // retrieves all rooms the user belongs to
        if (userRooms) {
            for (const room_id of userRooms) {
                await this.deleteConnectionInRoom(room_id, connection); // removes the closing connection
                // If no active connections remain in this room on this server, unsubscribe from Redis
                const roomConnections = this.#roomMap.get(room_id); // checks remaining connections
                if (roomConnections && roomConnections.size === 0) {
                    this.#roomMap.delete(room_id); // drops room from local memory
                    await this.#redisConnector.unsubscribe(room_id); // stops receiving Redis messages for this room
                }
            }
        }

        // Checks whether the user still has other active connections in any room on this server
        let hasOtherConnections = false; // flag to determine if user is still active in another tab
        for (const connections of this.#roomMap.values()) {
            for (const con of connections) {
                if (con.user_id === user_id) {
                    hasOtherConnections = true; // another connection still exists for this user
                    break;
                }
            }
            if (hasOtherConnections) break;
        }

        // Only remove user from userMap if no other active connections exist for them
        if (!hasOtherConnections) {
            return this.#userMap.delete(user_id); // cleans up user record completely
        }
        return false; // preserves user room memberships for remaining connections
    }

    // Transmits a message to Redis so it fans out to all server instances
    async transmitMessageToRedis(room_id, message, wsConnection) {
        if (room_id != null && Number.isFinite(room_id) && message != null && wsConnection instanceof WebSocket) {
            if (this.checkUserRoomMembership(wsConnection.user_id, room_id)) {
                await this.#redisConnector.publish(room_id, message, wsConnection?.user_id); // publishes to Redis
            } else {
                throw new Error("User cannot send to that room"); // rejects unauthorized senders
            }
        } else {
            throw new Error("Room_id or connection are not valid inputs"); // validates arguments
        }
    }

    // Delivers a broadcast message received from Redis to all local connections in the room
    async fromRedisTransmitMessage(room_id, message, senderUserId) {
        if (room_id != null && Number.isFinite(room_id) && message != null) {
            if (this.#roomMap.has(room_id)) {
                // Delivers to all active connections in the room, including the sender for confirmation
                for (const con of this.#roomMap.get(room_id).keys()) {
                    if (con != null && con instanceof WebSocket && con.readyState === WebSocket.OPEN) {
                        this.sendMessage(con, room_id, message); // sends payload directly over socket stream
                    }
                }
                console.log("Delivered message from Redis to room connections:", room_id);
            }
        } else {
            throw new Error("Room_id or message are not valid inputs"); // validates arguments
        }
    }

    // Checks whether a given user is enrolled in a specific room
    checkUserRoomMembership(user_id, room_id) {
        return this.#userMap.get(user_id)?.has(room_id) ?? false; // returns true if membership exists
    }

    // Serializes and transmits data to a single WebSocket client
    sendMessage(connection, room_id, messageContent) {
        if (room_id != null && Number.isFinite(room_id) && messageContent != null && connection instanceof WebSocket) {
            // If the message is already a structured protocol object, serialize it directly
            let data;
            if (typeof messageContent === 'object' && messageContent !== null) {
                data = messageContent; // keeps protocol structure like { type: "message:new", message: {...} }
            } else {
                data = { room_id: room_id, message: messageContent }; // fallback legacy structure
            }
            connection.send(JSON.stringify(data)); // sends text frame over WebSocket
        } else {
            console.log(`Could not send message to room ${room_id}`); // logs transmission failure
        }
    }

    // Diagnostic method to display active connection status
    display() {
        console.log("Room map size:", this.#roomMap.size);
        for (const [roomId, connections] of this.#roomMap) {
            const userIds = Array.from(connections, (conn) => conn?.user_id).join(', ');
            console.log(`roomID: ${roomId} | ws id's: [ ${userIds} ]`);
        }
        console.log("USER MAP size:", this.#userMap.size);
        for (const [userId, roomIds] of this.#userMap) {
            const rooms = Array.from(roomIds).join(', ');
            console.log(`userId: ${userId} | roomIds: [ ${rooms} ]`);
        }
    }
}

module.exports = WebsocketManager;
