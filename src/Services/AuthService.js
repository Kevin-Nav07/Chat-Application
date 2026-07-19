const UserService = require('./UserService');
const { verifyPassword, generateRefreshToken, hashRefreshToken, createJWT } = require('../helpers/UserAuthenticator');
class AuthService {

    #_dbClient
    constructor(connection) {//connection is an individual client form DbPool
        this.#_dbClient = connection
    }

    //loginMethod
    async login(body)//expected body {id: 21, password: example123}
    {
        try {
            const { id, password } = body
            const userService = new UserService(this.#_dbClient);

            //retrieve user
            let user = await userService.getUserAsync(id);
            if (user === null || user === undefined) {
                throw new Error("Requested User does not exist");
            }
            else {//found a user
                const { passwordhash } = user;//extract password
                //compare passsword
                if (verifyPassword(password, passwordhash)) {//correct password
                    //create refresh token and access token
                    const refreshToken = await this.createRefreshToken(id);//this creates it int he database and returns the unhashed token to give back
                    const accessToken = await createJWT(id);

                    return { refreshToken, accessToken }//refresh token is a random string we generated with crypto library, access token is created using JWT
                }
                else {
                    throw new Error("Incorrect Password");
                }

            }
            /* first retrieve the user associated with the id, then hash the current password with the salt */
        }
        catch (error) {
            throw error;

        }
    }


    //createRefreshToken

    async createRefreshToken(userid) {
        //createRefreshToken happens when a user first logs in, in which they create both refresh and access token, or if they just need to create a new token after deleting a prior one
        //the only information we need to create a refreshToken is the userId, we merely generate a new token for the user and store it in the db
        try {
            const token = await generateRefreshToken();
            const hashedToken = hashRefreshToken(token);
            const currentDate = new Date()
            const expirationDate = new Date()
            expirationDate.setDate(date.getDate() + 5);//5 day expiration date from current time

            await this.#_dbClient.query("BEGIN");
            const values = [tokenHash, userid, expirationDate, currentDate];
            await this.#_dbClient.query("INSERT INTO REFRESH_TOKENS (token,user_id,expiration,created_at) VALUES ($1,$2,$3,$4)", values);

            await this.#_dbClient.query("COMMIT");

            return token;

        }
        catch (error) {
            await this.#_dbClient.query("ROLLBACK");
            throw error

        }
        finally {
            // this.#_dbClient.release()
        }

    }

    //createAccessToken
    //this method is used when the access token has expired and we need to create a new access token
    async createNewAccessToken(refreshToken) {
        try {
            const currentDate = new Date()
            const hashedToken = hashRefreshToken(refreshToken);
            const tokenObject = await this.getRefreshToken(hashedToken)
            if (tokenObject !== null || tokenObject !== undefined) {//token found
                //check for expiry 
                if (tokenObject.expiration < currentDate) {//if the expiration date has passed
                    throw new Error("Expiraiton Date passed");

                }
                else {//expiration date is in the future.
                    //verification of RefreshToken is now complete, we proceed with creating the access token.

                    const newToken = tokenObject?.user_id ? createJWT() : null
                    if (newToken === null) {
                        throw new Error("Error with creating new access token ");
                    }



                }

            }

        }
        catch (error) {
            console.log("error gneerating new access token for user");
            throw error;
        }

        //step 1:look up refresh token and check for expiry and return object
        // if we cant find token then throw error
        //step 2: if access token is found, then check for expiry date and if it is expired then throw another error
        //step 3: if it is not expired and found, then verification is done, we now create the access token and return it to the client
    }


    async getRefreshToken(hashedToken) {//given a current refreshToken, check the RefreshToken table for the hashed value and return the object
        try {

            await this.#_dbClient.query("BEGIN");

            let results = await this.#_dbClient.query("SELECT * FROM REFRESH_TOKENS WHERE tokenHash = (?) ", [hashedToken]);
            await this.#_dbClient.query("COMIT");
            return results.rows[0]
        }
        catch (error) {
            await this.#_dbClient.query("ROLLBACKK");
            console.log("Error occured retrieveing refresh token");
            throw error;
        }


    }

    //deletRefreshToken



}

module.exports = AuthService;