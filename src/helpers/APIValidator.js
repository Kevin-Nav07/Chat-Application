


const { default: validation } = require('ajv/dist/vocabularies/validation');
const { ajv } = require('./SchemaValidation')



//what sanitizations do we need?
//1. only processing relevant query paramaters


//have validaiton for content-type header to ward off anything but json or chunks



function validateURLFormat(pathName, search) {//returns True if a valid url, false false

    if (pathName === undefined || pathName.length == 0) {
        return true
    }

    const pathValidator = new RegExp('^\\/(?:[a-zA-Z0-9-_]+\\/?)*$');
    if (pathValidator.test(pathName))//check if the pathName follows the format for url with our regular expression
    {
        return true

    }
    else {

        throw new Error("path name is malformed or not of correct format")
    }

}

function checkValidMethod(method) {
    if (method.trim() === "GET" || method.trim() === "PUT" || method.trim() === "POST" || method.trim() === "DELETE") {
        return true
    }
    return false
}
function isNumeric(str) {
    if (typeof str !== 'string') return false;
    return str.trim() !== '' && !isNaN(Number(str));
}


function validatePathParamTypes(expectedParamTypes, actualParams) {
    /*
    expectedParamTypes: object of key,value where key is the paramater name, value is paramater type
    actualParams: object of key,value where key is paramater name, value is the value of the incoming paramater for the request
    

    given your actualParams, it is assumed already the expectedParam has all the actualParams

    what we need to do is iterate through our actualParams, compare it to the type of expected params and perform type coeercion where needed
    return T or F throw an error upon a type mismatch, 
    
    first check if the actualParams key exists in the expected params, if it does not throw

    then if it does exist, check if the data type exists or they are the same data type

    if the expected type is a number
     case 1: the actual type is a number(stored as a string) we convert and store it in the value to replace
     case 2: the actual type is a string(stored as a string) and we can't convert it to a number so type coeercion and validaiton fails

    if expected type is a string
        case 1: the actual type is a string(stored as a string) we check as if string and leave it be
        case 2: the actual type is a number(stored as a string) we check if the actual cannot be a number
    */
    console.log(actualParams, expectedParamTypes)
    if (actualParams !== null || actualParams !== undefined) {
        for (const key in actualParams) {
            //if expected param is a number, then make sure to try and convert and then store it in the actual type
            if (expectedParamTypes[key] !== undefined) {//check if key,value is in expected type
                if (expectedParamTypes[key] === 'number') { //if expected type is number 

                    if (isNumeric(actualParams[key])) {//actual type is a number

                        actualParams[key] = Number(actualParams[key])//convert value for the params
                    }
                    else {//actual type is not a number, throw error
                        throw new Error("path paramater expected to be a number but was not")
                    }
                }
                else if (expectedParamTypes[key] === 'string') {//expected type is a string
                    if (isNumeric(actualParams[key]))//actual is a number
                    {
                        throw new Error("path parameter expected to be a string but was a number")
                    }

                }
            }
            else {//if we did not expect this path paramater throw error
                throw new Error("path paramater", key, "not expected");

            }


        }
        return true
    }
    else {
        return false
    }
}

function validateSearchParamTypes(expectedSearchParamTypes, actualSearchParams) {
    //Takes in an object expectedSearchParamTypes and an iterable URLSearchParam called actualSearchParams and returns an object version
    //of actualSearchparams with values converted
    //takes in actualSearchParams(an iterable), iterate through and then for each actualSearchParam, checks if it is in the expectedSearchParamTypes,
    //if it is in the expected, compare their types by comparing the type of the value of the search paramater to the expectedSearchParamType,
    //if it is not in the expected searchParamTypes, return False


    searchParamObject = Object.fromEntries(actualSearchParams);
    if (actualSearchParams === null || actualSearchParams === undefined) {//if the actual params are not specified
        return searchParamObject
    }
    else {//if the paramaters are specified
        if (expectedSearchParamTypes === null)//if the expected params are none
        {
            return searchParamObject
        }
        else {//if we do expect some paramaters, now we check if the expected matches the actual


            for (const [key, value] of actualSearchParams) {
                //if the key expects in 
                if (key in expectedSearchParamTypes) {//if the search paramater exists in the expected, then check type


                    if (expectedSearchParamTypes[key] === 'number') { //if expected type is number 

                        if (isNumeric(value)) {//actual type is a number

                            searchParamObject[key] = Number(value);

                        }
                        else {//actual type is not a number but a string, so validation fails
                            throw new Error("search paramater expected to be a number but was not")
                        }
                    }
                    else if (expectedSearchParamTypes[key] === 'string') {//expected type is a string
                        if (isNumeric(value))//actual is a number
                        {
                            throw new Error("search parameter expected to be a string but was a number")
                        }
                        //expected type is a string, so we leave it and do nothing,Validation passes

                    }

                }
                else {
                    throw new Error("search paramater is not in the expected search paramaters");
                }

            }
            return searchParamObject //all the search paramaters we recieved are expected

        }



    }

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
    case 3: 

    */

    if (schemaName == null) {//no schema defined
        return true
    }
    else {//schema is defined

        schemaValidator = ajv.getSchema(schemaName)//retrieves the schema valdiator from the cache
        if (otherBody !== null && typeof otherBody === "object" && validation && schemaValidator(otherBody)) {//matches schema
            return true
        }
        else {//

            throw new Error("Schema Validation Failed, body was not of the correct format")
        }
    }

}


module.exports = { validateURLFormat, checkValidMethod, validatePathParamTypes, validateSearchParamTypes, validateBodyFormat }