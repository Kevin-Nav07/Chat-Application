

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
class APIValidator {
    //takes in a set of validation rules for queryParamaters
    //takes in a set of validation rules for body structure

    queryParamsMap;
    schemaValidator;
    //from the body map 

    constructor(queryParams, schemaName) {
        //queryParams must be an iterable of key-value pairs of their associated data type(string or integer)
        this.schemaValidator = ajv.getSchema(schemaName)
        this.queryParamsMap = new Map(queryParams);

    }

    validateQueryParamaters(otherParams) {//given another set of queryParamaters(an iterable)
        //ensure that the queryParamaters follow the same format in that each key in our map must exist in otherParam and when it does we check if 
        //the data types of the values match
        //convert otherParams into a map as well
        const incomingParams = new Map(otherParams.entries())
        console.log(otherParams.entries)
        for (const [key, value] of this.queryParamsMap) {
            if (incomingParams.has(key)) {
                //if the value is a number, then try to convert and see
                console.log(typeof incomingParams.get(key))
                console.log(typeof value)
                if (Number.isFinite(value) && isNumeric(incomingParams.get(key))) {//checks if the expected value is a number and the real value is also a number
                    continue
                }

                else if (typeof value === 'string' && typeof incomingParams.get(key) === 'string' && !isNumeric(incomingParams.get(key))) {//if the expected value is a string
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
        if (typeof otherBody === "object" && this.schemaValidator(otherBody)) {
            return true
        }
        else {
            return false
        }

    }
}

module.exports = { validateURLFormat, checkValidMethod, APIValidator }