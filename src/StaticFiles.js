// Serves the built React app (the frontend's dist folder) from this same server, so the page, the API (/api)
// and the websocket (/ws) all share one origin. One origin is what lets the SameSite=Strict login cookies work on Render.
//
// For any path that is not the API, this module:
//   1. turns the URL path into a file path inside the dist folder, refusing anything that would escape it
//   2. sends that file with the right Content-Type and caching rules
//   3. sends index.html for page addresses like /dashboard that have no file, so React Router can show the page
const fs = require('node:fs');
const path = require('node:path');
const { applySecurityHeaders, buildPageContentSecurityPolicy } = require('./helpers/SecurityHeaders');

// The Content-Type label for each kind of file the build produces. Browsers decide what to do with a response from
// this label, and the X-Content-Type-Options: nosniff header tells them never to guess, so every label must be right
const CONTENT_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.json': 'application/json',
    '.txt': 'text/plain; charset=utf-8',
    '.woff2': 'font/woff2',
    '.webmanifest': 'application/manifest+json',
    '.map': 'application/json',
};

// Vite puts every fingerprinted file (name contains a hash of its contents) in this folder.
// Such a file can never change without its name changing, so browsers may keep it for a year without asking
const HASHED_ASSETS_FOLDER = 'assets';
const CACHE_FOREVER = 'public, max-age=31536000, immutable';
// no-cache does NOT mean "do not store". It means "check with the server before every use", which keeps index.html
// fresh so a new deploy's new file names are picked up straight away
const CHECK_EVERY_TIME = 'no-cache';

// Ends a request with a small JSON error, matching the API's error shape
function sendError(res, statusCode, message) {
    applySecurityHeaders(res);
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store'); // errors are never cached, the file may exist after the next deploy
    res.end(JSON.stringify({ message }));
}

// Creates the request handler for one dist folder.
// Returns null when the folder is not configured or has no index.html, so the server knows the frontend is not available
// (for example in development, where Vite serves the frontend itself on port 5173)
function createFrontendHandler(distFolder) {
    if (distFolder == null || distFolder.trim() === '') {
        return null;
    }
    const root = path.resolve(distFolder); // an absolute path, so the "is it inside" check below compares like with like
    const indexPath = path.join(root, 'index.html');
    if (!fs.existsSync(indexPath)) {
        console.warn(`Frontend not served: ${indexPath} does not exist. Build the frontend or fix FRONTEND_DIST_PATH.`);
        return null;
    }

    // Sends one file: status, security headers, type, size, caching, then the bytes themselves
    function sendFile(req, res, filePath, size) {
        const extension = path.extname(filePath).toLowerCase();
        const isPage = extension === '.html';
        // path.relative gives the location inside dist, for example "assets/index-Dz64zzR7.js"
        const isHashedAsset = path.relative(root, filePath).split(path.sep)[0] === HASHED_ASSETS_FOLDER;

        res.statusCode = 200;
        // the HTML page gets the page policy that allows the app's scripts, styles and fonts; everything else gets the strict one
        applySecurityHeaders(res, isPage ? buildPageContentSecurityPolicy(req.headers.host) : undefined);
        res.setHeader('Content-Type', CONTENT_TYPES[extension] ?? 'application/octet-stream'); // octet-stream means "unknown bytes", which browsers download instead of running
        res.setHeader('Content-Length', size);
        res.setHeader('Cache-Control', isHashedAsset ? CACHE_FOREVER : CHECK_EVERY_TIME);

        if (req.method === 'HEAD') { // HEAD asks for the headers only, without the body
            res.end();
            return;
        }
        // A stream sends the file in small pieces as it is read, instead of loading the whole file into memory first
        const stream = fs.createReadStream(filePath);
        stream.on('error', (error) => {
            console.error("Error reading static file:", error);
            res.destroy(error); // the headers are already sent, so the only honest option left is to cut the connection
        });
        stream.pipe(res); // pipe copies each piece from the file stream into the response as it arrives
    }

    // The handler the HTTP server calls for every request that is not the API
    return async function serveFrontend(req, res) {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.setHeader('Allow', 'GET, HEAD'); // tells the client which methods this address does accept
            sendError(res, 405, "Method not allowed");
            return;
        }

        // 1. Decode the path. %2f becomes /, %2e becomes ., and so on. The checks below must run on the DECODED form,
        // because that is the form the file system will see. A malformed code like %zz makes decoding throw, so it is a 400
        let decodedPath;
        try {
            decodedPath = decodeURIComponent(new URL(req.url, 'http://placeholder').pathname); // the base is only needed to parse a path on its own
        } catch {
            sendError(res, 400, "Malformed path");
            return;
        }

        // 2. Refuse a null byte (some file APIs stop reading a name at it) and any segment starting with a dot:
        // that covers hidden files like .env and .git and every "..", and the build never contains such names
        const segments = decodedPath.split(/[\\/]/); // splits on / and on \ (Windows treats both as folder separators)
        if (decodedPath.includes('\0') || segments.some((segment) => segment.startsWith('.'))) {
            sendError(res, 404, "Not found"); // 404 instead of 403, so a probe learns nothing about what exists
            return;
        }

        // 3. Build the real path and confirm it is still inside the dist folder. path.join resolves every ".." however it
        // was spelled, so this check catches any trick the step above might have missed, because it looks at where the
        // path actually ends up rather than at how it was written
        const filePath = path.join(root, decodedPath);
        if (filePath !== root && !filePath.startsWith(root + path.sep)) {
            sendError(res, 404, "Not found");
            return;
        }

        // 4. A real file: send it
        const stats = await fs.promises.stat(filePath).catch(() => null); // null when nothing exists at this path
        if (stats?.isFile()) {
            sendFile(req, res, filePath, stats.size);
            return;
        }

        // 5. A path with an extension (like /assets/old-HASH.js) that does not exist is a genuinely missing file.
        // Answering it with index.html would hand the browser HTML where it expects JavaScript, a confusing failure
        if (path.extname(decodedPath) !== '') {
            sendError(res, 404, "Not found");
            return;
        }

        // 6. Anything else is a page address such as /dashboard or /auth/login. React Router owns those, in the browser,
        // so the server sends the app's one HTML page and React reads the address bar to decide what to show
        const indexStats = await fs.promises.stat(indexPath);
        sendFile(req, res, indexPath, indexStats.size);
    };
}

module.exports = { createFrontendHandler };
