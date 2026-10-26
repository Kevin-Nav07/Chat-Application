const Ajv = require("ajv")
//schema validaiton library, only used for JSON request bodies
//coerceTypes is deliberately off: JSON bodies already have real types, and with coercion on ajv converts values before
//checking them, so { not: { type: "string" } } turned the number 24 into "24" and then rejected every valid integer.
//path and search paramaters are plain strings and are converted separately in APIValidator.js
const ajv = new Ajv({ allErrors: true, coerceTypes: false })
const { createUserSchema, updateUserSchema, createRoomSchema, loginSchema, createFriendshipSchema, acceptFriendshipSchema } = require("../Models/Schemas")//import our predefined schemas

//every schema a route refers to by name in Models/Routes.js must be registered here under that same name,
//because validateBodyFormat looks schemas up with ajv.getSchema(name)
ajv.addSchema(createUserSchema, "createUserSchema");//add schema to the ajv registry/cache
ajv.addSchema(updateUserSchema, "updateUserSchema");//add schema to the ajv registry/cache
ajv.addSchema(createRoomSchema, "createRoomSchema");
ajv.addSchema(loginSchema, "loginSchema");
ajv.addSchema(createFriendshipSchema, "createFriendshipSchema");
ajv.addSchema(acceptFriendshipSchema, "acceptFriendshipSchema");


module.exports = { ajv }//exports for other modules
//this module will load up all schemas in cache, alternatively schemas can be loaded on-demand to prevent significant time in one go.
//this will also bottleneck the first api call as it has to load all schemas into the cache
//
