//importing Pool and Client for db connection through the pg library for node-posgres connection
//this import uses these enviornment variable names to retrieve env variables:https://www.postgresql.org/docs/9.1/libpq-envars.html

const { Pool, Client } = require("pg")  // Load environment variables from .env file



//each pool will use environment variables for conneciton info
class DbPool {
    static pool

    static createPool() {
        this.pool = new Pool({ //connecting to a db pool for pg driver directly
            user: process.env.PGUSER,
            password: process.env.PGPASSWORD,
            host: process.env.PGHOST,
            port: process.env.PGPORT,
            database: process.env.PGDATABASE


        });
        console.log("Db Pool created")

        // the pool will emit an error on behalf of any idle clients
        // it contains if a backend error or network partition happens
        this.pool.on('error', (err, client) => {
            console.error('Unexpected error on idle client', err)
            process.exit(-1)
        })

    }


    static async provideClient() {//from the connection pool provide a new client
        return await this.pool.connect()
    }

}

module.exports = DbPool
