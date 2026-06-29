

const createUserSchema = {
    //the allof and not keywords basically ensure that type coerceions go a single way
    type: "object",
    properties: {
        userid: { type: "integer" },
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
    required: ["userid", "email", "username", "passwordHash"],
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

module.exports = { createUserSchema, updateUserSchema }