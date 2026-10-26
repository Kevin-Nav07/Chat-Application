// An Error that also carries the HTTP status code that should be sent back to the client.
// Services throw it when a request breaks a business rule (bad input, not found, not allowed, duplicate)
// so controllers can respond with the right 4xx code instead of treating every failure as a 500.
class HttpError extends Error {
    constructor(statusCode, message) {
        super(message); // sets error.message exactly like a normal Error would
        this.name = "HttpError"; // makes stack traces and logs show HttpError instead of Error
        this.statusCode = statusCode; // the HTTP status code the controller should respond with
    }
}

// Postgres error codes we react to, see https://www.postgresql.org/docs/current/errcodes-appendix.html
const PG_UNIQUE_VIOLATION = "23505"; // a UNIQUE constraint was broken, for example a duplicate row
const PG_FOREIGN_KEY_VIOLATION = "23503"; // a referenced row does not exist, for example an unknown user id

// Converts any error caught in a controller into the { responseStatusCode, responseBody } shape the router expects.
// An HttpError keeps its own status and message because those were written to be shown to the client.
// Any other error is unexpected, so it becomes a generic 500 and its internal message is not leaked.
function errorToResponse(error, fallbackMessage = "Unexpected server error") {
    if (error instanceof HttpError) {
        return { responseStatusCode: error.statusCode, responseBody: error.message };
    }
    return { responseStatusCode: 500, responseBody: fallbackMessage };
}

module.exports = { HttpError, errorToResponse, PG_UNIQUE_VIOLATION, PG_FOREIGN_KEY_VIOLATION };
