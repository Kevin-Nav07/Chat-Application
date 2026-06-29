


class UserService {

    _dbClient//I need a database client instance, what we can do is create an instance from the pool and pass it through
    constructor(connection) {
        this._dbClient = connection


    }

    async getUserAsync(id) {
        try {
            await this._dbClient.query('BEGIN')
            let result = await this._dbClient.query('SELECT * FROM USERS WHERE userid=$1', [id])//perform query with prepared statement
            //result variable stores the result object, which contains a lot of database information we can limit down to just the objects
            await this._dbClient.query('COMMIT')
            return result.rows[0]//the array of objects we get back from the database
        }
        catch (exception) {
            console.log("Error occured with database transaction " + exception);
            await this._dbClient.query("ROLLBACK");//undoes everything from the transaction
            throw exception

        }
        finally {
            this._dbClient.release()//releases the client/connection back into the connection pool to be used by others
        }




    }

    async GetUsersAsync(filter) {
        try {
            await this._dbClient.query('BEGIN')
            let result = await this._dbClient.query('SELECT * FROM USERS')//perform query with prepared statement
            //result variable stores the result object, which contains a lot of database information we can limit down to just the objects
            await this._dbClient.query('COMMIT')
            return result.rows//the array of objects we get back from the database
        }
        catch (error) {

            console.log("Error occured when retrieving user: " + exception);
            await this._dbClient.query("ROLLBACK");//undoes everything from the transaction
            throw error
        }
        finally {
            this._dbClient.release()//releases the client/connection back into the connection pool to be used by others
        }

    }

    async createUserAsync(body) {
        const { userid, email, username, passwordHash } = body
        try {
            await this._dbClient.query('BEGIN')
            const values = [userid, email, username, passwordHash]
            let result = await this._dbClient.query(`INSERT INTO USERS (userid,email,username,passwordhash) VALUES($1,$2,$3,$4)`, values)//perform query with prepared statement
            //result variable stores the result object, which contains a lot of database information we can limit down to just the objects
            await this._dbClient.query('COMMIT')
            return result.rows//the array of objects we get back from the database
        }
        catch (exception) {
            console.log("Error occured when retrieving user: " + exception);
            await this._dbClient.query("ROLLBACK");//undoes everything from the transaction
            throw exception

        }
        finally {
            this._dbClient.release()//releases the client/connection back into the connection pool to be used by others
        }

    }
    async updateUserAsync(body, id) {
        const { email, username, passwordHash } = body
        try {
            await this._dbClient.query('BEGIN')
            const values = [id, email, username, passwordHash]
            let result = await this._dbClient.query(`UPDATE USERS SET email=$2, username=$3, passwordHash=$4 WHERE userid=$1`, values)//perform query with prepared statement
            //result variable stores the result object, which contains a lot of database information we can limit down to just the objects
            await this._dbClient.query('COMMIT')
            if (result.rowCount == 0) {
                throw new Error("failed to update user");
            }
            return result.rows//the array of objects we get back from the database
        }
        catch (exception) {
            console.log("Error occured when updating: " + exception);
            await this._dbClient.query("ROLLBACK");//undoes everything from the transaction
            throw exception

        }
        finally {

            this._dbClient.release()//releases the client/connection back into the connection pool to be used by others
        }

    }

    async deleteUserAsync(id) {
        console.log(id, typeof id);

        try {
            await this._dbClient.query('BEGIN')

            let result = await this._dbClient.query(`DELETE FROM USERS WHERE userid = $1 RETURNING *`, [parseInt(id)])//perform query with prepared statement
            //result variable stores the result object, which contains a lot of database information we can limit down to just the objects
            await this._dbClient.query('COMMIT')
            if (result.rowCount == 0) {
                throw new Error("user not deleted");
            }
            console.log("Deleted User!!!")
            return result//the array of objects we get back from the database
        }
        catch (exception) {
            console.log("Error occured when deleting user: " + exception);
            await this._dbClient.query("ROLLBACK");//undoes everything from the transaction
            throw exception

        }
        finally {

            this._dbClient.release()//releases the client/connection back into the connection pool to be used by others
        }

    }
}

module.exports = UserService