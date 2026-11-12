//importing Pool for db connection through the pg library for node-postgres connection
//this import uses these enviornment variable names to retrieve env variables:https://www.postgresql.org/docs/9.1/libpq-envars.html

const { Pool } = require("pg")
const fs = require("node:fs")

// Builds the TLS (encryption) settings for the database connection. Encryption is always on, so messages,
// emails and password hashes never cross the internet in plain text between this server and Supabase.
//
// Encryption alone is not enough: the server must also check it is talking to the real Supabase and not to someone
// in the middle pretending to be it. That check needs Supabase's CA certificate (download it from the Supabase
// dashboard, Database settings, SSL Configuration). It is read from one of:
//   PG_CA_CERT       the certificate's text pasted into an environment variable (easiest on hosting platforms)
//   PG_CA_CERT_PATH  a path to the .crt file (easiest locally, for example certs/prod-ca-2021.crt)
//
// In production a missing certificate stops the server from starting. In development the connection is still
// encrypted but not verified, with a warning, so local work keeps going until the certificate is downloaded
function buildSslOptions() {
    let ca = process.env.PG_CA_CERT;
    if (ca != null && ca.includes("\\n")) {
        ca = ca.replaceAll("\\n", "\n"); // some dashboards store a multi line value with literal \n, this turns them back into line breaks
    }
    if ((ca == null || ca.trim() === "") && process.env.PG_CA_CERT_PATH) {
        ca = fs.readFileSync(process.env.PG_CA_CERT_PATH, "utf8"); // throws with a clear "no such file" error if the path is wrong
    }
    if (ca != null && ca.trim() !== "") {
        return { rejectUnauthorized: true, ca }; // encrypted, and the server's certificate must be signed by Supabase's CA
    }
    if (process.env.NODE_ENV === "production") {
        throw new Error("PG_CA_CERT or PG_CA_CERT_PATH must be set in production so the database connection can be verified");
    }
    console.warn("WARNING: database connection is encrypted but NOT verified. Set PG_CA_CERT_PATH to Supabase's CA certificate.");
    return { rejectUnauthorized: false };
}

//each pool will use environment variables for conneciton info
class DbPool {
    static pool

    static createPool() {
        this.pool = new Pool({ //connecting to a db pool for pg driver directly
            user: process.env.PGUSER,
            password: process.env.PGPASSWORD,
            host: process.env.PGHOST,
            port: process.env.PGPORT,
            database: process.env.PGDATABASE,
            ssl: buildSslOptions(), // an explicit ssl option also overrides any PGSSLMODE variable, so encryption cannot be turned off by accident
            max: 10, // the most database connections this server holds open at once, well inside Supabase's free tier limit
            connectionTimeoutMillis: 10000, // give up on getting a connection after 10 seconds instead of waiting forever
        });
        console.log("Db Pool created")

        // the pool emits an error when an idle connection breaks, for example Supabase restarting or a network blip.
        // The pool already throws that connection away and opens a new one when needed, so this is only logged.
        // It used to call process.exit, which took the whole chat server down over one dropped idle connection
        this.pool.on('error', (err) => {
            console.error('Unexpected error on idle database client', err)
        })

    }


    static async provideClient() {//from the connection pool provide a new client
        return await this.pool.connect()
    }

}

module.exports = DbPool
