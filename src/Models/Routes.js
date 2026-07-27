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
    expectedSearchParamTypes: { filter: "string" }
},
{
    method: "GET",
    url: "/users",
    controller: UserController,
    handler: "getUsersAsync",
    schema: null,
    expectedPathTypes: null,

},
{
    method: "PUT",
    url: "/users/:id",
    controller: UserController,
    handler: "updateUserAsync",
    schema: "updateUserSchema",
    expectedPathTypes: { id: "number" },
    expectedSearchParamTypes: null
},
{
    method: "POST",
    url: "/users",
    controller: UserController,
    handler: "createUserAsync",
    schema: "createUserSchema",
    expectedPathTypes: null,
    expectedSearchParamTypes: null
},
{
    method: "DELETE",
    url: "/users/:id",
    controller: UserController,
    handler: "deleteUserAsync",
    schema: null,
    expectedPathTypes: { id: "number" },
    expectedSearchParamTypes: null
},
{
    method: "POST",
    url: "/rooms",
    controller: RoomController,
    handler: "createRoomAsync",
    schema: 'createRoomSchema',
    expectedPathTypes: null,
    expectedSearchParamTypes: null
},
{
    method: "GET",
    url: "/rooms",
    controller: RoomController,
    handler: "getRoomsAsync",
    schema: null,
    expectedPathTypes: null,
    expectedSearchParamTypes: { id: "number" }
},
{
    method: "POST",
    url: "/auth/login",
    controller: AuthController,
    handler: "login",
    schema: "loginSchema",
    expectedPathTypes: null,
    expectedSearchParamTypes: null
},
    // {
    //     method: "POST",
    //     url: "/auth/refresh",
    //     controller: AuthController,
    //     handler: "refresh",
    //     schema: null,
    //     expectedPathTypes: null,
    //     expectedSearchParamTypes: null
    // }
]

module.exports = routeList