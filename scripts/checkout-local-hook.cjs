const Module = require("module");
const path = require("path");

function memoryRateLimitAllowed() {
  const vercel = process.env.VERCEL_ENV;
  if (vercel === "production" || vercel === "preview") return false;
  if (process.env.NODE_ENV === "production") return false;
  return true;
}

function bareRequest(request) {
  return String(request).split("?")[0];
}

function isServerOnly(request) {
  const value = bareRequest(request);
  return value === "server-only" || value.endsWith("/server-only");
}

function isShippedRateLimit(request) {
  const value = bareRequest(request);
  return (
    value === "@/lib/rate-limit" ||
    value.endsWith("/lib/rate-limit") ||
    value.endsWith(`${path.sep}lib${path.sep}rate-limit.ts`) ||
    value.endsWith(`${path.sep}lib${path.sep}rate-limit.js`)
  );
}

function installCheckoutLocalHooks() {
  if (!memoryRateLimitAllowed()) return false;
  const emptyServerOnly = path.join(__dirname, "server-only-empty.cjs");
  const memoryLimiter = path.join(__dirname, "checkout-memory-rate-limit.ts");
  const resolveFilename = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, isMain, options) {
    if (isServerOnly(request)) return emptyServerOnly;
    const resolved = resolveFilename.call(this, request, parent, isMain, options);
    if (isShippedRateLimit(request) || isShippedRateLimit(resolved)) return memoryLimiter;
    return resolved;
  };
  const load = Module._load;
  Module._load = function (request, parent, isMain) {
    if (isServerOnly(request)) return load.call(this, emptyServerOnly, parent, isMain);
    if (isShippedRateLimit(request)) return load.call(this, memoryLimiter, parent, isMain);
    return load.call(this, request, parent, isMain);
  };
  return true;
}

module.exports = { installCheckoutLocalHooks, memoryRateLimitAllowed };
