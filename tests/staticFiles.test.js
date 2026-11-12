// Tests for the static file server in src/StaticFiles.js. They need no database or Redis.
// Each run builds a throwaway folder that looks like a frontend build, plus a "secret" file placed just OUTSIDE it,
// then throws path traversal tricks at a real HTTP server to prove that file can never be reached
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { createFrontendHandler } = require('../src/StaticFiles');

const SECRET_TEXT = "TOP-SECRET-DO-NOT-SERVE";
let tempFolder; // holds dist/ and the secret file next to it
let server;
let port;

// Sends one raw request and resolves with the status, headers and body. The path is sent exactly as written,
// without the cleaning a browser would do, which is how an attacker would send it
function request(method, rawPath) {
    return new Promise((resolve, reject) => {
        const req = http.request({ host: 'localhost', port, method, path: rawPath }, (res) => {
            let body = '';
            res.on('data', (chunk) => (body += chunk));
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
        });
        req.on('error', reject);
        req.end();
    });
}

before(async () => {
    // mkdtemp creates a new, uniquely named folder inside the system's temp folder
    tempFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-static-'));
    const dist = path.join(tempFolder, 'dist');
    fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>Ember</title><div id="root"></div>');
    fs.writeFileSync(path.join(dist, 'assets', 'app-abc123.js'), 'console.log("app")');
    fs.writeFileSync(path.join(dist, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    fs.writeFileSync(path.join(dist, '.env'), SECRET_TEXT); // a hidden file INSIDE dist, which must still be refused
    fs.writeFileSync(path.join(tempFolder, 'secret.txt'), SECRET_TEXT); // OUTSIDE dist, the traversal target

    const serveFrontend = createFrontendHandler(dist);
    server = http.createServer((req, res) => { serveFrontend(req, res); });
    await new Promise((resolve) => server.listen(0, resolve)); // port 0 asks the system for any free port
    port = server.address().port;
});

after(() => {
    server.close();
    fs.rmSync(tempFolder, { recursive: true, force: true }); // deletes the throwaway folder
});

describe("Static file server", () => {
    test("GET / sends index.html with the page security policy and no-cache", async () => {
        const res = await request('GET', '/');
        assert.strictEqual(res.status, 200);
        assert.match(res.headers['content-type'], /^text\/html/);
        assert.strictEqual(res.headers['cache-control'], 'no-cache');
        assert.match(res.headers['content-security-policy'], /script-src 'self'/);
        assert.match(res.headers['content-security-policy'], /connect-src 'self' wss:\/\/localhost:\d+/);
        assert.match(res.body, /<div id="root">/);
    });

    test("a page address like /dashboard falls back to index.html so React Router can show it", async () => {
        const res = await request('GET', '/dashboard');
        assert.strictEqual(res.status, 200);
        assert.match(res.body, /<div id="root">/);
    });

    test("a fingerprinted asset is sent as JavaScript and cached for a year", async () => {
        const res = await request('GET', '/assets/app-abc123.js');
        assert.strictEqual(res.status, 200);
        assert.match(res.headers['content-type'], /^text\/javascript/);
        assert.strictEqual(res.headers['cache-control'], 'public, max-age=31536000, immutable');
        assert.strictEqual(res.headers['content-security-policy'], "default-src 'none'; frame-ancestors 'none'");
    });

    test("a file outside assets/ gets its own type and no-cache", async () => {
        const res = await request('GET', '/favicon.svg');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.headers['content-type'], 'image/svg+xml');
        assert.strictEqual(res.headers['cache-control'], 'no-cache');
    });

    test("a missing file with an extension is a real 404, not index.html", async () => {
        const res = await request('GET', '/assets/index-OLDHASH.js');
        assert.strictEqual(res.status, 404);
        assert.doesNotMatch(res.body, /<div id="root">/);
    });

    // every one of these tries to climb out of dist to reach secret.txt, spelled a different way
    const traversalAttempts = [
        '/../secret.txt', // plain dots
        '/..%2fsecret.txt', // the slash percent-encoded, so it only appears after decoding
        '/assets/..%2f..%2fsecret.txt', // climbing two levels from inside assets
        '/%2e%2e/secret.txt', // the dots percent-encoded
        '/%2e%2e%2fsecret.txt', // dots and slash encoded
        '/..%5csecret.txt', // a backslash, the Windows folder separator
        '/assets/%2e%2e%5c%2e%2e%5csecret.txt', // everything encoded, Windows style
    ];
    for (const attempt of traversalAttempts) {
        test(`path traversal ${attempt} is refused and the secret is never sent`, async () => {
            const res = await request('GET', attempt);
            assert.ok(res.status === 404 || res.status === 400, `Expected 404 or 400, got ${res.status}`);
            assert.ok(!res.body.includes(SECRET_TEXT), "The secret file must never be in the response");
        });
    }

    test("a hidden file inside dist (/.env) is refused", async () => {
        const res = await request('GET', '/.env');
        assert.strictEqual(res.status, 404);
        assert.ok(!res.body.includes(SECRET_TEXT));
    });

    test("a malformed percent code returns 400", async () => {
        const res = await request('GET', '/%zz');
        assert.strictEqual(res.status, 400);
    });

    test("POST to a page address returns 405 with an Allow header", async () => {
        const res = await request('POST', '/dashboard');
        assert.strictEqual(res.status, 405);
        assert.strictEqual(res.headers['allow'], 'GET, HEAD');
    });

    test("HEAD returns the headers without a body", async () => {
        const res = await request('HEAD', '/');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body, '');
        assert.ok(Number(res.headers['content-length']) > 0);
    });

    test("no folder configured, or a folder without index.html, means the frontend is not served", () => {
        assert.strictEqual(createFrontendHandler(undefined), null);
        assert.strictEqual(createFrontendHandler(path.join(tempFolder, 'does-not-exist')), null);
    });
});
