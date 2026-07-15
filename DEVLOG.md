# July 8th

I need to create a web socket server now on top of my RESTFUl server. I know that web sockets are a bidrection full duplex connection used for real-time, but what I have yet to figure out is how to integrate them on top of my current server so that my server can create users, create friends, but also listen for users to want to chat with each other and allow th chatting to occur.

What I need to figure out are what rooms are when it comes to web socket, how a chatting application looks like on top of an http server, implement an http server. This web socket server(or several) should be hosted and then listen for clients. Clients should be able to send messages over and that message should be broadcasted to all clients connected either on the current web socket server or over all web socket servers.

### What was done today

    -downloaded ws and figured out what websocket connection is
    -created a web socket server on top of my RESTful server where I can recieve web socket connections
    -basic back-and forth messaging where a message sent from one client will go through to all active websocket connections
    - 

the WebSocketServer is a class that represents a pool of indiviudal WebSocket connections which represent a full-duplex and persistent connection between the current server and a client. The WebSocket are the indiviudal client connections and we can send messages through them. The WebSocketServer is how we can access the other clients.

Another thing I learned is that since WebSocket is client-server communication, WebRTC is another protocol that is client-client and is used often for video streaming.

### Design for Chatting Current
#### Users
We will have a Users table which consists of a given user.



#### Rooms
We will also have a Room table, rooms are basically the chat between 2 or more people. 
Rooms will have several columns, roomId, Users(which is a list of Users)(associated array)

#### UserRoom
Since users are many-to-many as 1 user can have many rooms and 1 room can have many users, we create this join table UserRoom that maps a single user to a single room
columns: userId, roomId, joinedAt(date);
#### Messages
messages will store chat history, each message will have a messageId, userId(for who sent the message), roomId(for which room it was sent in), content, type(text, attachment,image), read(boolean), sent(boolean)


# July 13th

Today I need to figure out how rooms work and how a user can establish a room and then the users apart of that room can connect of the ws connection

What are rooms? rooms are basically individual web socket connections between clients. When a chat between 2+ users is started up, then they establish a room, a private connection(ws connection) where they can talk. 

how can we create chats between different users as in individual web socket connctions

While working I noticed that registering routes did not centralize the searchParameters which will be useful soon, so I am going to first fix 

### AJV
ajv has a lot of interesting validaiton features when it comes to arrays, it was very helpful for specifying I wanted an array of user id's for my POST body

### UNNEST 
I have started on the process of creating and finding rooms, with creating multiple rooms I used a special posgres feature called UNNEST which basically destructures an array.
Creating a room involves having multiple users in that room, and that means multiple room_member rows must be created for each user in the list. While I can loop and use INSERT and VALUES to insert my data, it is more efficient to use UNREST which basically takes an array and expands it so that each part of the array is a new row to be inserted. If I have the other columns fixed, then each row will ahve some fixed values while the rest are dynamic. I could, in theory, have multiple values using UNNEST which would allow for each column to be flattened out

### Indexes and JOINS
I started the process of learning indexes. Joins I am familiar with but I am relearning due to poor memory. Indexes speed up database access for columns by sorting, from what I understand.
Indexes are especially good for JOINS when joining two tables and the joined column is indexed, increases efficiency. I found out that a junction table room_members has a left-right index already made for you. Meaning looking for rooms based off rooms_id or rooms_id+user_id is very fast, but looking for a specific user_id =24 is just O(n) time.

What is better is to create an index for user_id, so that the database has its user_ids sorted and can quickly look up the room_member rows where user_id =24, then from there, it finds the rooms where those room_id=rooms.id. So it uses both indexes which is powerful.


1. user creates a room, or if the room already exists then then it is not created

2. send a POST to create a room
3. the room exists and other users can connect to it, if a user connects to the room, then they connect to the web socket connection of that room, if there is no connection up then create a connection
5. if any of the users message, the message must be saved as a Message table
6. If any of the users leave, they will not see any of the messages
4. 

## things done today
    - Fixed SearchParamater Validation and made it apart of the centralized routing Object, also now search paramaters will be coerced but since it is an iterable it has to be it's own type
    - Removed API Validator and reduced it to functions, there was no need to have a class, so I cleaned up a lot of the handler function in the controller.
    -Adjusted schema validation 
    - created controller for Rooms, allowed CreateRoom Functionality, created schema for POST for Rooms