const UserController = require('../Controllers/UserController');

const routeList = [{
    method: "GET",
    url: "/users/:id",
    controller: UserController,
    handler: "getUserAsync",
    schema: null,
    expectedPathTypes: { id: "number" }
},
{
    method: "GET",
    url: "/users",
    controller: UserController,
    handler: "getUsersAsync",
    schema: null
},
{
    method: "PUT",
    url: "/users/:id",
    controller: UserController,
    handler: "updateUserAsync",
    schema: "updateUserSchema",
    expectedPathTypes: { id: "number" }
},
{
    method: "POST",
    url: "/users",
    controller: UserController,
    handler: "createUserAsync",
    schema: "createUserSchema"
},
{
    method: "DELETE",
    url: "/users/:id",
    controller: UserController,
    handler: "deleteUserAsync",
    schema: null,
    expectedPathTypes: { id: "number" }
},
{
    method: "GET",
    url: "/users/:id/getting/:name/resource",
    controller: UserController,
    handler: "getUserAllAsync",
    schema: null,
    expectedPathTypes: { id: "number", name: "string" }
}]

module.exports = routeList