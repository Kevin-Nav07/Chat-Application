// Lets the HTTP side of the app (controllers) send live events to connected websocket users.
// Controllers are created per request and have no access to Redis, so app.js hands the Redis connection
// to this module once at startup. Every server instance subscribes to each connected user's personal channel,
// so publishing here reaches that user's sockets no matter which server they are connected to.

let redisConnector = null; // stays null in the API tests, which run without Redis, so notifications are skipped there

// Called once by app.js after Redis has connected
function setRealtimePublisher(connector) {
    redisConnector = connector;
}

// Tells every member of a newly created room about it, so their open sockets join the room and their room list updates.
// This is best effort: the room already exists in the database, so a Redis failure is logged instead of failing the request,
// and the members still see the room the next time they load their rooms.
// nameByMember (optional) gives each member their own name for the room. Direct rooms need it, because each person
// sees the room under the other person's username
async function notifyRoomCreated(room, memberIds, nameByMember = null) {
    if (redisConnector == null) {
        return;
    }
    try {
        await Promise.all(memberIds.map((memberId) => {
            const name = nameByMember?.[memberId] ?? room.name; // ?. means: only look inside when nameByMember is not null
            return redisConnector.publishToUser(memberId, { type: "room:new", room: { ...room, name } });
        }));
    } catch (error) {
        console.error("Failed to publish room:new event:", error);
    }
}

module.exports = { setRealtimePublisher, notifyRoomCreated };
