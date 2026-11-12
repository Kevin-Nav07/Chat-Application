// Keeps track of which open sockets belong to which rooms and users on this server, and routes Redis pub/sub
// traffic to them. Every server instance has its own manager; Redis is what connects the instances together.
//
// Three maps, all kept in sync:
//   roomConnections:  room_id -> Set of sockets on this server that are in that room (used to deliver messages)
//   userConnections:  user_id -> Set of that user's open sockets on this server (used for per-user events like room:new)
//   connectionRooms:  socket  -> Set of room_ids that socket joined (used to clean up exactly that socket on close)
// Tracking rooms per socket, instead of per user, means closing one tab never removes another tab's rooms.
const { WebSocket } = require('ws');

class WebsocketManager {
    #roomConnections; // room_id -> Set<WebSocket>
    #userConnections; // user_id -> Set<WebSocket>
    #connectionRooms; // WebSocket -> Set<room_id>, a socket is "registered" while it has an entry here
    #redisConnector; // handles cross-server pub/sub

    constructor(redisConnector) {
        this.#roomConnections = new Map();
        this.#userConnections = new Map();
        this.#connectionRooms = new Map();
        this.#redisConnector = redisConnector;
    }

    // Records a newly opened socket. It must be called synchronously as soon as the socket connects, before any await,
    // so that a socket which closes while its rooms are still loading is always removed by removeConnection.
    // The first socket of a user on this server also subscribes this server to that user's personal Redis channel
    async registerConnection(connection) {
        const user_id = connection.user_id;
        this.#connectionRooms.set(connection, new Set()); // no rooms joined yet, they are added once loaded from the database

        let userSockets = this.#userConnections.get(user_id);
        const isFirstSocketForUser = userSockets == null;
        if (isFirstSocketForUser) {
            userSockets = new Set();
            this.#userConnections.set(user_id, userSockets);
        }
        userSockets.add(connection);

        if (isFirstSocketForUser) {
            await this.#redisConnector.subscribeUser(user_id, (data) => this.#handleUserEvent(user_id, data));
        }
    }

    // True while the socket is open and has not been cleaned up yet
    isRegistered(connection) {
        return this.#connectionRooms.has(connection);
    }

    // How many sockets this user has open on this server, used to cap connections per user
    socketCountForUser(user_id) {
        return this.#userConnections.get(user_id)?.size ?? 0;
    }

    // Adds one socket to one room. The first socket in a room on this server subscribes the server to that room's Redis channel.
    // Does nothing for a socket that already closed, which is what prevents dead sockets being added after a slow database call
    async joinRoom(connection, room_id) {
        if (!Number.isInteger(room_id) || !this.isRegistered(connection)) {
            return;
        }
        const joinedRooms = this.#connectionRooms.get(connection);
        if (joinedRooms.has(room_id)) {
            return; // already in this room, joining twice would be harmless but wasteful
        }
        joinedRooms.add(room_id);

        const sockets = this.#roomConnections.get(room_id);
        if (sockets != null) {
            sockets.add(connection);
            return;
        }
        // the map entry is created before the await, so a second socket joining at the same moment sees it and does not subscribe twice
        this.#roomConnections.set(room_id, new Set([connection]));
        await this.#redisConnector.subscribe(room_id, (data) => this.#handleRoomMessage(data));
    }

    // Adds a socket to several rooms, used once when a socket connects
    async joinRooms(connection, roomIds) {
        for (const room_id of roomIds) {
            await this.joinRoom(connection, room_id);
        }
    }

    // Removes a closed socket from every room and user it was part of, and unsubscribes from channels nobody here needs any more.
    // Safe to call more than once, because both the 'error' and 'close' events call it
    async removeConnection(connection) {
        const joinedRooms = this.#connectionRooms.get(connection);
        if (joinedRooms == null) {
            return; // already removed
        }
        this.#connectionRooms.delete(connection); // from here on isRegistered is false, so pending joins for this socket are skipped

        for (const room_id of joinedRooms) {
            const sockets = this.#roomConnections.get(room_id);
            if (sockets == null) {
                continue;
            }
            sockets.delete(connection);
            if (sockets.size === 0) {
                this.#roomConnections.delete(room_id);
                await this.#redisConnector.unsubscribe(room_id); // no socket on this server is in the room any more
            }
        }

        const user_id = connection.user_id;
        const userSockets = this.#userConnections.get(user_id);
        if (userSockets != null) {
            userSockets.delete(connection);
            if (userSockets.size === 0) {
                this.#userConnections.delete(user_id);
                await this.#redisConnector.unsubscribeUser(user_id); // the user has no open tabs on this server
            }
        }
    }

    // Publishes a confirmed message to Redis so every server, including this one, delivers it to the room
    async publishRoomMessage(room_id, payload, sender_id) {
        await this.#redisConnector.publish(room_id, payload, sender_id);
    }

    // Runs when Redis delivers a room message to this server: sends it to every open socket here that is in the room,
    // including the sender's own sockets, because that is how the sender learns the message was saved
    #handleRoomMessage(data) {
        let parsed;
        try {
            parsed = JSON.parse(data);
        } catch (error) {
            console.error("Ignoring malformed room message from Redis:", error);
            return; // a thrown error here would be an unhandled rejection inside the Redis client, so it is caught and logged
        }
        const sockets = this.#roomConnections.get(parsed?.room_id);
        if (sockets == null || parsed?.message == null) {
            return;
        }
        const text = JSON.stringify(parsed.message); // serialised once, not once per socket
        for (const socket of sockets) {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(text);
            }
        }
    }

    // Runs when Redis delivers an event on a user's personal channel to this server.
    // For room:new, every open socket of that user here joins the room first, then is told about it,
    // so a message sent right after the client hears room:new is already delivered to it
    async #handleUserEvent(user_id, data) {
        try {
            const event = JSON.parse(data);
            if (event?.type !== "room:new" || !Number.isInteger(event.room?.id)) {
                return;
            }
            const sockets = this.#userConnections.get(user_id);
            if (sockets == null) {
                return;
            }
            const text = JSON.stringify(event);
            for (const socket of [...sockets]) { // copied because removeConnection may change the set while we await
                await this.joinRoom(socket, event.room.id);
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(text);
                }
            }
        } catch (error) {
            console.error("Failed to handle user event from Redis:", error);
        }
    }
}

module.exports = WebsocketManager;
