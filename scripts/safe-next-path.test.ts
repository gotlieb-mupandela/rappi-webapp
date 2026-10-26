import assert from "node:assert/strict";
import test from "node:test";
import { authCallbackUrl, safeNextPath } from "../lib/auth/session";
import { nativeAuthRedirect } from "../lib/native";

const FALLBACK = "/account";

test("keeps in-site paths, including query strings and hashes", () => {
  assert.equal(safeNextPath("/checkout"), "/checkout");
  assert.equal(safeNextPath("/checkout", FALLBACK), "/checkout");
  assert.equal(safeNextPath("/account?tab=orders"), "/account?tab=orders");
  assert.equal(safeNextPath("/account?tab=orders#invoices"), "/account?tab=orders#invoices");
  assert.equal(safeNextPath("/product/ABC?size=M#gallery"), "/product/ABC?size=M#gallery");
  assert.equal(safeNextPath("/search?q=hello%20world"), "/search?q=hello%20world");
  assert.equal(safeNextPath("/"), "/");
});

test("rejects empty, null, and undefined", () => {
  assert.equal(safeNextPath(""), "/");
  assert.equal(safeNextPath(null), "/");
  assert.equal(safeNextPath(undefined), "/");
  assert.equal(safeNextPath("", FALLBACK), FALLBACK);
  assert.equal(safeNextPath(null, FALLBACK), FALLBACK);
  assert.equal(safeNextPath(undefined, FALLBACK), FALLBACK);
});

test("rejects control characters that URL parsing would turn into another origin", () => {
  const tabPath = "/\t/evil.com";
  const newlinePath = "/\n/evil.com";
  const crPath = "/\r/evil.com";
  assert.equal(new URL(tabPath, "https://x.invalid").origin, "https://evil.com");
  assert.equal(new URL(newlinePath, "https://x.invalid").origin, "https://evil.com");
  assert.equal(new URL(crPath, "https://x.invalid").origin, "https://evil.com");
  assert.equal(safeNextPath(tabPath, FALLBACK), FALLBACK);
  assert.equal(safeNextPath(newlinePath, FALLBACK), FALLBACK);
  assert.equal(safeNextPath(crPath, FALLBACK), FALLBACK);
  assert.equal(safeNextPath("/foo\tbar", FALLBACK), FALLBACK);
  assert.equal(safeNextPath("/foo\nbar", FALLBACK), FALLBACK);
  assert.equal(safeNextPath("/foo\rbar", FALLBACK), FALLBACK);
});

test("rejects percent-encoded controls, slashes, and backslashes", () => {
  for (const raw of [
    "/%09/evil.com",
    "/%0a/evil.com",
    "/%0A/evil.com",
    "/%0d/evil.com",
    "/%0D/evil.com",
    "/%2f/evil.com",
    "/%2F/evil.com",
    "/%5c/evil.com",
    "/%5Cevil.com",
    "/account?tab=orders%09",
    "/search?q=%2f%2fevil.com",
  ]) {
    assert.equal(safeNextPath(raw, FALLBACK), FALLBACK, raw);
  }
});

test("rejects protocol-relative, backslash, absolute, and script URLs", () => {
  assert.equal(safeNextPath("//evil.com", FALLBACK), FALLBACK);
  assert.equal(safeNextPath("//", FALLBACK), FALLBACK);
  assert.equal(safeNextPath("/\\evil.com", FALLBACK), FALLBACK);
  assert.equal(safeNextPath("/foo\\bar", FALLBACK), FALLBACK);
  assert.equal(safeNextPath("https://evil.com", FALLBACK), FALLBACK);
  assert.equal(safeNextPath("https://evil.com/path", FALLBACK), FALLBACK);
  assert.equal(safeNextPath("javascript:alert(1)", FALLBACK), FALLBACK);
  assert.equal(safeNextPath("JavaScript:alert(1)", FALLBACK), FALLBACK);
  assert.equal(new URL("javascript:alert(1)", "https://x.invalid").origin, "null");
});

test("rejects a very long input", () => {
  const atLimit = `/${"a".repeat(2047)}`;
  const tooLong = `/${"a".repeat(10_000)}`;
  assert.equal(atLimit.length, 2048);
  assert.equal(safeNextPath(atLimit), atLimit);
  assert.equal(safeNextPath(tooLong, FALLBACK), FALLBACK);
  assert.equal(safeNextPath(`${"/\t/evil.com"}${"a".repeat(20_000)}`, FALLBACK), FALLBACK);
});

test("login callback and native redirect only carry a safe path", () => {
  const checkout = "/auth/callback?next=" + encodeURIComponent("/checkout");
  assert.equal(authCallbackUrl("/checkout").endsWith(checkout), true);
  assert.equal(authCallbackUrl("/account?tab=orders#invoices").includes(encodeURIComponent("/account?tab=orders#invoices")), true);
  assert.equal(authCallbackUrl("/\t/evil.com").includes(encodeURIComponent("/\t/evil.com")), false);
  assert.equal(authCallbackUrl("/\t/evil.com").endsWith("/auth/callback?next=" + encodeURIComponent("/")), true);

  const nativeOk = "com.rappisportshub.app://login-callback?next=" + encodeURIComponent("/account?tab=orders");
  assert.equal(nativeAuthRedirect("/account?tab=orders"), nativeOk);
  assert.equal(
    nativeAuthRedirect("/\t/evil.com"),
    "com.rappisportshub.app://login-callback?next=" + encodeURIComponent("/account"),
  );
  assert.equal(
    nativeAuthRedirect("https://evil.com"),
    "com.rappisportshub.app://login-callback?next=" + encodeURIComponent("/account"),
  );
});
