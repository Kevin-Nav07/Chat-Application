//this will map user_id to websocket connections as well as rooms to websocket connections


/* THE CLASS WILL FULLFILL THESE FUNCTIONS

    -Store a map where the key's are room_ids and the values are SETS of active WS connections of users currently connected
    -Store a map where the key's are user_ids and the value is an active WS connection the user(client) has with the server).
    -When a new websocket connection is made to this server, we add it to the connection maps
    - When a web socket connection is removed, either voluntarily or forcibly, we remove all the pointers to the ws connection in both maps
    - When a message for a specific user or room comes in, we transmit the message to whoever needs it.
    -it will communicate with redis to either do db lookups or route messages to redis, or recieve newly transmited messages from redis.
    */
class WebsocketManager {

    #roomMap;
    #userMap;
    constructor() {

    }



}