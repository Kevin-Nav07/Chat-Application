const UserController = require('../Controllers/UserController');
const RoomController = require('../Controllers/RoomController');
const AuthController = require('../Controllers/AuthController');


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
}
]

module.exports = routeList