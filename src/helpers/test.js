const assert = require("assert");
const { RouterTree } = require("./RadixTree");

const router = new RouterTree();

function makeHandler(name) {
    return function handler() {
        return name;
    };
}

router.add("GET", "/", makeHandler("home"));
router.add("GET", "/health", makeHandler("health"));

router.add("GET", "/users", makeHandler("getUsers"));
router.add("POST", "/users", makeHandler("createUser"));

router.add("GET", "/users/me", makeHandler("getCurrentUser"));
router.add("GET", "/users/:id", makeHandler("getUserById"));
router.add("GET", "/users/:id/posts", makeHandler("getUserPosts"));
router.add("GET", "/users/:id/posts/:postId", makeHandler("getUserPostById"));

router.add("GET", "/auth/login", makeHandler("login"));
router.add("GET", "/auth/logout", makeHandler("logout"));

router.add("GET", "/files/*path", makeHandler("getFile"));

let match;

// Root route
match = router.match("GET", "/");
assert.strictEqual(match.handler(), "home");
assert.deepStrictEqual(match.params, {});
assert.strictEqual(match.routePattern, "/");

// Static route
match = router.match("GET", "/health");
assert.strictEqual(match.handler(), "health");
assert.deepStrictEqual(match.params, {});

// Static route should beat param route
match = router.match("GET", "/users/me");
assert.strictEqual(match.handler(), "getCurrentUser");
assert.deepStrictEqual(match.params, {});
assert.strictEqual(match.routePattern, "/users/me");

// Param route
match = router.match("GET", "/users/123");
assert.strictEqual(match.handler(), "getUserById");
assert.deepStrictEqual(match.params, {
    id: "123"
});
assert.strictEqual(match.routePattern, "/users/:id");

// Nested param route
match = router.match("GET", "/users/123/posts");
assert.strictEqual(match.handler(), "getUserPosts");
assert.deepStrictEqual(match.params, {
    id: "123"
});
assert.strictEqual(match.routePattern, "/users/:id/posts");

// Multiple params
match = router.match("GET", "/users/123/posts/999");
assert.strictEqual(match.handler(), "getUserPostById");
assert.deepStrictEqual(match.params, {
    id: "123",
    postId: "999"
});
assert.strictEqual(match.routePattern, "/users/:id/posts/:postId");

// Different method, same path
match = router.match("POST", "/users");
assert.strictEqual(match.handler(), "createUser");
assert.deepStrictEqual(match.params, {});
assert.strictEqual(match.routePattern, "/users");

// GET /users should still be separate from POST /users
match = router.match("GET", "/users");
assert.strictEqual(match.handler(), "getUsers");
assert.deepStrictEqual(match.params, {});
assert.strictEqual(match.routePattern, "/users");

// Wildcard route
match = router.match("GET", "/files/images/cat.png");
assert.strictEqual(match.handler(), "getFile");
assert.deepStrictEqual(match.params, {
    path: "images/cat.png"
});
assert.strictEqual(match.routePattern, "/files/*path");

// Wildcard with one segment
match = router.match("GET", "/files/readme.txt");
assert.strictEqual(match.handler(), "getFile");
assert.deepStrictEqual(match.params, {
    path: "readme.txt"
});

// Query strings are ignored during path matching
match = router.match("GET", "/users/123?tab=posts");
assert.strictEqual(match.handler(), "getUserById");
assert.deepStrictEqual(match.params, {
    id: "123"
});

// Missing route
match = router.match("GET", "/missing");
assert.strictEqual(match, null);

// Wrong method
match = router.match("DELETE", "/users/123");
assert.strictEqual(match, null);

// Conflict: same route twice
assert.throws(() => {
    router.add("GET", "/users/:id", makeHandler("duplicate"));
});

// Conflict: same param position with different name
assert.throws(() => {
    router.add("GET", "/users/:userId", makeHandler("conflict"));
});

// Invalid wildcard: wildcard must be final
assert.throws(() => {
    router.add("GET", "/bad/*path/edit", makeHandler("badWildcard"));
});

console.log("All router tests passed.");