/**
 * Lets command-line scripts (run with tsx) import server-only lib modules.
 * Next.js supplies "server-only" at build time; outside Next it is not
 * installed, so map it to an empty module. Use: tsx --require ./scripts/server-only-register.cjs
 */
const Module = require("module");
const path = require("path");

const stub = path.join(__dirname, "server-only-empty.cjs");
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === "server-only") return stub;
  return resolveFilename.call(this, request, parent, isMain, options);
};
