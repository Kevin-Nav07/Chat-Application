//folder names must match the real casing (controllers, not Controllers), Windows ignores case but Linux servers do not
const UserController = require('../controllers/UserController');
const RoomController = require('../controllers/RoomController');
const AuthController = require('../controllers/AuthController');
const FriendshipController = require('../controllers/FriendshipController');

//NOTE: the router uses the first route whose url and method both match, so more specific urls like /users/me
//must come before generic ones like /users/:id that would also match them.
//schema is always the NAME a schema was registered under in helpers/SchemaValidation.js, never the schema object itself
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
    tokenNeeded: true
},
{
    method: "GET",
    url: "/users",
    controller: UserController,
    handler: "getUsersAsync",
    schema: null,
    expectedPathTypes: null,
    expectedSearchParamTypes: null,
    tokenNeeded: true
},
{
    method: "PUT",
    url: "/users/:id",
    controller: UserController,
    handler: "updateUserAsync",
    schema: "updateUserSchema",
    expectedPathTypes: { id: "number" },
    expectedSearchParamTypes: null,
    tokenNeeded: true
},
{
    method: "POST",
    url: "/users",
    controller: UserController,
    handler: "createUserAsync",
    schema: "createUserSchema",
    expectedPathTypes: null,
    expectedSearchParamTypes: null,
    tokenNeeded: false
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
    tokenNeeded: true
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
    method: "POST",
    url: "/auth/login",
    controller: AuthController,
    handler: "login",
    schema: "loginSchema",
    expectedPathTypes: null,
    expectedSearchParamTypes: null,
    tokenNeeded: false
},
{
    method: "POST",
    url: "/auth/refresh",
    controller: AuthController,
    handler: "refresh",
    schema: null,
    expectedPathTypes: null,
    expectedSearchParamTypes: null,
    tokenNeeded: false
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
    tokenNeeded: true
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
