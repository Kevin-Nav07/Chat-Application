

//reusable field definitions shared by the create and update user schemas
//the allof and not keywords basically ensure that type coerceions go a single way
const usernameField = {
    allOf: [
        { not: { type: "number" } },
        { type: "string", minLength: 3, maxLength: 32, pattern: "^[a-zA-Z0-9_-]+$" }//only url safe characters so GET /users/name/:username can always find the user
    ]
}

const emailField = {
    allOf: [
        { not: { type: "number" } },
        { type: "string", maxLength: 254, pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$" }//simple something@something.something check, full email validation would need the ajv-formats package
    ]
}

const passwordField = {
    allOf: [
        { not: { type: "number" } },
        { type: "string", minLength: 8, maxLength: 72 }//bcrypt only uses the first 72 bytes of a password, so longer ones give a false sense of security
    ]
}

const createUserSchema = {
    type: "object",
    properties: {
        email: emailField,
        username: usernameField,
        password: passwordField
    },
    required: ["email", "username", "password"],
    additionalProperties: false

}

const updateUserSchema = {
    //PUT replaces the whole user, so every field is still required
    type: "object",
    properties: {
        email: emailField,
        username: usernameField,
        password: passwordField
    },
    required: ["email", "username", "password"],
    additionalProperties: false

}

//*********************** Rooms******************************** */
const createRoomSchema = {
    type: "object",
    properties: {
        room_type: {
            allOf: [
                { not: { type: "number" } },
                { type: "string", enum: ["direct", "group"] }//direct is a 1 on 1 chat, group is anything bigger
            ]

        },
        name: {
            allOf: [
                { not: { type: "number" } },
                { type: "string", minLength: 1, maxLength: 100 }
            ]

        },
        users: {//an array of user ids, the creator is added automatically so they do not need to be in here
            type: "array",
            maxItems: 10,//max number of users for a single room
            uniqueItems: true, // ensures the items of the array are unique to prevent duplication
            items: { type: "integer", minimum: 1 },

        }


    },
    required: ["room_type", "name", "users"],
    additionalProperties: false
}


//**********************Auth *****************************///

const loginSchema = {
    type: "object",
    properties: {
        username: {
            allOf: [
                { not: { type: "number" } },
                { type: "string" }
            ]
        },
        password: {
            allOf: [
                { not: { type: "number" } },
                { type: "string" }
            ]
        }
    },
    required: ["username", "password"],
    additionalProperties: false
}

//**********************Friendships *****************************///

const createFriendshipSchema = {
    type: "object",
    properties: {
        receiver_id: {
            allOf: [
                { not: { type: "string" } },
                { type: "integer", minimum: 1 }
            ]
        }

    },
    required: ["receiver_id"],
    additionalProperties: false
}

const acceptFriendshipSchema = {
    type: "object",
    properties: {
        request_id: {
            allOf: [
                { not: { type: "string" } },
                { type: "integer", minimum: 1 }
            ]
        }
    },
    required: ["request_id"],
    additionalProperties: false
}

module.exports = { createFriendshipSchema, acceptFriendshipSchema, createUserSchema, updateUserSchema, createRoomSchema, loginSchema }
