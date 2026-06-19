const Ajv = require("ajv")
const ajv = new Ajv({ allErrors: true, coerceTypes: true })//schema validaiton library
//coercetypes allows for type conversion for string to integer
const { createUserSchema } = require("../Models/Schemas")//import our predefined schemas

ajv.addSchema(createUserSchema, "createUserSchema");//add schema to the ajv registry/cache


module.exports = { ajv }//exports for other modules
//this module will load up all schemas in cache, alternatively schemas can be loaded on-demand to prevent significant time in one go.
//this will also bottleneck the first api call as it has to load all schemas into the cache
//

