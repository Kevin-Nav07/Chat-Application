

UserController = require('./controllers/UserController')
const DbPool = require('./DbPool');
const { validateURLFormat } = require('./helpers/APIValidator');
const { parseUrl } = require('./helpers/Parsers')



//we need a class or set of functions that take the server's route, and calls the apropriate handler/controller
//we need the request object, which we can parse through another layer before routing.
//what the router should do: keep the routing logic outside of the server, take in the routing url, and body as well as additional paramaters
//determine what controller it should go to
//from there it is the controller's responsibility to deal and handle the request which might delegate to a service
//router class will have a single instance which will


async function route(body, url, method) {
    const userRegex = '/^\/users(\/[0-9]+)?$/gmi';

    console.log(url)
    try {
        const { pathName, search, searchParameters } = parseUrl(url);
        validateURLFormat(pathName, search)

        console.log(pathName, search, searchParameters);
    }
    catch (e) {
        console.log("problem parsing the api call url" + e);
    }


    //extract pathParamaters out of the PathName
    //path paramaters are of form /someWord/.....
    //after the second slash extract the contents



    //*******************Routing *************** *///
    getByIdRegex = ''


    //must have /user first and then /number after

    if (pathName.trim().match(userRegex)) {//checks if the pathName is of format /user/:id or /user
        //route to user controller
        controller = new UserController(await DbPool.provideClient());
        console.log(await controller.handleRequest(method, body, searchParameters, pathName))//let the controller deal with this request

    }



}


module.exports = { route }