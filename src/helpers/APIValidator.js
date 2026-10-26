const { ajv } = require('./SchemaValidation')
const { HttpError } = require('./ErrorExtensions')


//what sanitizations do we need?
//1. only processing relevant query paramaters


//have validaiton for content-type header to ward off anything but json or chunks


//returns true if the path only contains slashes and url safe characters, throws a 400 HttpError otherwise
function validateURLFormat(pathName) {

    if (pathName === undefined || pathName.length == 0) {
        return true
    }

    const pathValidator = new RegExp('^\\/(?:[a-zA-Z0-9-_]+\\/?)*$');
    if (pathValidator.test(pathName))//check if the pathName follows the format for url with our regular expression
    {
        return true

    }
    throw new HttpError(400, "path name is malformed or not of correct format")

}

function checkValidMethod(method) {
    const trimmed = method?.trim();
    return trimmed === "GET" || trimmed === "PUT" || trimmed === "POST" || trimmed === "DELETE";
}
function isNumeric(str) {
    if (typeof str !== 'string') return false;
    return str.trim() !== '' && !isNaN(Number(str));
}


function validatePathParamTypes(expectedParamTypes, actualParams) {
    /*
    expectedParamTypes: object of key,value where key is the paramater name, value is paramater type
    actualParams: object of key,value where key is paramater name, value is the value of the incoming paramater for the request

    iterate through our actualParams, compare it to the type of expected params and perform type coeercion where needed
    throws an error upon a type mismatch or an unexpected paramater

    if the expected type is a number
     case 1: the actual type is a number(stored as a string) we convert and store it in the value to replace
     case 2: the actual type is a string(stored as a string) and we can't convert it to a number so type coeercion and validaiton fails

    if expected type is a string
        case 1: the actual type is a string(stored as a string) we check as if string and leave it be
        case 2: the actual type is a number(stored as a string) we check if the actual cannot be a number
    */
    if (actualParams == null) {//no path paramaters in this url, nothing to check
        return true
    }
    for (const key in actualParams) {
        if (expectedParamTypes?.[key] === undefined) {//if we did not expect this path paramater throw error
            throw new Error(`path paramater ${key} not expected`);
        }
        if (expectedParamTypes[key] === 'number') { //if expected type is number
            if (!isNumeric(actualParams[key])) {//actual type is not a number, throw error
                throw new Error("path paramater expected to be a number but was not")
            }
            actualParams[key] = Number(actualParams[key])//convert value for the params
        }
        else if (expectedParamTypes[key] === 'string') {//expected type is a string
            if (isNumeric(actualParams[key]))//actual is a number
            {
                throw new Error("path parameter expected to be a string but was a number")
            }
        }
    }
    return true
}

function validateSearchParamTypes(expectedSearchParamTypes, actualSearchParams) {
    //Takes in an object expectedSearchParamTypes and an iterable URLSearchParam called actualSearchParams and returns an object version
    //of actualSearchparams with values converted
    //for each actualSearchParam, checks if it is in the expectedSearchParamTypes and if so compares the types,
    //if it is not in the expected searchParamTypes, throws

    if (actualSearchParams == null) {//if the actual params are not specified
        return {}
    }
    const searchParamObject = Object.fromEntries(actualSearchParams);
    if (expectedSearchParamTypes == null)//if the expected params are none, extra params are ignored
    {
        return searchParamObject
    }

    for (const [key, value] of actualSearchParams) {
        if (!(key in expectedSearchParamTypes)) {
            throw new Error(`search paramater ${key} is not in the expected search paramaters`);
        }
        if (expectedSearchParamTypes[key] === 'number') { //if expected type is number
            if (!isNumeric(value)) {//actual type is not a number but a string, so validation fails
                throw new Error("search paramater expected to be a number but was not")
            }
            searchParamObject[key] = Number(value);
        }
        else if (expectedSearchParamTypes[key] === 'string') {//expected type is a string
            if (isNumeric(value))//actual is a number
            {
                throw new Error("search parameter expected to be a string but was a number")
            }
            //expected type is a string, so we leave it and do nothing,Validation passes
        }
    }
    return searchParamObject //all the search paramaters we recieved are expected
}

function validateBodyFormat(schemaName, otherBody) {
    //check whether or not the body is of the correct format of the schema
    /*
    case 1: schema is defined
       - a body is expected and the incoming body matches the schema(return True)
       - a body is expected and the incoming body does not match the schema(throw error)
       - a body is expected but there is no body(throw error)
    case 2: a schema is not defined:
        - a body is not expected but one is sent(ignore)
        -a body is not expected but one is not sent(continue)
    */

    if (schemaName == null) {//no schema defined
        return true
    }
    const schemaValidator = ajv.getSchema(schemaName)//retrieves the schema valdiator from the cache by the name it was registered under
    if (schemaValidator === undefined) {//a developer mistake, the route names a schema that was never registered in SchemaValidation.js
        throw new Error(`Schema ${schemaName} is not registered with ajv`);
    }
    if (otherBody === null || typeof otherBody !== "object") {
        throw new Error("Schema Validation Failed, request body is missing")
    }
    if (!schemaValidator(otherBody)) {
        //errorsText turns ajv's error list into a readable sentence the frontend can show, for example "data/password must NOT have fewer than 8 characters"
        throw new Error("Schema Validation Failed: " + ajv.errorsText(schemaValidator.errors))
    }
    return true

}


module.exports = { validateURLFormat, checkValidMethod, validatePathParamTypes, validateSearchParamTypes, validateBodyFormat }
