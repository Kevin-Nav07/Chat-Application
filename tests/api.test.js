// loads environment variables from .env file for database and jwt secrets
require('dotenv').config({ quiet: true });

// imports the native node test runner modules and assertion library
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');

// imports the database pool and routing system
const DbPool = require('../src/DbPool');
const { route, registerAllRoutes } = require('../src/Router');
const { createJWT, setCookies } = require('../src/helpers/UserAuthenticator');
const MessageService = require('../src/Services/MessageService');

// unique suffix for this test run to prevent collisions with existing database records
const timestamp = Date.now();
const PASSWORD = "Password123!";

// builds the credentials for one test user, label keeps each user's name unique within the run
function makeUser(label) {
    return {
        username: `test_user_${label}_${timestamp}`,
        email: `user${label}_${timestamp}@example.com`,
        password: PASSWORD,
        id: null,
        cookies: null
    };
}

// A and B become friends and share a room, C is a stranger used for authorization tests, D deletes their own account
const userA = makeUser("a");
const userB = makeUser("b");
const userC = makeUser("c");
const userD = makeUser("d");

// ids of every room created during the run so teardown can remove them
const createdRoomIds = [];

// signs up a user through the real POST /users endpoint, then stores its id and a valid access token cookie on the object
async function signUp(user) {
    const res = await route(
        { username: user.username, email: user.email, password: user.password },
        "/users",
        "POST",
        null
    );
    assert.strictEqual(res.responseStatusCode, 201, `Creating ${user.username} must return 201`);
    assert.strictEqual(res.responseBody.username, user.username, "Sign up must return the created user");
    assert.strictEqual(res.responseBody.passwordhash, undefined, "Sign up must never return the password hash");
    user.id = res.responseBody.id; // sign up now returns the created user, so no extra lookup is needed
    user.cookies = { accessToken: await createJWT(user.id) };
}

// global setup runs before any tests execute
before(async () => {
    // initializes the postgres connection pool
    DbPool.createPool();
    // compiles regex patterns for all routes in routeList
    registerAllRoutes();

    for (const user of [userA, userB, userC, userD]) {
        await signUp(user);
    }
});

// global teardown runs after all test suites finish
after(async () => {
    const userIds = [userA.id, userB.id, userC.id, userD.id].filter(id => id != null);
    const client = await DbPool.provideClient();
    try {
        // rooms are not owned by a user, so they are removed explicitly. room_members rows cascade with them
        if (createdRoomIds.length > 0) {
            await client.query("DELETE FROM rooms WHERE id = ANY($1)", [createdRoomIds]);
        }
        // friendships, refresh tokens and room memberships all use ON DELETE CASCADE, so deleting users removes them too
        if (userIds.length > 0) {
            await client.query("DELETE FROM users WHERE id = ANY($1)", [userIds]);
        }
    }
    catch (err) {
        console.log("Teardown cleanup error:", err);
    }
    finally {
        client.release(); // releases client back to pool
    }
    await DbPool.pool.end(); // closes all pool connections so the node process can exit cleanly
});

// tests the router itself, independent of any one controller
describe("Router", () => {
    test("unknown URL returns 404", async () => {
        const res = await route(null, "/does-not-exist", "GET", null);
        assert.strictEqual(res.responseStatusCode, 404);
    });

    test("known URL with the wrong method returns 405", async () => {
        const res = await route(null, "/auth/login", "GET", null);
        assert.strictEqual(res.responseStatusCode, 405);
    });

    test("unsupported HTTP method returns 405", async () => {
        const res = await route(null, "/users", "PATCH", null);
        assert.strictEqual(res.responseStatusCode, 405);
    });

    test("malformed path returns 400", async () => {
        const res = await route(null, "/users/a.b", "GET", userA.cookies);
        assert.strictEqual(res.responseStatusCode, 400);
    });

    // the HTTP server always passes the client's address; this test passes one by hand to switch the per address limits on.
    // 203.0.113.x is an address range reserved for documentation, so it can never belong to a real client
    test("login is rate limited per address: the 11th attempt in 5 minutes returns 429", async () => {
        const options = { clientIp: "203.0.113.77" };
        const credentials = { username: `nobody_${timestamp}`, password: "WrongPassword1!" };
        for (let i = 1; i <= 10; i++) {
            const res = await route(credentials, "/auth/login", "POST", null, options);
            assert.strictEqual(res.responseStatusCode, 401, `Attempt ${i} must still reach the login check`);
        }
        const blocked = await route(credentials, "/auth/login", "POST", null, options);
        assert.strictEqual(blocked.responseStatusCode, 429);

        const otherAddress = await route(credentials, "/auth/login", "POST", null, { clientIp: "203.0.113.78" });
        assert.strictEqual(otherAddress.responseStatusCode, 401, "A different address must not be blocked");
    });
});

// tests authentication endpoints
describe("Authentication Endpoints", () => {
    // refresh token from the most recent successful login or refresh, reused by later tests in this suite
    let currentRefreshToken = null;

    // tests successful login flow with matching credentials
    test("POST /auth/login - returns 200, sets both token cookies and returns the user", async () => {
        const res = await route(
            { username: userA.username, password: userA.password },
            "/auth/login",
            "POST",
            null
        );
        assert.strictEqual(res.responseStatusCode, 200, "Login must return 200");
        assert.ok(res.responseCookies?.accessToken, "Response must include an accessToken cookie");
        assert.ok(res.responseCookies?.refreshToken, "Response must include a refreshToken cookie");
        assert.strictEqual(res.responseBody.user.id, userA.id, "Body must say which user logged in");
        assert.strictEqual(res.responseBody.accessToken, undefined, "Tokens must only travel in HttpOnly cookies");
        currentRefreshToken = res.responseCookies.refreshToken;
    });

    // tests failed login with incorrect password
    test("POST /auth/login - wrong password returns 401", async () => {
        const res = await route(
            { username: userA.username, password: "WrongPassword123!" },
            "/auth/login",
            "POST",
            null
        );
        assert.strictEqual(res.responseStatusCode, 401);
    });

    // tests failed login with non-existent username, same response as a wrong password so usernames cannot be probed
    test("POST /auth/login - unknown user returns 401 with the same message as a wrong password", async () => {
        const res = await route(
            { username: `nonexistent_user_${timestamp}`, password: PASSWORD },
            "/auth/login",
            "POST",
            null
        );
        assert.strictEqual(res.responseStatusCode, 401);
        assert.strictEqual(res.responseBody, "Invalid username or password");
    });

    test("POST /auth/login - missing password returns 400", async () => {
        const res = await route({ username: userA.username }, "/auth/login", "POST", null);
        assert.strictEqual(res.responseStatusCode, 400);
    });

    // tests that a refresh issues new tokens and rotates the refresh token
    test("POST /auth/refresh - valid refresh token returns 200 with a new, different refresh token", async () => {
        const res = await route(null, "/auth/refresh", "POST", { refreshToken: currentRefreshToken });
        assert.strictEqual(res.responseStatusCode, 200);
        assert.ok(res.responseCookies?.accessToken, "Refresh must issue a new access token");
        assert.ok(res.responseCookies?.refreshToken, "Refresh must issue a new refresh token");
        assert.notStrictEqual(res.responseCookies.refreshToken, currentRefreshToken, "Refresh token must be rotated");

        // the old token was deleted during rotation, so using it again must fail
        const reuse = await route(null, "/auth/refresh", "POST", { refreshToken: currentRefreshToken });
        assert.strictEqual(reuse.responseStatusCode, 401, "A rotated refresh token must not work twice");

        currentRefreshToken = res.responseCookies.refreshToken;
    });

    test("POST /auth/refresh - missing refresh token returns 401", async () => {
        const res = await route(null, "/auth/refresh", "POST", null);
        assert.strictEqual(res.responseStatusCode, 401);
    });

    test("POST /auth/refresh - unknown refresh token returns 401", async () => {
        const res = await route(null, "/auth/refresh", "POST", { refreshToken: "not-a-real-token" });
        assert.strictEqual(res.responseStatusCode, 401);
        // a dead refresh token must be removed from the browser so it does not keep failing on every visit
        assert.strictEqual(res.responseCookies?.accessToken, "", "accessToken cookie must be cleared");
        assert.strictEqual(res.responseCookies?.refreshToken, "", "refreshToken cookie must be cleared");
    });

    // tests logout deletes the refresh token and tells the browser to clear both cookies
    test("POST /auth/logout - returns 200, clears cookies and invalidates the refresh token", async () => {
        const res = await route(null, "/auth/logout", "POST", { refreshToken: currentRefreshToken });
        assert.strictEqual(res.responseStatusCode, 200, "Logout must return 200");
        assert.strictEqual(res.responseCookies?.accessToken, "", "accessToken cookie must be cleared");
        assert.strictEqual(res.responseCookies?.refreshToken, "", "refreshToken cookie must be cleared");

        const refreshAfterLogout = await route(null, "/auth/refresh", "POST", { refreshToken: currentRefreshToken });
        assert.strictEqual(refreshAfterLogout.responseStatusCode, 401, "Refresh token must not work after logout");
    });

    // regression test: logging out without a cookie used to throw an unhandled rejection that crashed node
    test("POST /auth/logout - without any cookie still returns 200", async () => {
        const res = await route(null, "/auth/logout", "POST", null);
        assert.strictEqual(res.responseStatusCode, 200);
    });

    test("protected route - expired access token returns 401 'Expired Token'", async () => {
        // exp is in seconds, set one minute in the past
        const expiredToken = jwt.sign({ user_id: userA.id, exp: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET);
        const res = await route(null, "/users/me", "GET", { accessToken: expiredToken });
        assert.strictEqual(res.responseStatusCode, 401);
        assert.strictEqual(res.responseBody, "Expired Token", "Frontend needs to tell expired apart from malformed");
    });

    test("protected route - token signed with the wrong secret returns 401", async () => {
        const forgedToken = jwt.sign({ user_id: userA.id }, "not-the-real-secret");
        const res = await route(null, "/users/me", "GET", { accessToken: forgedToken });
        assert.strictEqual(res.responseStatusCode, 401);
    });

    // unit test of the cookie writer, an empty value must expire the cookie in the browser
    test("setCookies - empty value is sent with Max-Age=0, real tokens get their lifetime", () => {
        const headers = {};
        const fakeResponse = { setHeader: (name, value) => { headers[name] = value; } };
        setCookies(fakeResponse, { accessToken: "", refreshToken: "abc" });
        const [accessCookie, refreshCookie] = headers["Set-Cookie"];
        assert.match(accessCookie, /^accessToken=;.*Max-Age=0/);
        assert.match(refreshCookie, /^refreshToken=abc;.*HttpOnly.*Max-Age=432000/);
    });
});

// tests user profile and lookup endpoints
describe("User Endpoints", () => {
    // tests schema validation when creating a user with missing fields
    test("POST /users - missing fields returns 400", async () => {
        const res = await route({ username: "missingfields" }, "/users", "POST", null);
        assert.strictEqual(res.responseStatusCode, 400);
    });

    test("POST /users - password shorter than 8 characters returns 400", async () => {
        const res = await route(
            { username: `short_pw_${timestamp}`, email: `shortpw_${timestamp}@example.com`, password: "abc" },
            "/users",
            "POST",
            null
        );
        assert.strictEqual(res.responseStatusCode, 400);
    });

    test("POST /users - duplicate username returns 409", async () => {
        const res = await route(
            { username: userA.username, email: `other_${timestamp}@example.com`, password: PASSWORD },
            "/users",
            "POST",
            null
        );
        assert.strictEqual(res.responseStatusCode, 409);
    });

    test("POST /users - duplicate email with different casing returns 409", async () => {
        const res = await route(
            { username: `other_user_${timestamp}`, email: userA.email.toUpperCase(), password: PASSWORD },
            "/users",
            "POST",
            null
        );
        assert.strictEqual(res.responseStatusCode, 409);
    });

    test("GET /users/me - returns the logged in user's own profile including email", async () => {
        const res = await route(null, "/users/me", "GET", userA.cookies);
        assert.strictEqual(res.responseStatusCode, 200);
        assert.strictEqual(res.responseBody.id, userA.id);
        assert.strictEqual(res.responseBody.email, userA.email);
    });

    test("GET /users/me - without a token returns 401", async () => {
        const res = await route(null, "/users/me", "GET", null);
        assert.strictEqual(res.responseStatusCode, 401);
    });

    // tests retrieval of user by numeric id and verifies password hash is omitted
    test("GET /users/:id - own profile includes email but no password hash", async () => {
        const res = await route(null, `/users/${userA.id}`, "GET", userA.cookies);
        assert.strictEqual(res.responseStatusCode, 200);
        assert.strictEqual(res.responseBody.username, userA.username);
        assert.strictEqual(res.responseBody.email, userA.email);
        assert.strictEqual(res.responseBody.passwordhash, undefined, "passwordhash must never be exposed");
    });

    test("GET /users/:id - another user's profile hides their email", async () => {
        const res = await route(null, `/users/${userB.id}`, "GET", userA.cookies);
        assert.strictEqual(res.responseStatusCode, 200);
        assert.strictEqual(res.responseBody.username, userB.username);
        assert.strictEqual(res.responseBody.email, undefined, "emails are private to their owner");
    });

    // tests 404 response when querying non-existent numeric id
    test("GET /users/:id - non-existent user ID returns 404", async () => {
        const res = await route(null, "/users/99999999", "GET", userA.cookies);
        assert.strictEqual(res.responseStatusCode, 404);
    });

    // tests path parameter validation when passing string instead of integer
    test("GET /users/:id - non-numeric id returns 400", async () => {
        const res = await route(null, "/users/notanumber", "GET", userA.cookies);
        assert.strictEqual(res.responseStatusCode, 400);
    });

    // tests retrieval of user by username for search functionality
    test("GET /users/name/:username - returns the user without email or password hash", async () => {
        const res = await route(null, `/users/name/${userB.username}`, "GET", userA.cookies);
        assert.strictEqual(res.responseStatusCode, 200);
        assert.strictEqual(res.responseBody.id, userB.id);
        assert.strictEqual(res.responseBody.email, undefined);
        assert.strictEqual(res.responseBody.passwordhash, undefined);
    });

    // the signup form checks whether a username is free before the person has an account, so this route needs no token
    test("GET /users/name/:username - works without a token and still hides the email", async () => {
        const res = await route(null, `/users/name/${userB.username}`, "GET", null);
        assert.strictEqual(res.responseStatusCode, 200);
        assert.strictEqual(res.responseBody.email, undefined);
    });

    // digits are allowed in usernames, so an all digit name must be looked up like any other string
    test("GET /users/name/:username - an all digit username is treated as a string, not rejected", async () => {
        const res = await route(null, `/users/name/1234567890${timestamp}`, "GET", null);
        assert.strictEqual(res.responseStatusCode, 404);
    });

    // tests 404 response for non-existent username search
    test("GET /users/name/:username - unknown username returns 404", async () => {
        const res = await route(null, `/users/name/unknown_${timestamp}`, "GET", userA.cookies);
        assert.strictEqual(res.responseStatusCode, 404);
    });

    // listing every user was removed because it handed out every account id; POST /users still exists on the same path
    test("GET /users - listing every user is not available (405)", async () => {
        const res = await route(null, "/users", "GET", userA.cookies);
        assert.strictEqual(res.responseStatusCode, 405);
    });

    // authorization: nobody may edit or delete someone else's account
    test("PUT /users/:id - updating another user returns 403", async () => {
        const res = await route(
            { username: userB.username, email: userB.email, password: "Hacked12345!", current_password: PASSWORD },
            `/users/${userB.id}`,
            "PUT",
            userA.cookies
        );
        assert.strictEqual(res.responseStatusCode, 403);
    });

    test("PUT /users/:id - without current_password returns 400", async () => {
        const res = await route(
            { username: userA.username, email: userA.email, password: PASSWORD },
            `/users/${userA.id}`,
            "PUT",
            userA.cookies
        );
        assert.strictEqual(res.responseStatusCode, 400);
    });

    test("PUT /users/:id - a wrong current_password returns 403 and changes nothing", async () => {
        const res = await route(
            { username: userA.username, email: userA.email, password: "NewPassword123!", current_password: "not-my-password" },
            `/users/${userA.id}`,
            "PUT",
            userA.cookies
        );
        assert.strictEqual(res.responseStatusCode, 403);
        const login = await route({ username: userA.username, password: PASSWORD }, "/auth/login", "POST", null);
        assert.strictEqual(login.responseStatusCode, 200, "The old password must still work");
    });

    test("PUT /users/:id - updating your own account returns 200 and signs out every session", async () => {
        const login = await route({ username: userA.username, password: PASSWORD }, "/auth/login", "POST", null);
        const refreshToken = login.responseCookies.refreshToken;

        const res = await route(
            { username: userA.username, email: userA.email, password: PASSWORD, current_password: PASSWORD },
            `/users/${userA.id}`,
            "PUT",
            userA.cookies
        );
        assert.strictEqual(res.responseStatusCode, 200);
        assert.strictEqual(res.responseBody.id, userA.id);
        assert.strictEqual(res.responseCookies?.refreshToken, "", "This browser's cookies must be cleared");

        const refresh = await route(null, "/auth/refresh", "POST", { refreshToken });
        assert.strictEqual(refresh.responseStatusCode, 401, "A session from before the change must no longer refresh");
    });

    test("PUT /users/:id - taking another user's username returns 409", async () => {
        const res = await route(
            { username: userB.username, email: userA.email, password: PASSWORD, current_password: PASSWORD },
            `/users/${userA.id}`,
            "PUT",
            userA.cookies
        );
        assert.strictEqual(res.responseStatusCode, 409);
    });

    test("DELETE /users/:id - deleting another user returns 403", async () => {
        const res = await route(null, `/users/${userB.id}`, "DELETE", userA.cookies);
        assert.strictEqual(res.responseStatusCode, 403);
    });

    test("DELETE /users/:id - deleting your own account returns 200 and the user is gone", async () => {
        const res = await route(null, `/users/${userD.id}`, "DELETE", userD.cookies);
        assert.strictEqual(res.responseStatusCode, 200);
        assert.strictEqual(res.responseCookies?.accessToken, "", "Cookies must be cleared for a deleted account");

        const lookup = await route(null, `/users/${userD.id}`, "GET", userA.cookies);
        assert.strictEqual(lookup.responseStatusCode, 404);
    });
});

// tests friendship request lifecycle, queries, and security authorization
describe("Friendship Endpoints", () => {
    let createdRequestId = null;

    // verifies that friendship actions require authentication
    test("POST /friendship - missing token returns 401", async () => {
        const res = await route({ receiver_id: userB.id }, "/friendship", "POST", null);
        assert.strictEqual(res.responseStatusCode, 401);
    });

    // verifies schema validation rejects non-integer receiver_id
    test("POST /friendship - non-integer receiver_id returns 400", async () => {
        const res = await route({ receiver_id: "not-an-integer" }, "/friendship", "POST", userA.cookies);
        assert.strictEqual(res.responseStatusCode, 400);
    });

    // verifies business rule preventing users from friending their own account
    test("POST /friendship - friending yourself returns 400", async () => {
        const res = await route({ receiver_id: userA.id }, "/friendship", "POST", userA.cookies);
        assert.strictEqual(res.responseStatusCode, 400);
    });

    test("POST /friendship - non-existent receiver returns 404", async () => {
        const res = await route({ receiver_id: 99999999 }, "/friendship", "POST", userA.cookies);
        assert.strictEqual(res.responseStatusCode, 404);
    });

    // tests successful friend request creation from User A to User B
    test("POST /friendship - creates a pending friend request", async () => {
        const res = await route({ receiver_id: userB.id }, "/friendship", "POST", userA.cookies);
        assert.strictEqual(res.responseStatusCode, 201);
        assert.ok(res.responseBody?.id, "Created request must return an id");
        assert.strictEqual(res.responseBody.status, "pending");
        createdRequestId = res.responseBody.id; // saves request id for subsequent tests
    });

    test("POST /friendship - sending the same request twice returns 409", async () => {
        const res = await route({ receiver_id: userB.id }, "/friendship", "POST", userA.cookies);
        assert.strictEqual(res.responseStatusCode, 409);
    });

    test("POST /friendship - sending a request back the other way returns 409", async () => {
        const res = await route({ receiver_id: userA.id }, "/friendship", "POST", userB.cookies);
        assert.strictEqual(res.responseStatusCode, 409);
    });

    // the schema only allows exactly one way of naming the receiver
    test("POST /friendship - sending both receiver_id and receiver_username returns 400", async () => {
        const res = await route({ receiver_id: userC.id, receiver_username: userC.username }, "/friendship", "POST", userA.cookies);
        assert.strictEqual(res.responseStatusCode, 400);
    });

    test("POST /friendship - sending neither receiver field returns 400", async () => {
        const res = await route({}, "/friendship", "POST", userA.cookies);
        assert.strictEqual(res.responseStatusCode, 400);
    });

    test("POST /friendship - unknown receiver_username returns 404", async () => {
        const res = await route({ receiver_username: `nobody_${timestamp}` }, "/friendship", "POST", userA.cookies);
        assert.strictEqual(res.responseStatusCode, 404);
    });

    test("POST /friendship - friending yourself by username returns 400", async () => {
        const res = await route({ receiver_username: userA.username }, "/friendship", "POST", userA.cookies);
        assert.strictEqual(res.responseStatusCode, 400);
    });

    // the username lookup ignores case, then the request is deleted so later tests start from the same state
    test("POST /friendship - receiver_username with different casing creates a request", async () => {
        const res = await route({ receiver_username: userA.username.toUpperCase() }, "/friendship", "POST", userC.cookies);
        assert.strictEqual(res.responseStatusCode, 201);
        assert.strictEqual(res.responseBody.receiver_id, userA.id, "The request must be addressed to the matching user");

        const cleanup = await route(null, `/friendship/${res.responseBody.id}`, "DELETE", userC.cookies);
        assert.strictEqual(cleanup.responseStatusCode, 200);
    });

    test("GET /friendship?status=invalid - returns 400", async () => {
        const res = await route(null, "/friendship?status=bestfriends", "GET", userA.cookies);
        assert.strictEqual(res.responseStatusCode, 400);
    });

    // verifies that User A sees the request as outgoing
    test("GET /friendship?status=pending - sender sees outgoing request with recipient username", async () => {
        const res = await route(null, "/friendship?status=pending", "GET", userA.cookies);
        assert.strictEqual(res.responseStatusCode, 200);
        assert.ok(Array.isArray(res.responseBody));
        const found = res.responseBody.find(r => r.request_id === createdRequestId);
        assert.ok(found, "Sent request must appear in User A's pending list");
        assert.strictEqual(found.direction, "outgoing");
        assert.strictEqual(found.other_username, userB.username);
    });

    // verifies that User B sees the request as incoming
    test("GET /friendship?status=pending - recipient sees incoming request with sender username", async () => {
        const res = await route(null, "/friendship?status=pending", "GET", userB.cookies);
        assert.strictEqual(res.responseStatusCode, 200);
        const found = res.responseBody.find(r => r.request_id === createdRequestId);
        assert.ok(found, "Sent request must appear in User B's pending list");
        assert.strictEqual(found.direction, "incoming");
        assert.strictEqual(found.other_username, userA.username);
    });

    test("PUT /friendship/accept - non-integer request_id returns 400", async () => {
        const res = await route({ request_id: "abc" }, "/friendship/accept", "PUT", userB.cookies);
        assert.strictEqual(res.responseStatusCode, 400);
    });

    // verifies authorization: sender cannot accept their own request
    test("PUT /friendship/accept - sender cannot accept their own request (404)", async () => {
        const res = await route({ request_id: createdRequestId }, "/friendship/accept", "PUT", userA.cookies);
        assert.strictEqual(res.responseStatusCode, 404);
    });

    // verifies authorization: an uninvolved third-party user cannot accept the request
    test("PUT /friendship/accept - stranger cannot accept someone else's request (404)", async () => {
        const res = await route({ request_id: createdRequestId }, "/friendship/accept", "PUT", userC.cookies);
        assert.strictEqual(res.responseStatusCode, 404);
    });

    // tests successful acceptance by the intended recipient (User B)
    test("PUT /friendship/accept - recipient accepts the request", async () => {
        const res = await route({ request_id: createdRequestId }, "/friendship/accept", "PUT", userB.cookies);
        assert.strictEqual(res.responseStatusCode, 200);
        assert.strictEqual(res.responseBody.status, "accepted");
    });

    test("PUT /friendship/accept - accepting an already accepted request returns 404", async () => {
        const res = await route({ request_id: createdRequestId }, "/friendship/accept", "PUT", userB.cookies);
        assert.strictEqual(res.responseStatusCode, 404);
    });

    // verifies that accepted friends appear in the friends list for both users
    test("GET /friendship?status=accepted - both users see each other as friends", async () => {
        const resA = await route(null, "/friendship?status=accepted", "GET", userA.cookies);
        assert.strictEqual(resA.responseStatusCode, 200);
        const friendForA = resA.responseBody.find(f => f.request_id === createdRequestId);
        assert.ok(friendForA, "User A must see User B in accepted friends");
        assert.strictEqual(friendForA.other_username, userB.username);

        const resB = await route(null, "/friendship?status=accepted", "GET", userB.cookies);
        assert.strictEqual(resB.responseStatusCode, 200);
        const friendForB = resB.responseBody.find(f => f.request_id === createdRequestId);
        assert.ok(friendForB, "User B must see User A in accepted friends");
        assert.strictEqual(friendForB.other_username, userA.username);
    });

    // verifies authorization: stranger cannot delete someone else's friendship
    test("DELETE /friendship/:id - stranger cannot delete someone else's friendship (404)", async () => {
        const res = await route(null, `/friendship/${createdRequestId}`, "DELETE", userC.cookies);
        assert.strictEqual(res.responseStatusCode, 404);
    });

    // tests legitimate deletion by a relationship participant (User A unfriends User B)
    test("DELETE /friendship/:id - participant can delete the friendship", async () => {
        const res = await route(null, `/friendship/${createdRequestId}`, "DELETE", userA.cookies);
        assert.strictEqual(res.responseStatusCode, 200);
    });

    // verifies the friendship no longer exists after deletion
    test("GET /friendship?status=accepted - friendship is gone after deletion", async () => {
        const res = await route(null, "/friendship?status=accepted", "GET", userA.cookies);
        assert.strictEqual(res.responseStatusCode, 200);
        const found = res.responseBody.find(f => f.request_id === createdRequestId);
        assert.strictEqual(found, undefined);
    });
});

// makes two test users accepted friends through the real endpoints, because rooms may only contain friends
async function makeFriends(sender, receiver) {
    const request = await route({ receiver_id: receiver.id }, "/friendship", "POST", sender.cookies);
    assert.strictEqual(request.responseStatusCode, 201, "Friend request must be created");
    const accept = await route({ request_id: request.responseBody.id }, "/friendship/accept", "PUT", receiver.cookies);
    assert.strictEqual(accept.responseStatusCode, 200, "Friend request must be accepted");
}

// tests room creation and retrieval endpoints
describe("Room Endpoints", () => {
    let directRoomId = null;

    // A and B are friends, C and B are friends, A and C are strangers
    before(async () => {
        await makeFriends(userA, userB);
        await makeFriends(userC, userB);
    });

    // tests creating a direct chat room, the creator is added automatically
    test("POST /rooms - creates a direct room and adds the creator as a member", async () => {
        const res = await route(
            { room_type: "direct", users: [userB.id] },
            "/rooms",
            "POST",
            userA.cookies
        );
        assert.strictEqual(res.responseStatusCode, 201);
        assert.ok(res.responseBody.id, "Created room must return its id");
        assert.deepStrictEqual([...res.responseBody.members].sort(), [userA.id, userB.id].sort());
        assert.strictEqual(res.responseBody.name, userB.username, "The creator sees the direct room under the friend's name");
        directRoomId = res.responseBody.id;
        createdRoomIds.push(directRoomId);
    });

    test("POST /rooms - asking for the same direct room again returns the existing one with 200", async () => {
        const fromB = await route({ room_type: "direct", users: [userA.id] }, "/rooms", "POST", userB.cookies);
        assert.strictEqual(fromB.responseStatusCode, 200);
        assert.strictEqual(fromB.responseBody.id, directRoomId, "Either person must land in the same direct room");
        assert.strictEqual(fromB.responseBody.name, userA.username);
    });

    test("GET /rooms - each member sees a direct room under the other member's username", async () => {
        const resA = await route(null, "/rooms", "GET", userA.cookies);
        const resB = await route(null, "/rooms", "GET", userB.cookies);
        assert.strictEqual(resA.responseBody.find((r) => r.id === directRoomId).name, userB.username);
        assert.strictEqual(resB.responseBody.find((r) => r.id === directRoomId).name, userA.username);
    });

    test("POST /rooms - adding someone who is not your friend returns 403", async () => {
        const group = await route({ room_type: "group", name: "Strangers", users: [userC.id] }, "/rooms", "POST", userA.cookies);
        assert.strictEqual(group.responseStatusCode, 403);
        const direct = await route({ room_type: "direct", users: [userC.id] }, "/rooms", "POST", userA.cookies);
        assert.strictEqual(direct.responseStatusCode, 403);
        const mixed = await route({ room_type: "group", name: "Half friends", users: [userB.id, userC.id] }, "/rooms", "POST", userA.cookies);
        assert.strictEqual(mixed.responseStatusCode, 403, "One stranger in the list must reject the whole room");
    });

    test("POST /rooms - a group without a name returns 400", async () => {
        const res = await route({ room_type: "group", users: [userB.id] }, "/rooms", "POST", userA.cookies);
        assert.strictEqual(res.responseStatusCode, 400);
    });

    test("POST /rooms - direct room with more than two members returns 400", async () => {
        const res = await route(
            { room_type: "direct", name: "Too Many", users: [userB.id, userC.id] },
            "/rooms",
            "POST",
            userA.cookies
        );
        assert.strictEqual(res.responseStatusCode, 400);
    });

    test("POST /rooms - room with only the creator returns 400", async () => {
        const res = await route({ room_type: "group", name: "Alone", users: [] }, "/rooms", "POST", userA.cookies);
        assert.strictEqual(res.responseStatusCode, 400);
    });

    // an id that does not exist is nobody's friend, so it is refused by the friends check
    test("POST /rooms - non-existent member returns 403", async () => {
        const res = await route(
            { room_type: "group", name: "Ghost Room", users: [99999999] },
            "/rooms",
            "POST",
            userA.cookies
        );
        assert.strictEqual(res.responseStatusCode, 403);
    });

    test("POST /rooms - unknown room_type returns 400", async () => {
        const res = await route(
            { room_type: "channel", name: "Bad Type", users: [userB.id] },
            "/rooms",
            "POST",
            userA.cookies
        );
        assert.strictEqual(res.responseStatusCode, 400);
    });

    test("POST /rooms - missing token returns 401", async () => {
        const res = await route({ room_type: "direct", name: "x", users: [userB.id] }, "/rooms", "POST", null);
        assert.strictEqual(res.responseStatusCode, 401);
    });

    // tests fetching rooms a user belongs to
    test("GET /rooms - members see the room, non-members do not", async () => {
        const resA = await route(null, "/rooms", "GET", userA.cookies);
        assert.strictEqual(resA.responseStatusCode, 200);
        assert.ok(resA.responseBody.some(r => r.id === directRoomId), "Creator must see the room");

        const resB = await route(null, "/rooms", "GET", userB.cookies);
        assert.ok(resB.responseBody.some(r => r.id === directRoomId), "Invited member must see the room");

        const resC = await route(null, "/rooms", "GET", userC.cookies);
        assert.strictEqual(resC.responseStatusCode, 200);
        assert.ok(!resC.responseBody.some(r => r.id === directRoomId), "Non-member must not see the room");
    });

    // user C is in no rooms yet, so after creating three the pages are fully predictable
    test("GET /rooms/cursor - pages through every room exactly once", async () => {
        for (let i = 1; i <= 3; i++) {
            const res = await route(
                { room_type: "group", name: `Test Page Room ${i}`, users: [userB.id] },
                "/rooms",
                "POST",
                userC.cookies
            );
            assert.strictEqual(res.responseStatusCode, 201);
            createdRoomIds.push(res.responseBody.id);
        }

        const page1 = await route(null, "/rooms/cursor?limit=2", "GET", userC.cookies);
        assert.strictEqual(page1.responseStatusCode, 200);
        assert.strictEqual(page1.responseBody.rooms.length, 2);
        assert.ok(page1.responseBody.newCursor, "A full page must return a cursor for the next page");
        assert.strictEqual(page1.responseBody.rooms[0].cursor_created_at, undefined, "Internal cursor column must not leak");

        const page2 = await route(null, `/rooms/cursor?limit=2&cursor=${page1.responseBody.newCursor}`, "GET", userC.cookies);
        assert.strictEqual(page2.responseStatusCode, 200);
        assert.strictEqual(page2.responseBody.rooms.length, 1);
        assert.strictEqual(page2.responseBody.newCursor, null, "Last page must return a null cursor");

        const seenIds = [...page1.responseBody.rooms, ...page2.responseBody.rooms].map(r => r.id);
        assert.strictEqual(new Set(seenIds).size, 3, "Every room must appear exactly once across the pages");
    });

    test("GET /rooms/cursor - tampered cursor returns 400", async () => {
        const res = await route(null, "/rooms/cursor?cursor=abc.def", "GET", userC.cookies);
        assert.strictEqual(res.responseStatusCode, 400);
    });

    test("GET /rooms/cursor - limit outside 1 to 50 returns 400", async () => {
        const res = await route(null, "/rooms/cursor?limit=0", "GET", userC.cookies);
        assert.strictEqual(res.responseStatusCode, 400);
    });
});

// saves a message the same way the websocket server does, with its own pooled client, and returns the saved message
async function saveMessage(roomId, userId, content) {
    const client = await DbPool.provideClient();
    try {
        return await new MessageService(client).saveMessageAsync(roomId, userId, content);
    } finally {
        client.release();
    }
}

// creates a group room owned by `owner` with the given members, records it for teardown and returns its id
async function createGroupRoom(owner, memberIds, name) {
    const res = await route({ room_type: "group", name, users: memberIds }, "/rooms", "POST", owner.cookies);
    assert.strictEqual(res.responseStatusCode, 201);
    createdRoomIds.push(res.responseBody.id);
    return res.responseBody.id;
}

// tests saving messages and reading them back through the history endpoint
describe("Message Endpoints", () => {
    let chatRoomId = null; // A and B are members, C is not
    let otherRoomId = null; // a second room for A, used for ordering and cursor checks
    const savedIds = [];

    before(async () => {
        otherRoomId = await createGroupRoom(userA, [userB.id], "Message Test Older Room");
        chatRoomId = await createGroupRoom(userA, [userB.id], "Message Test Chat Room");
    });

    test("saveMessageAsync - trims content and returns the sender's username", async () => {
        const message = await saveMessage(chatRoomId, userA.id, "   first message   ");
        assert.strictEqual(message.content, "first message");
        assert.strictEqual(message.sender_id, userA.id);
        assert.strictEqual(message.sender_username, userA.username);
        savedIds.push(message.id);
    });

    test("saveMessageAsync - a non-member is rejected with 403", async () => {
        await assert.rejects(() => saveMessage(chatRoomId, userC.id, "let me in"), (error) => error.statusCode === 403);
    });

    test("GET /rooms/:id/messages - pages newest first, every message exactly once, null cursor at the end", async () => {
        for (let i = 2; i <= 5; i++) {
            const message = await saveMessage(chatRoomId, i % 2 === 0 ? userB.id : userA.id, `message ${i}`);
            savedIds.push(message.id);
        }

        const page1 = await route(null, `/rooms/${chatRoomId}/messages?limit=3`, "GET", userA.cookies);
        assert.strictEqual(page1.responseStatusCode, 200);
        assert.strictEqual(page1.responseBody.messages.length, 3);
        assert.strictEqual(page1.responseBody.messages[0].content, "message 5", "Newest message must come first");
        assert.strictEqual(page1.responseBody.messages[0].cursor_created_at, undefined, "Internal cursor column must not leak");
        assert.ok(page1.responseBody.newCursor, "A full page must return a cursor");

        const page2 = await route(null, `/rooms/${chatRoomId}/messages?limit=3&cursor=${page1.responseBody.newCursor}`, "GET", userB.cookies);
        assert.strictEqual(page2.responseStatusCode, 200);
        assert.strictEqual(page2.responseBody.messages.length, 2);
        assert.strictEqual(page2.responseBody.newCursor, null, "Last page must return a null cursor");

        const seen = [...page1.responseBody.messages, ...page2.responseBody.messages].map((m) => m.id);
        assert.deepStrictEqual([...seen].sort((a, b) => a - b), [...savedIds].sort((a, b) => a - b));
    });

    test("GET /rooms/:id/messages - a non-member gets 403", async () => {
        const res = await route(null, `/rooms/${chatRoomId}/messages`, "GET", userC.cookies);
        assert.strictEqual(res.responseStatusCode, 403);
    });

    test("GET /rooms/:id/messages - a cursor from another room or from the rooms list is rejected", async () => {
        const page = await route(null, `/rooms/${chatRoomId}/messages?limit=1`, "GET", userA.cookies);
        const messageCursor = page.responseBody.newCursor;
        const wrongRoom = await route(null, `/rooms/${otherRoomId}/messages?cursor=${messageCursor}`, "GET", userA.cookies);
        assert.strictEqual(wrongRoom.responseStatusCode, 400);
        const onRoomsList = await route(null, `/rooms/cursor?cursor=${messageCursor}`, "GET", userA.cookies);
        assert.strictEqual(onRoomsList.responseStatusCode, 400);
    });

    test("GET /rooms - includes last_message and orders rooms by latest activity", async () => {
        // the older room was created first, so a new message in it must move it above the newer, quieter room
        const latest = await saveMessage(otherRoomId, userB.id, "bump the older room");
        const res = await route(null, "/rooms", "GET", userA.cookies);
        assert.strictEqual(res.responseStatusCode, 200);
        const ids = res.responseBody.map((room) => room.id);
        assert.ok(ids.indexOf(otherRoomId) < ids.indexOf(chatRoomId), "The room with the newest message must come first");
        const older = res.responseBody.find((room) => room.id === otherRoomId);
        assert.strictEqual(older.last_message.id, latest.id);
        assert.strictEqual(older.last_message.sender_username, userB.username);
    });

    test("GET /rooms - a room without messages has last_message null", async () => {
        const emptyRoomId = await createGroupRoom(userA, [userB.id], "Message Test Empty Room");
        const res = await route(null, "/rooms", "GET", userA.cookies);
        const empty = res.responseBody.find((room) => room.id === emptyRoomId);
        assert.strictEqual(empty.last_message, null);
    });
});
