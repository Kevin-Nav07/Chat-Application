const bcrypt = require('bcrypt')
const SALT_ROUNDS = 12;
const jwt = require('jsonwebtoken')
const util = require('util')
const crypto = require('crypto');
const APIResponseObj = require('../Models/APIResponseObj');


async function hashPassword(password) {

    return await bcrypt.hash(password, SALT_ROUNDS)//asynchronously hashes the password and adds a salt to it
}

async function verifyPassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);//compares the incoming unhashed password by hashing it and 
    // extracting the salt to the stored db hashed and salted password


}



//creating a JWT, we need to create the header, then payload which will just include the user_id
async function createJWT(userId) {// by default every token will have a time of 1 hour minutes before re-verification
    let value = undefined;
    if (userId === undefined || userId === null) {
        throw new Error("Error creating access token, invalid userId");
    }
    else {
        const sec = process.env.JWT_SECRET;//retrieve the JWT secret we created
        let asyncSign = util.promisify(jwt.sign)
        const payload = {
            user_id: userId,

        }
        value = await asyncSign(payload, sec, { expiresIn: '1h' });//creates and signs a token with given payload, expiration time and secret



    }
    return value

}



async function verifyJWT(cookies) {//takes in a cookies object, parses the cookies, verifies the token,extracts object or user_id
    //then proceeds to check
    let verify = util.promisify(jwt.verify);
    const token = cookies?.accessToken;//extract token from cookies
    if (token == null) {//if no token found return status code
        return new APIResponseObj(401, "token not found", "Unauthorized")
    }
    //token is found, now verification process
    try {
        //verify then return verified object
        const result = await verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] })//this will throw if false
        return result;//decoded payloald object when creating the token
    }
    catch (error) {

        //TokenExpiredError is a subclass of JsonWebTokenError, so it has to be checked first or it would be reported as malformed.
        //the frontend relies on the "Expired Token" message to know it should call /auth/refresh instead of logging the user out
        if (error instanceof jwt.TokenExpiredError) {
            return new APIResponseObj(401, "Expired Token", "Unauthorized");
        }
        else if (error instanceof jwt.JsonWebTokenError) {
            return new APIResponseObj(401, "Incorrect or Malformed Token", "Unauthorized");
        }
        else {

            return new APIResponseObj(500, "Unexpected error with token verification", "Internal Server Error")
        }

    }

}


async function generateRefreshToken() {
    const randomBytesAsync = util.promisify(crypto.randomBytes);
    const secureString = await randomBytesAsync(32);//this generates a random string serving as our refreshToken
    return secureString.toString('hex');
}

function hashRefreshToken(token) {//this method of hashing is less complicated than bycrpt, making it easier to crack but
    //since refresh tokens are already long, hashing it is just extra security
    const hash = crypto.createHash('sha256');//creates hashing object
    hash.update(token);//creates the hash for the token
    return hash.digest('base64');//returns the hashed token in base64 format

}

//how long each cookie should live in the browser, in seconds, matching the lifetime of the token inside it
const COOKIE_MAX_AGE_SECONDS = {
    accessToken: 60 * 60, // 1 hour, same as the JWT expiresIn
    refreshToken: 60 * 60 * 24 * 5 // 5 days, same as REFRESH_TOKEN_LIFETIME_DAYS in AuthService
};

//builds one Set-Cookie header per cookie. An empty string value means "delete this cookie",
//which is done by sending Max-Age=0 so the browser expires it immediately
function setCookies(outgoingRequest, cookies) {//outgoingRequest is of type OutgoingRequest from node js http library
    //cookies is an object containing all the cookies in key-value pairs
    const cookiesArray = []
    for (const [key, value] of Object.entries(cookies)) {
        if (key != null && value != null) {

            //this encoding prevents CRLF attacks
            const safeKey = encodeURIComponent(key);
            const safeValue = encodeURIComponent(value);
            const maxAge = value === "" ? 0 : COOKIE_MAX_AGE_SECONDS[key];
            const maxAgeAttribute = maxAge != null ? `; Max-Age=${maxAge}` : "";//cookies without Max-Age only last until the browser closes
            cookiesArray.push(`${safeKey}=${safeValue}; Secure; HttpOnly; SameSite=Strict; Path=/${maxAgeAttribute}`);
        }

    }
    if (cookiesArray.length > 0) {
        outgoingRequest.setHeader("Set-Cookie", cookiesArray);
    }/// this takes in a single header name, then for each entry of the
    //cookiesArray it creates a seperate "Set-Cookie" header for every cookie


}
module.exports = { hashPassword, verifyPassword, createJWT, verifyJWT, generateRefreshToken, hashRefreshToken, setCookies }