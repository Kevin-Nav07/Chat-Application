


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
                if (expectedParamTypes[key] === 'number')//if expected type is number 

                    if (isNumeric(actualParams[key])) {//actual type is a number

                        actualParams[key] = Number(actualParams[key])//convert value for the params
                    }
                    else {//actual type is not a number, throw error
                        throw new Error("path paramater expected to be a number but was not")
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



class APIValidator {
    //takes in a set of validation rules for queryParamaters
    //takes in a set of validation rules for body structure

    queryParamsMap;
    schemaValidator;
    //from the body map 

    constructor(queryParams = null, schemaName = null) {
        //queryParams must be an iterable of key-value pairs of their associated data type(string or integer)
        if (schemaName !== null) {
            this.schemaValidator = ajv.getSchema(schemaName)
        }
        else {
            this.schemaValidator = null;
        }

        if (queryParams !== null) {
            this.queryParamsMap = new Map(Object.entries(queryParams));
        }
        else {
            this.queryParamsMap = null
        }

    }

    validateQueryParamaters(otherParams) {//given another set of queryParamaters(an iterable)
        //since query paramaters are optional, we iterate through what we get incoming and see if it is in the allowable set(queryParamsMap)
        //if it is, then we check the types and ensure the expected matcehs reality
        if (this.queryParamsMap === null) {
            return true;
        }

        const incomingParams = new Map(otherParams.entries())
        console.log(otherParams.entries)
        for (const [key, value] of incomingParams) {
            if (this.queryParamsMap.has(key)) {
                //if the value is a number, then try to convert and see

                if (Number.isFinite(this.queryParamsMap.get(key)) && isNumeric(value)) {//checks if the expected value is a number and the real value is also a number
                    continue
                }

                else if (typeof this.queryParamsMap.get(key) === 'string' && typeof value === 'string' && !isNumeric(value)) {//if the expected value is a string
                    continue
                }
                else {
                    return false
                }
            }
            else {
                return false
            }
        }
        return true
    }
    validateBodyFormat(otherBody) {
        if (this.schemaValidator === null) {
            return true
        }

        if (typeof otherBody === "object" && validation && this.schemaValidator(otherBody)) {
            return true
        }
        else {

            return false
        }

    }
}

module.exports = { validateURLFormat, checkValidMethod, validatePathParamTypes, APIValidator }