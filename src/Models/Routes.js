const UserController = require('../controllers/UserController');

const routeList = [{
    method: "GET",
    url: "/users/:id",
    controller: UserController,
    handler: "getUser"
},
{
    method: "GET",
    url: "/users",
    controller: UserController,
    handler: "getUsers"
},
{
    method: "PUT",
    url: "/users",
    controller: UserController,
    handler: "updateeUser"
},
{
    method: "POST",
    url: "/users/:id",
    controller: UserController,
    handler: "creatUsers"
},
{
    method: "DELETE",
    url: "/users/:id",
    controller: UserController,
    handler: "deleteUser"
},
{
    method: "GET",
    url: "/users/:id/getting/:name/resource",
    controller: UserController,
    handler: "getUserAlls"
}]

module.exports = routeList