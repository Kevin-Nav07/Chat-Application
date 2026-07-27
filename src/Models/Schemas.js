

const createUserSchema = {
    //the allof and not keywords basically ensure that type coerceions go a single way
    type: "object",
    properties: {

        email: {
            allOf: [
                { not: { type: "number" } },
                { type: "string" }
            ]
        },
        username: {
            allOf: [
                { not: { type: "number" } },
                { type: "string" }
            ]
        },
        passwordHash: {
            allOf: [
                { not: { type: "number" } },
                { type: "string" }
            ]
        }
    },
    required: ["email", "username", "passwordHash"],
    additionalProperties: false

}

const updateUserSchema = {
    //the allof and not keywords basically ensure that type coerceions go a single way
    type: "object",
    properties: {
        email: {
            allOf: [
                { not: { type: "number" } },
                { type: "string" }
            ]
        },
        username: {
            allOf: [
                { not: { type: "number" } },
                { type: "string" }
            ]
        },
        passwordHash: {
            allOf: [
                { not: { type: "number" } },
                { type: "string" }
            ]
        }
    },
    required: ["email", "username", "passwordHash"],
    additionalProperties: false

}

//*********************** Rooms******************************** */
const createRoomSchema = {
    type: "object",
    properties: {
        room_type: {
            allOf: [
                { not: { type: "number" } },
                { type: "string" }
            ]

        },
        name: {
            allOf: [
                { not: { type: "number" } },
                { type: "string" }
            ]

        },
        users: {//an array of user ids
            type: "array",
            maxItems: 10,//max number of users for a single room
            uniqueItems: true, // ensures the items of the array are unique to prevent duplication
            items: { type: "integer" },

        }


    },
    required: ["room_type", "name", "users"]
}


//**********************Auth *****************************///

const loginSchema = {
    type: "object",
    properties: {
        user_id: {
            type: "number"

        },
        password: {
            allOf: [
                { not: { type: "number" } },
                { type: "string" }
            ]

        }



    },
    required: ["user_id", "password"],
    additionalProperties: false
}
module.exports = { createUserSchema, updateUserSchema, createRoomSchema, loginSchema }