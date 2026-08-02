
const crypto = require('crypto');


const CURSOR_SECRET = process.env.CURSOR_SECRET

function encodeParamsIntoCursor(params) {
    if (!params || typeof params !== 'object' || Array.isArray(params)) {
        //return null if params do not exist, are not an object or is an array
        return null;
    }

    // take the object and turn it into a JSON string
    const jsonString = JSON.stringify(params);

    // Convert to a Buffer and encode as 'base64url' (not standard 'base64')
    //we are using base64url because it removes complex chars like '/' '+' in favor of "_"
    //this makes it so that it does not conflict when sent over a search paramater
    const base64Data = Buffer.from(jsonString, 'utf8').toString('base64url');

    // Create a cryptographic signature of the base64 data
    const signature = crypto
        .createHmac('sha256', CURSOR_SECRET)
        .update(base64Data)
        .digest('base64url');

    // Combine the data and signature with a period separator
    return `${base64Data}.${signature}`;
}

/*
 Decodes a Base64 cursor string and strictly validates it against expected parameters.
 */
function decodeCursorIntoParams(cursor, expectedParams = []) {
    if (!cursor || typeof cursor !== 'string') {
        throw new Error("Invalid cursor format: strictly expected a string.");
    }
    // Hard limit the length to prevent memory exhaustion / DoS attacks
    // A standard compound cursor (timestamp + UUID/ID) rarely exceeds 150 bytes
    if (cursor.length > 512) {
        throw new Error("Cursor payload too large. Possible malicious input.");
    }

    // Split the cursor into the data portion and the signature portion
    const parts = cursor.split('.');
    if (parts.length !== 2) {
        throw new Error("Malformed cursor: Missing signature.");
    }

    const [base64Data, providedSignature] = parts;

    // Recalculate what the signature SHOULD be based on the provided data
    const expectedSignature = crypto
        .createHmac('sha256', CURSOR_SECRET)
        .update(base64Data)
        .digest('base64url');

    const expectedBuffer = Buffer.from(expectedSignature);
    const providedBuffer = Buffer.from(providedSignature);

    // SECURITY: timingSafeEqual requires buffers of the exact same length. 
    // We check the length first to prevent a malformed request from crashing Node.js.
    if (
        expectedBuffer.length !== providedBuffer.length ||
        !crypto.timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
        throw new Error("Cursor tampering detected: invalid signature.");
    }

    let parsedParams;

    // We must wrap it in try/catch to prevent a malformed string from crashing the Node process.
    try {
        // ONLY decode the base64Data portion, not the whole cursor!
        const jsonString = Buffer.from(base64Data, 'base64url').toString('utf8');//take the cursor and convert it back to utf-8 string
        parsedParams = JSON.parse(jsonString);//take the stringed JSON and turn it back to a javascript object
    } catch (error) {
        throw new Error("Malformed cursor: failed to parse underlying data.");
    }

    // Validate the parsed data is actually a standard object, not null, an array, or a primitive.
    if (!parsedParams || typeof parsedParams !== 'object' || Array.isArray(parsedParams)) {
        throw new Error("Malformed cursor: underlying data must be a JSON object.");
    }

    //Ensure all expected parameter names exist in the parsed object.
    for (const param of expectedParams) {
        // We use Object.hasOwn to check for existence securely, avoiding prototype chain attacks.
        if (!Object.hasOwn(parsedParams, param)) {
            throw new Error(`Cursor validation failed: missing expected parameter '${param}'.`);
        }
    }

    return parsedParams;
}

module.exports = { decodeCursorIntoParams, encodeParamsIntoCursor }