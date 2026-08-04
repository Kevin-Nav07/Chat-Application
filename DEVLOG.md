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


# July 18th

## What I Plan
    - Implement user authentication server-side
    - figure out web socket client and room storage

## What I Have Done
- Learned about JWT, refresh tokens, access tokens
- Implemented refresh and access tokens into the services

I learned a lot today, a lot about security and JWT access tokens. Most of the day was spent reading and learning rather than implementing, I tried to analyze the tradeoffs between token-based authentication and session-based. The reality I found was that neither of these tehcniques are more secure than the other, but only sometimes more secure depending on the situation. These two have different use cases and when I build applications in the future that is what I should look out for. Right now my application will not necessarily suffer or benefit from the differences, so I opted to use JWT merely based off learning value for myself.
## What I Learned
'

### Picking an Authentication Technique
I learned about the different authentication techniques.
Session based authentication stores session id's in Redis which we can retrieve and manually set expiry dates whenever we want, we send this to the user. Sessions can consume a lot of resources due to it being stored in Redis and needd frequent storage, but it allows the server to suspend any session whenever it wants and sessions do not tend to scale well since the system is highly stateful.

JWTS allow for secure payloads in each request that is given to the user and the server does not store,merely verified. It is more secure because of the encryption techniques. However, since JWT is not stored the server cannot suspend a JWT token and force a user logout, it has to expire naturally.


#### Session Pros
    - session is used with cookies, making it easy to use
    -   session cookies are have low space complexity
    - Revoking a session is straightforward, just delete the entry
    -if a session is compromised then it only compromises one user

#### Session Cons
    - couples both the front end back end
    - harder to scale because cookies are stored in server-side, with many users this is hard to keep track of
    - Storing sessions in cookies make cross-domain communication between client and Server more difficult, not impossibnle. Third-party apps trying to integrate with a session-based server will need their own way of dealing with the cookies
    -cookies are more susceptible to Cross-Site Request Forgery (XSRF or CSRF)
    - For distributed systems we need a centralized session storage where multiple servers would need access of this, this can create latency for the sheer size of session data and user base.
    -Redis lookup every request because we need to validate the token each time.
    -if the session store goes down then all login sessions are gone for the moment

#### Token Pros
    -No seperate storage needed
    - easy to scale, any server can verify tokens independantly
    - easy verification, no extra calls unless using refresh tokens
    - works identically for browsers, mobile, other servers when it comes to cross-domain 


#### Token Cons
    - when a token is taken it is hard to get rid of, revocation of a token is difficult
    - if a single secret is leaked, then attackers can forge every single token
    -few hundred bytes when it comes t payloads

I am going to use jwt tokens merely for learning purposes. Sessions would be easier to implemnt.

# July 26th

## What I Plan
    -Finish authentication endpoints and test them
    -Look into and see how redis can be used in conjunction with authentication
    -Look into Redis pub/sub and how to set it up 
  


## What I Did
-Created Auth Controller and Fixed Auth Services
- Installed mkcert to generate localhost certifications so I can use https locally for secure transmissions
-Created login endpoint
-implemented token rotation for refresh endpoint
-figured out how to set cookies on http header when returning tokens for the login endpoint

## What I Learned

Since a few days have gone by I have been trying to refresh on what I did. So far here is my imagined workflow for a user logging in and sending/recieving messages to another user

    1.User logs in, this log in hits the login endpoint which generates an access and refresh token, this refresh token is either put in Db or Redis cache
    2.User sends the access token on every request, once the access token is expired, we hit the /refresh enbpoint to generate a new one. If the refresh token is expired, then we force the user to login again and repeat from step 1
    3. once the user has a new access token they can continue to do things in the application. 
    4. After loggin in we create a websocket connection with the server for each user, this web socket connection will provide new messages when they come from other users regardless if we are in the chat or not.
    5. The server stores every user's websocket connection in a server map that stores all rooms, storing the pointer to each user's connection to the room they are in.
    6. When a user sends a message in a room, they send the message with the room information(we need to figure out how to let the server know which room the message is for). Once the server recieves the message, it transmits it to redis, which then retransmits it to servers that subscribe to that room

### API Security Maturity Model

this article: https://curity.io/resources/learn/the-api-security-maturity-model/

talks about the levels of API security, emphasizing the importance of user-centric and identity based authentication as more mature secure practices. Basic authentication in the form of API keys is at the bottom, followed by token-based authentication in level 2, 

The problem with basic authentication is that keys can easily be compromised and there is no emphasis of user identity. This also only provides authentication and not authorization.

### XSS and CSRF Attacks and Cookies and Http Authorization Header

Something I stumbled upon was how to send and store tokens across to the client. There are two ways

#### Cookies
Cookies are small files with key-value pairs that you can define and send in the headers section. These cookies are sent to the client and stored in the browser cookie jar or cache and automaticaly appended with every request, there is not much work to do from the client end. The problem with cookies is that they are vulnerable to XSS attacks, which are attacks where a user can insert a malicous piece of javascript in a website, executing it which can then retrieve your browser cookies and leak sensitive information. We can minimize this by appending the HttpOnly attribute which keeps the cookies in http and does not store it in the browser. the "Secure" attribute also can be used to secure the cookies in transmission and is only usable in HTTPS.

#### Authorization Header

This is a secure header to store tokens or other credentials in the header, often for short-lived tokens. This does not have persistent storage so it is stored in some sort of local memory for the client, which is vulnerable to CSRF attack(cross site request forgery) where a malicous user will attempt to try to bait you into clicking a link or image to a website already have a session with, and this launches or executes some sort of call to the api given your login. With CSRF the malicous link will call an api request like transfering money or retrieving information 


# July 27th

## What I Plan
- Finish refresh endpoint
- do logout endpoint
- look into pub/sub implementation on redis 

## What I Did
-created refresh endpoint
-added cookie serializing and deserializing;
-added accessToken verification in the Router middleware
-logout endpoint
- seperated WebSocketServer from normal server
- started WebSocketServerManager

I decided to have a joint map of user_id to ws connection and room_id to websocket connections in the form of a Websocket Connection Manager. This does not take up much space even with 100k users given that it is just storing ws pointers. I may remove the user_id map if it is not good, but I am choosing to use this approach over just user_id map because it prevents a crucial thing, repeated db/redis look ups to see who is in a room. Even with redis cache which will make it more efficient I am trading off my usage credits for nearly every message as each message will check who is in the room the message is intended for. This method prevents that as now transmitting a message to a room just means iterating through the list of ws connections for that room and sending it, and then saving the message to the db. I will consider saving messages in batches if that is more efficient.Messages on websocket are also sent as objects with a message attribute and room attribute which contains the room_id

Also when it comes to websocket, we are using websocket secure which encrypts our data using TSL, but we will send messages back and forth as binary data, as it is much mor efficient to send
## What I learned

we should not be passing query paramaters for a specific endpoint that can compromise data or give it to another user. It is better to use the user_id embeded in a given access token rather than pass in query paramaters. I will have to swap out the endpoints that have these query paramaters or resource to 

**The URL dictates what the user wants to see. The JWT dictates who the user is.**

This is important because if we want to use query paramaters or a path paramater, it is waht the user would like to see, then the jwt is what stores who the user is and the server decides if the user is allowed to see it. I will look into this more when I get into authorization.

# July 31th

## What I Have Planned
- implement connection Manager at a basic level
- Get user_id based off user authentication JWT token. So during websocket connection handshake we must check the  JWT sent to first verify it is valid, if nto send unauthorized. If it is valid, then check the user_id and label the ws connection. 
- get users connecting and talking between rooms on postman
- look into pub/sub on redis
## What I Did

    - implement connection manager methods for adding to a room map, removing from room map, transmitting
    -looked into how to do secure messaging, using JWT to store user_id and then every message sends room_id which will be verified
    properly to see if a user belongs to that room to send messaages. If a malicous user attempts to change the room_id to a room the user is in but still the user does not want to send the message, we  have to look into E2EE which will come in later.
    -Implemented the upgrade handling methods for ws for JWT verification and user_id extraction.
### Authentication Data
When a user logs in and are given a token, the token contains necessary information like their user_id. This allows a token to stay rigid and if it is tampered, then we cannot pretend to be another user. After authenticating we store the user_id in the user_map as well as the ws connection object associated -- we essentially label the ws connection object.

### Retrieving Rooms for Server and Client
we need to retrieve rooms for the server to populate the rooms_map on a user login or websocket reconnect, and we need the client to retrieve rooms on login so they can display to the user the rooms that are immedietely clickable.
It would be wrong for the server to wait for the client to do the get Rooms for User request, so on the connection of the ws we can delegate to a central worker in the server that will call service methods to retrieve the rooms and return them for us to send through the initial ws message. The issue is ws will have a hard time sending the rooms if they are so many so we have to only send the first 50ish rooms, through cursor-based pagination. I need to look into this pagination as well as the internal service delegator to see what to do.

#### Message Data

This is where it gets tricky, since room_id needs to be transmited, and the rooms a user belongs to can change quickly, we cannot put the room_id in the claims of a JWT access token as it would be stale once a user's rooms are updated. We can implement server-side validation of a user being in a room, so if the user sends a message in room 2, the server verifies they are actually in the room before sending the message. This restricts a user to only send messages to their rooms, and we should also include CSP header to restrict external javascript attacks. However, on the chance a malicous user can still alter a message payload and change the room id to a diferent room, leading the client to send a message to a room they did not want to, we can look into something called E2EE(End-to-End Encryption). We will implement E2EE later, so for now we proceed with sending room_id in the payload for every message.
## What I Learned

When a user first logs in, after they recieve their tokens and on the initial web socket handshake, they will be added to the server's list of web socket connections by first adding the user's ws connection to the user_map and then, at the same time the server should request for the rooms the user belongs too. Once those rooms are ascertained, we should opt to add each room to the rooms_map. When a message is sent from one user, they send the message on their websocket connection to the server, where the server sends it to each ws connection in the set of connections belonging to a room. This means the server needs a way to identify the user who sent the message, the room the message is for, and the message contents. When a ws connection is terminated, either forcefully or securely, then we remove that user's connection reference from the user map, and then remove it from any rooms the user belongs too. 

### User map holds room_ids, Room map holds websocket connection

In this scenerio the user map holds a list of room_ids that get populated on a user login, and during events like being removed from a room, getting added to a room, logoff and inactivity. The room_map will hold a list of websocket pointers for the users in the room, this list is populated based off who is logged in. If a user is logged in, they will have their ws connection added to each room they are in. This is made easy through the user map which tells us which rooms a user is part of. This room_map will dynamically recieve updates based off which user is logged in, logs out, whether a user adds another user who is currently online to the room, or removes.

### How a Websocket Connection Sends Normal Data and Authentication Data

Each websocket connection must authenticate, and when a message comes through we must know, either beforehand or through the message, what user_id is sending it, and what room the message is for, and the content of the message


#### E2EE(End-to-End Encryption)

this is a method where each client generates 3 keys, private,public and session key. Private key is used to decrypt messages, public key is stored publically for other users to download, it is how you encrypt messages for another user. We use the public and private key to generate a session key with another user and send data as fully encrypted through the clients and into the server.This prevents the server from reading. We wills still send room_id as plaintext. If a user is not authorized to send messages to a room then it won't send. If the room_id tampered with is in the allowed set of rooms to broadcast to, then the message gets sent to the client but decryption fails. This is something very importanbt to implement, but should be done when making the front-end. When doing this method we need to keep in mind the case where a message is sent to a room that the user is in, but the decryption fails for the recieving end because the message was not intended to be sent to that user(as in a malicous user redirected which room to go to). In this case, the server stores the message in the db, and so it is up to the client to deal with these unencrypted messages as garbage or display an empty bubble. We will decide how to solve this problem later so as not to bloat a db with failed messages.


# August 1st
## What I have Planned

-look into different pagination and implement the pagination technique for rooms
- look into design patterns for internal services
- implement an internal service to get rooms
- once we have rooms, load up the connection manager
## What I Did

-researched cursor and offset pagination
-implemented cursor pagination endpoint for rooms
-ensured that user_id is extracted on every request with jwt
-fixed bugs
-created ServiceContext class as a semi-factory pattern to create services on the go and execute their functions 

## What I Learned

### Cursor based pagination and Offset

I learned about the tradeoffs of these. I have used offset before, it is better suited to where you can sort and filter data, go to specific points/pages of data, but becomes increasingly more slow as the OFFSET(the paramater of how much data you want to skip) grows. Cursor based pagination essentially saves a cursor, which is like a checkpoint for where you are at your data, and then we encrypt the cursor and send it to the client, if the client wants to continue scrolling we send the request with the current cursor and we construct a SQL expression with a where clause. the where clause specifies that the column(s) we use to base the cursor off of have to be greater than it. This allows a more efficient lookup rather than scanning the table. Much faster than offset based pagination but less customizable. Better for infintie scrolling which is what we are using it for.


# August 3rd

## What I Have Planned
    - test the room retrieval from the ServiceContext
    - populate the connectionManager with relevant details
    -Test transmission of messages between users of different rooms
    -look into redis pub/sub, how it works
    -try to implement what I can
## What I Did
    -got ServiceContext working and populated the conneciton manager
    -users of different rooms can talk to each other
    -messages are routed to only users of the room specified.
    -when connectons drop, the socketManager is cleared of the data
    -read into pub/sub and RESp(redis protocol)

there is an issue however, when two users connection on different tabs(creating two different ws connections) it adds the connections to the map. This means that the ws connection objects are obviously different with the same user_id, but this also means if the user sends a messsage, the other connection for that user will recieve the message which we need to disable(very quick fix). I will need to decide if this is allowed or you can only have one login at a time.


## What I Learned

the Factory pattern is used to have a cleaner seperation of code when it comes to certain dependancies. It ends up with more abstract classes but allows you to only change the factory when instantiating a class rather than the class itself. This allows for cleaner seperation in favor of more complexity. Testing greatly benefits from patterns like this.

Redis uses it's own protocol to communicate between server and redis, called RESP. It seems RESP 2 does not have a handshake on connection and has more limited data types it can send while RESP 3 has the HELLO handshake. Either way both use a TCP connection. RESP 3 also has expanded datatypes to work with and makes it easier to parse on the client-side. Most importantly, RESP 2's pub/sub has a huge limitation where in that a redis connection that issues SUBSCRIBE will dedicate that connection to only recieving published notifications to that channel. the connection cannot be used to publish or execute typical REDIS database/cache commands. You would need 2 seperate connections for each server to publish and subscribe. RESP 3 resolves this but I need to check if nodejs-redis library supports RESP 3. 