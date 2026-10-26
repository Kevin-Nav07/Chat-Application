const { validateURLFormat, checkValidMethod } = require('./helpers/APIValidator');
const { verifyJWT } = require('./helpers/UserAuthenticator');
const { parseUrl } = require('./helpers/Parsers')
const { HttpError, errorToResponse } = require('./helpers/ErrorExtensions');
const DbPool = require('./DbPool');
const routeList = require('./Models/Routes');
const APIResponseObj = require('./Models/APIResponseObj');


//we need a class or set of functions that take the server's route, and calls the apropriate handler/controller
//we need the request object, which we can parse through another layer before routing.
//what the router should do: keep the routing logic outside of the server, take in the routing url, and body as well as additional paramaters
//determine what controller it should go to
//from there it is the controller's responsibility to deal and handle the request which might delegate to a service


//takes in a routeObject, turns its url (for example /users/:id) into a regular expression and stores it on the route
//so incoming paths can be matched against it and path paramaters pulled out as named groups
function registerRoute(routeObject) {
    const { url } = routeObject
    const pathParamaterExpression = new RegExp('(:[a-z]+)|(\/)', 'gmi')//matches either a :paramater or a slash
    let urlRegex = url.replaceAll(pathParamaterExpression, (paramater) => {
        if (paramater === "/") {
            return "\\/";//slashes get escaped so they are matched literally
        }
        const paramaterName = paramater.substring(paramater.indexOf(":") + 1).trim();
        return `(?<${paramaterName}>[^\\/]+)`;//a named capture group that grabs everything up to the next slash
    });
    urlRegex = new RegExp("^" + urlRegex + "$", "mi");//add ^ and $ to show we want the whole line to be a match
    //NOTE: do not use the g-global flag as using the global flag means using .match() with a string will return an object without capturing any named gorups

    routeObject.urlRegex = urlRegex

    return routeObject

}

//compiles the regex for every route once at startup
function registerAllRoutes() {
    for (const route of routeList) {
        registerRoute(route);
    }
    console.log(`Registered ${routeList.length} routes`);
}


//finds the route matching the url and method, checks the access token if the route needs one,
//then hands the request to the route's controller with a database connection from the pool
async function route(body, url, method, cookies) {
    let connection;
    try {
        const { pathName, searchParameters } = parseUrl(url);
        validateURLFormat(pathName)
        if (!checkValidMethod(method)) {
            throw new HttpError(405, "Method not allowed");
        }

        let pathMatched = false;//tracks whether the url matched a route even if the method did not, so we can tell 404 apart from 405
        for (const route of routeList) {
            const match = pathName.trim().match(route.urlRegex)
            if (!match) {
                continue;
            }
            pathMatched = true;
            if (route.method !== method) {
                continue;
            }
            //we will let the actual specific controller do query paramater and body validation
            const pathParams = match.groups;//extraction of pathParamaters using our regex pattern

            //check if we need an access token for this match
            const refreshToken = cookies?.refreshToken;
            let user_id;
            if (route.tokenNeeded) {
                const result = await verifyJWT(cookies);
                if (result instanceof APIResponseObj) {//verification failed, result already holds the 401 response
                    return result
                }
                user_id = result?.user_id;
                if (user_id == null || !Number.isFinite(user_id)) {
                    throw new HttpError(401, "No user id attached to access token")
                }
            }

            connection = await DbPool.provideClient();
            const controller = new route.controller(connection);
            return await controller.handleRequest(method, body, searchParameters, pathName, route.handler, pathParams, route.schema, route.expectedPathTypes, route.expectedSearchParamTypes, refreshToken, user_id);
        }

        if (pathMatched) {
            return { responseStatusCode: 405, responseBody: `Method ${method} is not allowed on this URL` }
        }
        return { responseStatusCode: 404, responseBody: "URL does not match registered routes" }
    }
    catch (error) {
        console.log("problem routing: " + error);
        return errorToResponse(error, "Unexpected error occured on server side");
    }
    finally {
        if (connection != null) {
            connection.release();//always give the connection back to the pool, even when the controller threw
        }
    }
}


module.exports = { route, registerAllRoutes }
