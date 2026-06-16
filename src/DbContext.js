//importing Pool and Client for db connection through the pg library for node-posgres connection
//this import uses these enviornment variable names to retrieve env variables:https://www.postgresql.org/docs/9.1/libpq-envars.html

const { Pool, Client } = require("pg")
require('dotenv').config()//this line loads the environemnt variables into process.env as an object

//each pool will use environment variables for conneciton info

async function main() {
    // Load environment variables from .env file

    const DbPool = new Pool({
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        host: process.env.PGHOST,
        port: process.env.PGPORT,
        database: process.env.PGDATABASE


    })


    const result = await DbPool.query('SELECT * FROM USERS');
    console.log(result)



    // const res = await Pool.query('SELECT NOW()')

}

main()