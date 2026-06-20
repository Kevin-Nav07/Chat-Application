

UserController = require('./controllers/UserController')
const DbPool = require('./DbPool');
const { validateURLFormat, checkValidMethod } = require('./helpers/APIValidator');
const { parseUrl } = require('./helpers/Parsers')
const routeList = require('./Models/Routes');


//we need a class or set of functions that take the server's route, and calls the apropriate handler/controller
//we need the request object, which we can parse through another layer before routing.
//what the router should do: keep the routing logic outside of the server, take in the routing url, and body as well as additional paramaters
//determine what controller it should go to
//from there it is the controller's responsibility to deal and handle the request which might delegate to a service
//router class will have a single instance which will


function registerRoute(routeObject) {
    //takes in a url, adds it to the list of routes and generates a regex for that specific route
    //when an incoming route comes, we will compare the regex
    ///from a url how do we generate a REGEX
    //user/new/:id
    //once we generate the regular expression, how do we link it with the controller method. We could either link it to the controller and le tthe controller handle it
    //or we can somehow map each endpoint to a specific method
    //when we register the route
    const { method, url, controller, handler } = routeObject
    url.replace()
    pathParamaterExpression = new RegExp('(:[a-z]+)|(\/)', 'gmi')
    let urlRegex = url.replaceAll(pathParamaterExpression, (paramater) => {

        if (paramater === "/") {
            expression = ("\\/");
        }
        else {
            paramaterName = paramater.substring(paramater.indexOf(":") + 1).trim();
            expression = (`(?<${paramaterName}>[0-9]|[a-z])+`);
        }
        return expression
    });
    urlRegex = new RegExp("^" + urlRegex + "$", "i");
    console.log(urlRegex);

    routeObject.urlRegex = urlRegex

    return routeObject

}

function registerAllRoutes() {
    for (const route of routeList) {
        registerRoute(route);

    }
    console.log("Registered all Routes", routeList);


}


async function route(body, url, method) {
    const userRegex = '/^\/users(\/[0-9]+)?$/gmi';

    console.log("URL:" + url)
    try {
        const { pathName, search, searchParameters } = parseUrl(url);
        validateURLFormat(pathName, search)
        checkValidMethod(method);

        console.log(pathName, search, searchParameters);

        for (const route of routeList) {
            const match = pathName.trim().match(route.urlRegex)

            if (route.method === method && match) {//this checks if the url method and the url path match any of our routes
                //we will let the actual specific controller do query paramater and body validation
                pathParams = match.groups
                console.log(pathParams);
                console.log(route.method, route.handler, route.controller)
                controller = new route.controller()
                controller.handleRequest(method, body, searchParameters, pathName, route.handler, pathParams);
            }

        }
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

    // if (pathName.trim().match(userRegex)) {//checks if the pathName is of format /user/:id or /user
    //     //route to user controller
    //     controller = new UserController(await DbPool.provideClient());
    //     console.log(await controller.handleRequest(method, body, searchParameters, pathName))//let the controller deal with this request

    // }



}

module.exports = { route, registerAllRoutes }