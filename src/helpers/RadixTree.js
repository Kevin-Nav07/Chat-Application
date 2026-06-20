class RouteNode {
    constructor() {
        this.staticChildren = new Map(); // "users" -> RouteNode
        this.paramChild = null;          // :id
        this.paramName = null;

        this.wildcardChild = null;       // *path
        this.wildcardName = null;

        this.handler = null;             // function to run when route matches
        this.routePattern = null;        // original route pattern, useful for debugging
    }
}

class RouterTree {
    constructor() {
        // One root tree per HTTP method.
        // Example: GET has one tree, POST has another tree.
        this.methodTrees = new Map();
    }

    add(method, pathPattern, handler) {
        if (typeof method !== "string") {
            throw new Error("method must be a string");
        }

        if (typeof pathPattern !== "string") {
            throw new Error("pathPattern must be a string");
        }

        if (typeof handler !== "function") {
            throw new Error("handler must be a function");
        }

        method = method.toUpperCase();

        if (!this.methodTrees.has(method)) {
            this.methodTrees.set(method, new RouteNode());
        }

        const root = this.methodTrees.get(method);
        const segments = this._splitPath(pathPattern);

        let current = root;

        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];

            if (segment.startsWith(":")) {
                const paramName = segment.slice(1);

                if (paramName.length === 0) {
                    throw new Error(`Invalid param segment in route: ${pathPattern}`);
                }

                if (current.paramChild === null) {
                    current.paramChild = new RouteNode();
                    current.paramName = paramName;
                } else if (current.paramName !== paramName) {
                    throw new Error(
                        `Route conflict: param ":${current.paramName}" already exists where ":${paramName}" was added`
                    );
                }

                current = current.paramChild;
                continue;
            }

            if (segment.startsWith("*")) {
                const wildcardName = segment.slice(1);

                if (wildcardName.length === 0) {
                    throw new Error(`Invalid wildcard segment in route: ${pathPattern}`);
                }

                if (i !== segments.length - 1) {
                    throw new Error(`Wildcard must be the final segment: ${pathPattern}`);
                }

                if (current.wildcardChild === null) {
                    current.wildcardChild = new RouteNode();
                    current.wildcardName = wildcardName;
                } else if (current.wildcardName !== wildcardName) {
                    throw new Error(
                        `Route conflict: wildcard "*${current.wildcardName}" already exists where "*${wildcardName}" was added`
                    );
                }

                current = current.wildcardChild;
                break;
            }

            if (!current.staticChildren.has(segment)) {
                current.staticChildren.set(segment, new RouteNode());
            }

            current = current.staticChildren.get(segment);
        }

        if (current.handler !== null) {
            throw new Error(`Duplicate route: ${method} ${pathPattern}`);
        }

        current.handler = handler;
        current.routePattern = pathPattern;
    }

    match(method, requestPath) {
        if (typeof method !== "string") {
            return null;
        }

        if (typeof requestPath !== "string") {
            return null;
        }

        method = method.toUpperCase();

        const root = this.methodTrees.get(method);

        if (!root) {
            return null;
        }

        const segments = this._splitPath(requestPath);
        const params = {};

        return this._matchFromNode(root, segments, 0, params);
    }

    _matchFromNode(node, segments, index, params) {
        if (index === segments.length) {
            if (node.handler !== null) {
                return {
                    handler: node.handler,
                    params: { ...params },
                    routePattern: node.routePattern
                };
            }

            return null;
        }

        const currentSegment = segments[index];

        // 1. Static routes get checked first.
        const staticChild = node.staticChildren.get(currentSegment);

        if (staticChild) {
            const result = this._matchFromNode(staticChild, segments, index + 1, params);

            if (result !== null) {
                return result;
            }
        }

        // 2. Params get checked second.
        if (node.paramChild !== null) {
            params[node.paramName] = currentSegment;

            const result = this._matchFromNode(node.paramChild, segments, index + 1, params);

            if (result !== null) {
                return result;
            }

            delete params[node.paramName];
        }

        // 3. Wildcards get checked last.
        if (node.wildcardChild !== null) {
            const remainingPath = segments.slice(index).join("/");
            params[node.wildcardName] = remainingPath;

            if (node.wildcardChild.handler !== null) {
                return {
                    handler: node.wildcardChild.handler,
                    params: { ...params },
                    routePattern: node.wildcardChild.routePattern
                };
            }

            delete params[node.wildcardName];
        }

        return null;
    }

    _splitPath(path) {
        // Removes query string and hash.
        // Example: "/users/123?tab=posts" -> "/users/123"
        path = path.split("?")[0].split("#")[0];

        if (!path.startsWith("/")) {
            throw new Error(`Path must start with "/": ${path}`);
        }

        // "/" becomes []
        // "/users/123" becomes ["users", "123"]
        // "/users/" becomes ["users"]
        return path.split("/").filter(Boolean);
    }
}

module.exports = {
    RouterTree
};