/**
 * tsx does not use Next's server-only alias. This check process treats the
 * marker as empty so the feed check can call the site hub functions.
 */
const Module = require("module");
const path = require("path");

const stub = path.join(__dirname, "check-feed-server-only.cjs");
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === "server-only") return stub;
  return resolveFilename.call(this, request, parent, isMain, options);
};
