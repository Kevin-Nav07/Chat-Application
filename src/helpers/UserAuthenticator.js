const bcrypt = require('bcrypt')
const SALT_ROUNDS = 12;
const jwt = require('jsonwebtoken')
const util = require('util')
const crypto = require('crypto');


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
        const givenDate = new Date();
        const expirationDate = new Date();
        let asyncSign = util.promisify(jwt.sign)
        const expirationTime = expirationDate.setMinutes(expirationDate.getMinutes() + 60);///set expiration as 1 hour ahead of current date
        const payload = {
            user: userId,

        }
        value = await asyncSign(payload, sec, { expiresIn: '1h' });//creates and signs a token with given payload, expiration time and secret



    }
    return value

}

async function verifyJWT(token) {
    let verify = util.promisify(jwt.verify)
    try {
        const result = await verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] })
        return result;
    }
    catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            console.log("either malformed or incorrect token");
        }
        else if (error instanceof TokenExpiredError) {
            console.log("JWT token expired");
        }
        else {
            console.log("unexpected jwt verification error", error)
        }
        throw error

    }
}

async function generateRefreshToken() {
    const secureString2 = crypto.randomBytes(32).toString('hex')
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

function setCookies(outgoingRequest, cookies) {//outgoingRequest is of type OutgoingRequest from node js http library
    //cookies is an object containing all the cookies in key-value pairs
    const cookiesArray = []
    for (const [key, value] of Object.entries(cookies)) {
        if (key != null && value != null) {

            //this encoding prevents CRLF attacks
            const safeKey = encodeURIComponent(key);
            const safeValue = encodeURIComponent(value);
            cookiesArray.push(`${safeKey}=${safeValue}; Secure; HttpOnly; SameSite=Strict; Path=/`);
        }

    }
    if (cookiesArray.length > 0) {
        outgoingRequest.setHeader("Set-Cookie", cookiesArray);
    }/// this takes in a single header name, then for each entry of the
    //cookiesArray it creates a seperate "Set-Cookie" header for every cookie


}
module.exports = { hashPassword, verifyPassword, createJWT, verifyJWT, generateRefreshToken, hashRefreshToken, setCookies }