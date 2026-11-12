// A small in-memory rate limiter, used to stop one person (or one script) from flooding the server.
//
// It uses a "fixed window": every key (for example "login:203.0.113.5" or "message:42") gets a counter that
// starts at the first hit and resets once windowMs has passed. While the counter is at the limit, hits are refused.
//
// Tradeoff: the counters live in this process's memory, so they reset when the server restarts and are not shared
// between several server instances. That is fine for one small instance. A bigger deployment would keep the
// counters in Redis instead so every instance sees the same numbers.
class RateLimiter {
    #limit; // how many hits are allowed per window
    #windowMs; // how long one window lasts, in milliseconds
    #windows; // key -> { count, resetAt }

    constructor(limit, windowMs) {
        this.#limit = limit;
        this.#windowMs = windowMs;
        this.#windows = new Map();
        // Every minute, forget windows that have already ended so the map cannot grow forever.
        // unref() means this timer alone will not keep Node running, so tests and shutdowns can still exit
        setInterval(() => this.#sweep(), 60 * 1000).unref();
    }

    // Records one hit for this key. Returns true if the hit is allowed, false if the key is over its limit
    hit(key) {
        const now = Date.now();
        let window = this.#windows.get(key);
        if (window == null || window.resetAt <= now) { // no window yet, or the old one ended, so start a fresh one
            window = { count: 0, resetAt: now + this.#windowMs };
            this.#windows.set(key, window);
        }
        if (window.count >= this.#limit) {
            return false; // the refused hit is not counted, so waiting out the window is always enough
        }
        window.count += 1;
        return true;
    }

    // Removes every window whose time is up
    #sweep() {
        const now = Date.now();
        for (const [key, window] of this.#windows) {
            if (window.resetAt <= now) {
                this.#windows.delete(key);
            }
        }
    }
}

const MINUTE = 60 * 1000;

// Every limiter the app uses, in one place so the numbers are easy to find and tune.
// The numbers are generous for a real person and tight for a script
const limiters = {
    loginPerIp: new RateLimiter(10, 5 * MINUTE), // 10 login attempts per 5 minutes from one address, slows password guessing
    signupPerIp: new RateLimiter(5, 60 * MINUTE), // 5 new accounts per hour from one address
    signupGlobal: new RateLimiter(50, 60 * MINUTE), // 50 new accounts per hour in total, a ceiling even if a bot rotates addresses
    refreshPerIp: new RateLimiter(30, 5 * MINUTE), // token refreshes, normally about one an hour per tab
    usernameLookupPerIp: new RateLimiter(60, 5 * MINUTE), // the signup form checks usernames as people type
    accountUpdatePerUser: new RateLimiter(10, 60 * MINUTE), // account edits per hour, each one checks the current password
    friendRequestPerUser: new RateLimiter(20, 60 * MINUTE), // friend requests sent by one user per hour
    roomCreatePerUser: new RateLimiter(20, 60 * MINUTE), // rooms (groups and direct chats) created by one user per hour
    socketMessagePerUser: new RateLimiter(20, 10 * 1000), // 20 chat messages per 10 seconds per user, across all their tabs
    socketConnectPerUser: new RateLimiter(30, 5 * MINUTE), // new websocket connections per user, stops reconnect floods
};

module.exports = { RateLimiter, limiters };
