# July 18th

I need to create a web socket server now on top of my RESTFUl server. I know that web sockets are a bidrection full duplex connection used for real-time, but what I have yet to figure out is how to integrate them on top of my current server so that my server can create users, create friends, but also listen for users to want to chat with each other and allow th chatting to occur.

What I need to figure out are what rooms are when it comes to web socket, how a chatting application looks like on top of an http server, implement an http server. This web socket server(or several) should be hosted and then listen for clients. Clients should be able to send messages over and that message should be broadcasted to all clients connected either on the current web socket server or over all web socket servers.

### What was done today

    -downloaded ws and figured out what websocket connection is
    -created a web socket server on top of my RESTful server where I can recieve web socket connections
    -basic back-and forth messaging where a message sent from one client will go through to all active websocket connections

the WebSocketServer is a class that represents a pool of indiviudal WebSocket connections which represent a full-duplex and persistent connection between the current server and a client. The WebSocket are the indiviudal client connections and we can send messages through them. The WebSocketServer is how we can access the other clients.

Another thing I learned is that since WebSocket is client-server communication, WebRTC is another protocol that is client-client and is used often for video streaming.

