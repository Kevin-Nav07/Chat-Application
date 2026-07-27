const UserService = require('./UserService');
const { verifyPassword, generateRefreshToken, hashRefreshToken, createJWT } = require('../helpers/UserAuthenticator');

const REFRESH_TOKEN_LIFETIME_DAYS = 5;

class AuthService {

    #_dbClient
    constructor(connection) {//connection is an individual client from DbPool
        this.#_dbClient = connection
    }

    //loginMethod
    async login(id, password) {
        try {
            const userService = new UserService(this.#_dbClient);

            //retrieve user
            const user = await userService.getUserAsync(id);
            if (user == null) {
                throw new Error("Requested User does not exist");
            }

            const { passwordhash } = user; //extract password

            //compare password — must be awaited, verifyPassword is async
            const passwordIsValid = await verifyPassword(password, passwordhash);
            if (!passwordIsValid) {
                throw new Error("Incorrect Password");
            }

            //correct password — create refresh token and access token
            const accessToken = await createJWT(id);
            const refreshToken = await this.#insertNewRefreshToken(id); //creates it in the database and returns the unhashed token

            if (refreshToken == null || accessToken == null) {
                throw new Error("Tokens not generated properly");
            }

            return { refreshToken, accessToken }; //refreshToken is a random string from crypto, accessToken is a JWT
        }
        catch (error) {
            throw error;
        }
    }

    //step 1: look up refresh token (and lock the row) and check for expiry
    //step 2: if not found or expired -> throw
    //step 3: if valid -> issue a new access token, delete the old refresh token, insert a new one, all atomically
    //
    // NOTE: every failure path below just throws — the single catch block handles ROLLBACK
    // once, in one place, instead of repeating it before every throw.
    async refresh(refreshToken) {
        try {
            const hashedToken = hashRefreshToken(refreshToken);
            const currentDate = new Date();

            await this.#_dbClient.query("BEGIN");

            // SELECT ... FOR UPDATE locks this row for the duration of the transaction,
            // preventing two concurrent refresh calls with the same token from both succeeding
            const result = await this.#_dbClient.query(
                "SELECT * FROM refresh_tokens WHERE tokenhash = $1 FOR UPDATE",
                [hashedToken]
            );
            const tokenObject = result.rows[0];

            if (tokenObject == null) {
                throw new Error("Refresh Token Not Found");
            }

            if (tokenObject.expiration < currentDate) {
                // Expired. We could delete it here for immediate cleanup, but since the whole
                // transaction rolls back on throw anyway, we just let it be — a future refresh
                // attempt with this same token will hit this same branch, or a periodic cleanup
                // job removes stale rows independently.
                throw new Error("Refresh Token has expired");
            }

            // verification complete — issue a new access token and rotate the refresh token
            const newAccessToken = await createJWT(tokenObject.user_id);

            // rotation: delete the old token, insert a new one, within the same transaction
            await this.#_dbClient.query("DELETE FROM refresh_tokens WHERE id = $1", [tokenObject.id]);
            const newRefreshToken = await this.#insertNewRefreshToken(tokenObject.user_id);

            if (newAccessToken == null || newRefreshToken == null) {
                throw new Error("Error creating new tokens during refresh");
            }

            await this.#_dbClient.query("COMMIT");

            return { accessToken: newAccessToken, refreshToken: newRefreshToken };
        }
        catch (error) {
            await this.#_dbClient.query("ROLLBACK").catch(() => {
                // swallow — if BEGIN itself never ran, or the connection is already broken,
                // ROLLBACK failing here shouldn't mask the original error below
            });
            console.log("Error generating new access token for user: " + error);
            throw error;
        }
    }

    // shared helper — generates, hashes, and inserts a new refresh token for a user.
    // Used by both login() and refresh() to avoid duplicating this logic.
    // NOTE: assumes created_at has a DEFAULT now() in the table, so it isn't passed here.
    async #insertNewRefreshToken(userId) {
        const token = await generateRefreshToken();
        const hashedToken = hashRefreshToken(token);

        if (token == null || hashedToken == null) {
            throw new Error("Issue creating Refresh Token");
        }

        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + REFRESH_TOKEN_LIFETIME_DAYS);

        await this.#_dbClient.query(
            "INSERT INTO refresh_tokens (tokenhash, user_id, expiration) VALUES ($1, $2, $3)",
            [hashedToken, userId, expirationDate]
        );

        return token;
    }

    // Given a raw (unhashed) refresh token, hash it and look up the matching row.
    // Kept as a standalone read for cases where you just need to inspect a token
    // without performing a rotation.
    async getRefreshToken(refreshToken) {
        try {
            const hashedToken = hashRefreshToken(refreshToken);
            const result = await this.#_dbClient.query(
                "SELECT * FROM refresh_tokens WHERE tokenhash = $1",
                [hashedToken]
            );
            return result.rows[0] ?? null;
        }
        catch (error) {
            console.log("Error occurred retrieving refresh token: " + error);
            throw error;
        }
    }

    // Deletes a single refresh token outright (e.g. explicit logout on one device).
    async deleteRefreshToken(refreshToken) {
        const hashedToken = hashRefreshToken(refreshToken);
        await this.#_dbClient.query(
            "DELETE FROM refresh_tokens WHERE tokenhash = $1",
            [hashedToken]
        );
    }

}

module.exports = AuthService;