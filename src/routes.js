

UserController = require('./controllers/UserController')
const DbPool = require('./DbPool')

function ParseUrl(url, url_host) {
    const url_obj = URL.parse(`http://${url_host}${url}`)//put it into aurl object which will naturally destructure it into parts
    path_name = url_obj.pathname
    search = url_obj.search
    searchParameters = url_obj.searchParams
    return { path_name, search, searchParameters }

}

//we need a class or set of functions that take the server's route, and calls the apropriate handler/controller
//we need the request object, which we can parse through another layer before routing.
//what the router should do: keep the routing logic outside of the server, take in the routing url, and body as well as additional paramaters
//determine what controller it should go to
//from there it is the controller's responsibility to deal and handle the request which might delegate to a service
//router class will have a single instance which will


async function Route(body, url, method) {
    console.log(url)
    const { path_name, search, searchParameters } = ParseUrl(url);
    console.log(path_name, search, searchParameters);



    if (path_name.trim() == "/users") {
        //route to user controller
        controller = new UserController(await DbPool.ProvideClient());
        console.log(await controller.handleRequest(method, body, searchParameters))

    }


}


module.exports = { Route }