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


# Juky 15th

## What I plan

Today I plan to figure out how users apart of a room can establish a websocket connection to that room. I will need to design a workflow from front-to-back end that simulates a user clicking a chat and establishing a ws connection with the members of that room. I need to figure out how web socket connections can be dedicated to specific users, every web socket connction belongs to a room, and I need to find out how messages sent on a web socket connection from the client must be relayed to web socket connections in the room ONLY. 

## What I have Done

## What I Learned

# July 16th

## What I Plan
- Learn about pub/sub
- learn what Redis is
-Learn how to send additonal information

Right now I know that every user must retrieve all the rooms they are part of, these rooms must have some sort of notification system to alert for new messages. Right now the server has to store the current web socket connections. When a user enters a chat they begin a webosocket connection. The server must store all the current web socket connections so as to relay information when needed. 

### Idea 1
The current proposition is to store in a map where keys are rooms and each room has a list of web socket connections to relay. When the user joins a chat the server adds the web socket connection to that specific room. Every time a single user sends a message, the server recieves and broadcasts it to web socket connections in that given room, but each web socket connection won't have a room linked to it unless we send it with each message, which is another problem. 

### Idea 3
Another method I read about was to store by user id then to use Reddis to handle the room subscription

## What I Have Done

-looked into redis, looked into pub/sub decided to go forward with it

Tommorow I will need to look into reddis more on how to set it up, connect it, do basic queries, and how to do the pub/sub feature. I will alsop need to look into how I will be storing web socket connections as well as
    -How each server knows about connections and rooms, how a web socket connection can send additional information
## What I Learned

Reddis allows for servers to subscribe with information

### What is Redis and How Does it Work
Big requests of information from a server to a DB can take a long time,redis cache basically stores data in a redis cache instance and this data comes from the RAM of a server which hosts the redis instance so the server skips the DB call and goes straight to redis.

When a server needs data and redis does not have it, then eithe redis or the web server asks the database and then the cache inr edis is filled so if the next request comes, we will have the data and the retrieval will be faster.

# July 17th


## What I Plan
    -Go Through Redis course
    -Figure Out and Implement Redis
    -Figure out how application can store room and user data from web socket

## What I have Done
    - Learned about Redis
    -Connected to Redis
    - learned about heart ping/pong pattern and put it in the websocket
    - put binary data unpacking in server.js
    -Looked into and implemented password hashing(sign up only)
    - when sending messages we will send as binary to simulate json messages which will contain message and room_id. user_id or token will be sent on the initial web socket handshake most likely with cookies or some other authorization technique.

## What I Learned

### Pub/Sub
In pub/sub we have a publisher that has different topics, these topics in our case which can be subscribed to by clients are rooms. These rooms are dependant on what rooms are in the database. When a server subscribes it is because one of the server's clients locally are listening to a specific room, and so they want to know to recieve information from that room.  Another server also has a client in that rom and subscribes to listen. When a client in Room A sends a message, server 2 will be subscribed to messages in Room A. server 1 then checks its local map and transmits information, then redis then checks who is subscribed to room A and then finds server 2 is subscribed and gives server 2 the message, server 2 then checks the map for any of the users who are in the room and transmits the message. It does this for every server. 

Ping/pong pattern is important for web sockets because clients may disconnect ocasionally leaving the web socket connection up, this is a zombie connection which has no indication of turning off. Regularly pinging the web socket connection from the server side will let the server know which connections are active and which are to be disposed of.

Redis will not act as a cache, at least not yet, but primarily for pub/sub model where each server will store a dictionary of room_id websocket connections and each client will be given a dedicated web socket when logged in which will be added to the rooms.

### Password Hashing

is another thing I learned about recently. When passwords are stored in  adatabase we hash them so that we compare an incoming password to the hashed ones and if the database is compromised then the hash is not reversible to get the password. We additionally salt the password which the bycrypt library does for us which is add an extra plain text string to every password, each user will have their own unique plaintext string. This makes it harder for hackers who will use rainbow tables and other methods of brute-force attacking and finding passwords despite being hashed.