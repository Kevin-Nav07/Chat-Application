

//****************Register all controllers here ************/
UserController = require('./Controllers/UserController');
RoomController = require('./Controllers/RoomController');
const jwt = require('jsonwebtoken')

const { validateURLFormat, checkValidMethod, validatePathParamTypes } = require('./helpers/APIValidator');
const { verifyJWT } = require('./helpers/UserAuthenticator');
const { parseUrl } = require('./helpers/Parsers')
const DbPool = require('./DbPool');
const routeList = require('./Models/Routes');
const APIResponseObj = require('./Models/APIResponseObj');




//we need a class or set of functions that take the server's route, and calls the apropriate handler/controller
//we need the request object, which we can parse through another layer before routing.
//what the router should do: keep the routing logic outside of the server, take in the routing url, and body as well as additional paramaters
//determine what controller it should go to
//from there it is the controller's responsibility to deal and handle the request which might delegate to a service
//router class will have a single instance which will


function registerRoute(routeObject) {
    //takes in routingObject, generates a regex and adds it to the list of routes
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
            expression = (`(?<${paramaterName}>([0-9]|[a-z])+)`);
        }
        return expression
    });
    urlRegex = new RegExp("^" + urlRegex + "$", "mi");//add ^ and $ to show we want the whole line to be a match
    //NOTE: do not use the g-global flag as using the global flag means using .match() with a string will return an object without capturing any named gorups
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


async function route(body, url, method, cookies) {


    console.log("URL:" + url)
    let connection;
    try {
        const { pathName, search, searchParameters } = parseUrl(url);
        validateURLFormat(pathName, search)
        checkValidMethod(method);

        console.log(pathName, search, searchParameters);

        for (const route of routeList) {
            const match = pathName.trim().match(route.urlRegex)

            if (route.method === method && match) {//this checks if the url method and the url path match any of our routes
                //we will let the actual specific controller do query paramater and body validation
                const pathParams = match.groups;//extraction of pathParamaters using our regex pattern

                //check if we need an access token for this match
                let refreshToken = cookies?.refreshToken;
                let user_id;
                if (route?.tokenNeeded != null && route.tokenNeeded) {
                    //verify the access token


                    const result = await verifyJWT(cookies);
                    //determine what the result is
                    if (result instanceof APIResponseObj) {
                        return result
                    }
                    //extract user_id
                    user_id = result?.user_id;
                    if (user_id == null || !Number.isFinite(user_id)) {
                        throw new Error("No id attached to access token")
                    }


                }



                console.log("Path params:" + match, "routing method: " + route.method, "routing handler: " + route.handler)
                const connection = await DbPool.provideClient();
                const controller = new route.controller(connection);
                return await controller.handleRequest(method, body, searchParameters, pathName, route.handler, pathParams, route.schema, route.expectedPathTypes, route.expectedSearchParamTypes, refreshToken, user_id);
            }

        }

        console.log("Could not find API endpoint", url, method);
        return { responseStatusCode: 400, responseBody: "URL does not match registered routes" }
    }
    catch (error) {
        //if(e instanceof ValidationError)

        console.log("problem routing: " + error);
        return { responseStatusCode: 500, responseBody: "Unexpected error occured on server side" };
    }
    finally {
        if (connection != null) {

            connection.release();
            console.log("Connection released back into pool");
        }
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