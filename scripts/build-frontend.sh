#!/usr/bin/env bash
# Builds the React frontend so this backend can serve it from the same origin.
# Render runs this once per deploy, during the build step (npm run build).
# It clones the public frontend repo, installs its exact locked packages, and runs Vite,
# leaving the finished files in frontend/dist for FRONTEND_DIST_PATH to point at.

set -euo pipefail # stop at the first failing command, treat unset variables as errors, and fail if any part of a pipe fails

FRONTEND_REPO_URL="${FRONTEND_REPO_URL:-https://github.com/Kevin-Nav07/ChatApplication_FrontEnd.git}" # the public frontend repo, overridable with an env var
FRONTEND_REF="${FRONTEND_REF:-main}" # the branch or tag to build
BUILD_DIR="frontend" # where the clone goes, relative to the backend root

rm -rf "$BUILD_DIR" # start clean so a leftover clone from an earlier build can never be served by mistake
git clone --depth 1 --branch "$FRONTEND_REF" "$FRONTEND_REPO_URL" "$BUILD_DIR" # --depth 1 downloads only the latest commit, not the whole history
cd "$BUILD_DIR"
npm ci --include=dev # exact versions from package-lock.json, including vite and typescript even when NODE_ENV=production
npm run build # type check with tsc, then bundle with vite into dist/
rm -rf node_modules # the build tools are not needed at runtime, removing them keeps the deployed bundle small
echo "Frontend built into $BUILD_DIR/dist"
