const UserController = require('../Controllers/UserController');
const RoomController = require('../Controllers/RoomController');
const AuthController = require('../Controllers/AuthController');
const FriendshipController = require('../Controllers/FriendshipController');
const { createFriendshipSchema } = require('./Schemas');


const routeList = [{
    method: "GET",
    url: "/users/:id",
    controller: UserController,
    handler: "getUserAsync",
    schema: null,
    expectedPathTypes: { id: "number" },
    expectedSearchParamTypes: { filter: "string" },
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
    tokenNeeded: false
},
{
    method: "GET",
    url: "/users",
    controller: UserController,
    handler: "getUsersAsync",
    schema: null,
    expectedPathTypes: null,
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
    expectedSearchParamTypes: { id: "number" },
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
    method: "DELETE",
    url: "/auth/logout",
    controller: AuthController,
    handler: "logout",
    schema: null,
    expectedPathTypes: null,
    expectedSearchParamTypes: null,
    tokenNeeded: false
},
{
    method: "POST",
    url: "/friendship",
    controller: FriendshipController,
    handler: "createFriendRequest",
    schema: createFriendshipSchema,
    expectedPathTypes: null,
    expectedSearchParamTypes: null,
    tokenNeeded: true
},
{
    method: "GET",
    url: "/friendship",
    controller: FriendshipController,
    handler: "getFriendRequests",
    expectedPathTypes: null,
    expectedSearchParamTypes: { status: "string" },
    tokenNeeded: true
},
{
    method: "PUT",
    url: "/friendship/accept",
    controller: FriendshipController,
    handler: "acceptFriendRequest",
    expectedPathTypes: null,
    expectedSearchParamTypes: null,
    tokenNeeded: true
},
{
    method: "DELETE",
    url: "/friendship/:id",
    controller: FriendshipController,
    handler: "deleteFriendRequest",
    expectedPathTypes: { id: "number" },
    expectedSearchParamTypes: null,
    tokenNeeded: true
}
]

module.exports = routeList