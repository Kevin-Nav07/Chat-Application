// Unit tests for the in-memory rate limiter. They need no database or Redis, so they run in milliseconds
const { describe, test } = require('node:test');
const assert = require('node:assert');
const { RateLimiter } = require('../src/helpers/RateLimiter');

describe("RateLimiter", () => {
    test("allows hits up to the limit, then refuses", () => {
        const limiter = new RateLimiter(3, 60 * 1000);
        assert.strictEqual(limiter.hit("a"), true);
        assert.strictEqual(limiter.hit("a"), true);
        assert.strictEqual(limiter.hit("a"), true);
        assert.strictEqual(limiter.hit("a"), false, "The fourth hit in the window must be refused");
    });

    test("counts each key separately", () => {
        const limiter = new RateLimiter(1, 60 * 1000);
        assert.strictEqual(limiter.hit("user:1"), true);
        assert.strictEqual(limiter.hit("user:1"), false);
        assert.strictEqual(limiter.hit("user:2"), true, "Another user must not be blocked by user 1");
    });

    test("starts a fresh window once the old one has ended", async () => {
        const limiter = new RateLimiter(1, 20); // a 20 millisecond window keeps the test fast
        assert.strictEqual(limiter.hit("a"), true);
        assert.strictEqual(limiter.hit("a"), false);
        await new Promise((resolve) => setTimeout(resolve, 30)); // waits until the window is over
        assert.strictEqual(limiter.hit("a"), true, "A new window must allow hits again");
    });
});
