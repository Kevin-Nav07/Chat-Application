
const { hashPassword, verifyPassword } = require('../helpers/UserAuthenticator')
const { HttpError, PG_UNIQUE_VIOLATION } = require('../helpers/ErrorExtensions')

class UserService {

    _dbClient//I need a database client instance, what we can do is create an instance from the pool and pass it through
    constructor(connection) {
        this._dbClient = connection
    }

    async getUserAsync(id) {
        try {
            await this._dbClient.query('BEGIN')
            let result = await this._dbClient.query('SELECT id, username, email FROM USERS WHERE id=$1', [id])//selects only safe public user fields without exposing password hashes
            //result variable stores the result object, which contains a lot of database information we can limit down to just the objects
            await this._dbClient.query('COMMIT')
            return result.rows[0]//the array of objects we get back from the database
        }
        catch (exception) {
            console.log("Error occured with database transaction " + exception);
            await this._dbClient.query("ROLLBACK");//undoes everything from the transaction
            throw exception

        }

    }

    async getUserByNameAsync(username) {
        try {
            await this._dbClient.query('BEGIN')
            let result = await this._dbClient.query('SELECT id, username, email FROM USERS WHERE username=$1', [username])//selects only safe public user fields for search and profile lookup
            //result variable stores the result object, which contains a lot of database information we can limit down to just the objects
            await this._dbClient.query('COMMIT')
            return result.rows[0]//the array of objects we get back from the database
        }
        catch (exception) {
            console.log("Error occured with database transaction " + exception);
            await this._dbClient.query("ROLLBACK");//undoes everything from the transaction
            throw exception
        }
    }

    // internal authentication method strictly used by AuthService to verify user password credentials
    async getUserCredentialsByUsernameAsync(username) {
        try {
            await this._dbClient.query('BEGIN')
            let result = await this._dbClient.query('SELECT id, username, passwordhash FROM USERS WHERE username=$1', [username])//explicitly queries password hash for login verification
            await this._dbClient.query('COMMIT')
            return result.rows[0]//returns the single user record containing credential hash
        }
        catch (exception) {
            console.log("Error retrieving credentials for user: " + exception);
            await this._dbClient.query("ROLLBACK");
            throw exception
        }
    }

    //throws a 409 HttpError if another user (other than excludeId) already has this username or email.
    //the users table has no UNIQUE constraint yet, so this check is the only thing stopping duplicate accounts
    async #ensureUsernameAndEmailAvailable(username, email, excludeId = null) {
        const result = await this._dbClient.query(
            `SELECT username, email FROM USERS
             WHERE (lower(username) = lower($1) OR lower(email) = lower($2))
               AND ($3::int IS NULL OR id <> $3)
             LIMIT 1`,
            [username, email, excludeId]
        );//lower() makes the comparison case insensitive so Kevin and kevin count as the same name
        const existing = result.rows[0];
        if (existing == null) {
            return;
        }
        if (existing.username.toLowerCase() === username.toLowerCase()) {
            throw new HttpError(409, "Username is already taken");
        }
        throw new HttpError(409, "Email is already in use");
    }

    //creates a user and returns its public fields, including the id the database generated
    async createUserAsync(body) {
        const { email, username, password } = body // extracts plaintext credentials from the incoming request body
        try {
            await this._dbClient.query('BEGIN')
            await this.#ensureUsernameAndEmailAvailable(username, email);

            const passwordHash = await hashPassword(password) // creates a salted bcrypt hash from the plain password
            const values = [email, username, passwordHash] // binds parameters safely for postgres prepared statement
            //RETURNING hands back the new row so the caller gets the id without a second query
            let result = await this._dbClient.query(`INSERT INTO USERS (email,username,passwordhash) VALUES($1,$2,$3) RETURNING id, username, email`, values)
            await this._dbClient.query('COMMIT')
            return result.rows[0]
        }
        catch (exception) {
            console.log("Error occured when creating user: " + exception);
            await this._dbClient.query("ROLLBACK");//undoes everything from the transaction
            if (exception.code === PG_UNIQUE_VIOLATION) {//only possible once a UNIQUE constraint is added to the table
                throw new HttpError(409, "Username or email is already taken");
            }
            throw exception

        }

    }
    //replaces the user's email, username and password. The caller must prove they know the current password,
    //and afterwards every refresh token of the account is deleted, so every logged in device has to log in again.
    //that is what makes "change your password" actually kick out someone who had stolen a session
    async updateUserAsync(body, id) {
        const { email, username, password, current_password } = body // extracts updated fields including plaintext passwords
        try {
            await this._dbClient.query('BEGIN')
            const existing = await this._dbClient.query('SELECT passwordhash FROM USERS WHERE id=$1 FOR UPDATE', [id]);//FOR UPDATE locks the row until COMMIT so two edits cannot interleave
            if (existing.rowCount === 0) {
                throw new HttpError(404, "User not found");
            }
            if (!(await verifyPassword(current_password, existing.rows[0].passwordhash))) {
                throw new HttpError(403, "Current password is incorrect");
            }
            await this.#ensureUsernameAndEmailAvailable(username, email, id);//the user's own current name and email do not count as taken
            const passwordHash = await hashPassword(password) // hashes the new password with bcrypt before updating the record
            const values = [id, email, username, passwordHash] // binds id and updated fields for parameterized query
            let result = await this._dbClient.query(`UPDATE USERS SET email=$2, username=$3, passwordHash=$4 WHERE id=$1 RETURNING id, username, email`, values)
            if (result.rowCount == 0) {//checked before COMMIT so the catch block can still roll back
                throw new HttpError(404, "User not found");
            }
            await this._dbClient.query('DELETE FROM refresh_tokens WHERE user_id = $1', [id]);//signs the account out everywhere, in the same transaction as the change
            await this._dbClient.query('COMMIT')
            return result.rows[0]
        }
        catch (exception) {
            console.log("Error occured when updating: " + exception);
            await this._dbClient.query("ROLLBACK");//undoes everything from the transaction
            if (exception.code === PG_UNIQUE_VIOLATION) {
                throw new HttpError(409, "Username or email is already taken");
            }
            throw exception

        }

    }

    //deletes a user, their friendships, room memberships and refresh tokens are removed by ON DELETE CASCADE in the database
    async deleteUserAsync(id) {
        try {
            await this._dbClient.query('BEGIN')

            let result = await this._dbClient.query(`DELETE FROM USERS WHERE id = $1 RETURNING id`, [id])//only return the id, never the password hash
            if (result.rowCount == 0) {
                throw new HttpError(404, "User not found");
            }
            await this._dbClient.query('COMMIT')
            return result.rows[0]
        }
        catch (exception) {
            console.log("Error occured when deleting user: " + exception);
            await this._dbClient.query("ROLLBACK");//undoes everything from the transaction
            throw exception

        }

    }


}

module.exports = UserService
