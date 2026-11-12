//folder names must match the real casing (controllers, not Controllers), Windows ignores case but Linux servers do not
const UserController = require('../controllers/UserController');
const RoomController = require('../controllers/RoomController');
const AuthController = require('../controllers/AuthController');
const FriendshipController = require('../controllers/FriendshipController');

//NOTE: the router uses the first route whose url and method both match, so more specific urls like /users/me
//must come before generic ones like /users/:id that would also match them.
//schema is always the NAME a schema was registered under in helpers/SchemaValidation.js, never the schema object itself.
//rateLimits (optional) lists limiters from helpers/RateLimiter.js. by: "ip" counts per client address, by: "user" counts
//per logged in user, and global: true shares one counter between everybody
//
//There is deliberately no GET /users route: listing every account handed anyone with a login the id of every user,
//which made it trivial to spam them all. People are found by exact username instead (GET /users/name/:username)
const routeList = [{
    method: "GET",
    url: "/users/me",
    controller: UserController,
    handler: "getCurrentUserAsync",
    schema: null,
    expectedPathTypes: null,
    expectedSearchParamTypes: null,
    tokenNeeded: true
},
{
    method: "GET",
    url: "/users/:id",
    controller: UserController,
    handler: "getUserAsync",
    schema: null,
    expectedPathTypes: { id: "number" },
    expectedSearchParamTypes: null,
    tokenNeeded: true
},
{
    method: "GET",
    url: "/users/name/:username",
    controller: UserController,
    handler: "getUserByNameAsync",
    schema: null,
    expectedPathTypes: { username: "string" },
    expectedSearchParamTypes: null,
    tokenNeeded: false,//the signup form uses this to check a name is free before the person has an account
    rateLimits: [{ limiter: "usernameLookupPerIp", by: "ip" }]
},
{
    method: "PUT",
    url: "/users/:id",
    controller: UserController,
    handler: "updateUserAsync",
    schema: "updateUserSchema",
    expectedPathTypes: { id: "number" },
    expectedSearchParamTypes: null,
    tokenNeeded: true,
    rateLimits: [{ limiter: "accountUpdatePerUser", by: "user" }]//this route checks the current password, so it is limited like login
},
{
    method: "POST",
    url: "/users",
    controller: UserController,
    handler: "createUserAsync",
    schema: "createUserSchema",
    expectedPathTypes: null,
    expectedSearchParamTypes: null,
    tokenNeeded: false,
    rateLimits: [
        { limiter: "signupPerIp", by: "ip" },
        { limiter: "signupGlobal", by: "ip", global: true }
    ]
},
{
    method: "DELETE",
    url: "/users/:id",
    controller: UserController,
    handler: "deleteUserAsync",
    schema: null,
    expectedPathTypes: { id: "number" },
    expectedSearchParamTypes: null,
    tokenNeeded: true
},
{
    method: "POST",
    url: "/rooms",
    controller: RoomController,
    handler: "createRoomAsync",
    schema: 'createRoomSchema',
    expectedPathTypes: null,
    expectedSearchParamTypes: null,
    tokenNeeded: true,
    rateLimits: [{ limiter: "roomCreatePerUser", by: "user" }]
},
{
    method: "GET",
    url: "/rooms",
    controller: RoomController,
    handler: "getRoomsAsync",
    schema: null,
    expectedPathTypes: null,
    expectedSearchParamTypes: null,//rooms are always looked up for the logged in user from the token, never from a query param
    tokenNeeded: true
},
{
    method: "GET",
    url: "/rooms/cursor",
    controller: RoomController,
    handler: "getRoomsForUserAsync",
    schema: null,
    expectedPathTypes: null,
    expectedSearchParamTypes: { cursor: "string", limit: "number" },
    tokenNeeded: true

},
{
    method: "GET",
    url: "/rooms/:id/messages",
    controller: RoomController,
    handler: "getRoomMessagesAsync",
    schema: null,
    expectedPathTypes: { id: "number" },
    expectedSearchParamTypes: { cursor: "string", limit: "number" },
    tokenNeeded: true
},
{
    method: "POST",
    url: "/auth/login",
    controller: AuthController,
    handler: "login",
    schema: "loginSchema",
    expectedPathTypes: null,
    expectedSearchParamTypes: null,
    tokenNeeded: false,
    rateLimits: [{ limiter: "loginPerIp", by: "ip" }]
},
{
    method: "POST",
    url: "/auth/refresh",
    controller: AuthController,
    handler: "refresh",
    schema: null,
    expectedPathTypes: null,
    expectedSearchParamTypes: null,
    tokenNeeded: false,
    rateLimits: [{ limiter: "refreshPerIp", by: "ip" }]
},
{
    method: "POST",
    url: "/auth/logout",
    controller: AuthController,
    handler: "logout",
    schema: null,
    expectedPathTypes: null,
    expectedSearchParamTypes: null,
    tokenNeeded: false//logging out must still work when the access token has already expired
},
{
    method: "POST",
    url: "/friendship",
    controller: FriendshipController,
    handler: "createFriendRequest",
    schema: "createFriendshipSchema",
    expectedPathTypes: null,
    expectedSearchParamTypes: null,
    tokenNeeded: true,
    rateLimits: [{ limiter: "friendRequestPerUser", by: "user" }]
},
{
    method: "GET",
    url: "/friendship",
    controller: FriendshipController,
    handler: "getFriendRequests",
    schema: null,
    expectedPathTypes: null,
    expectedSearchParamTypes: { status: "string" },
    tokenNeeded: true
},
{
    method: "PUT",
    url: "/friendship/accept",
    controller: FriendshipController,
    handler: "acceptFriendRequest",
    schema: "acceptFriendshipSchema",
    expectedPathTypes: null,
    expectedSearchParamTypes: null,
    tokenNeeded: true
},
{
    method: "DELETE",
    url: "/friendship/:id",
    controller: FriendshipController,
    handler: "deleteFriendRequest",
    schema: null,
    expectedPathTypes: { id: "number" },
    expectedSearchParamTypes: null,
    tokenNeeded: true
}
]

module.exports = routeList
