import assert from "node:assert/strict";
import test from "node:test";
import nextConfig from "../next.config";
import { PRODUCT_IMAGE_PROXY_HOST } from "./product-image-loader";
import {
  CSP_ENFORCED_HEADER,
  CSP_REPORT_ONLY_HEADER,
  CSP_REPORT_PATH,
  PRODUCT_IMAGE_REMOTE_HOSTS,
  contentSecurityPolicy,
  contentSecurityPolicyReportOnly,
  cspEnforced,
  cspHeaderName,
} from "./content-security-policy";
import { securityHeaders } from "./security-headers";

function directive(policy: string, name: string) {
  const part = policy.split("; ").find((entry) => entry.startsWith(`${name} `));
  assert.ok(part, `${name} missing`);
  return part;
}

test("the header names are the two CSP variants", () => {
  assert.equal(CSP_REPORT_ONLY_HEADER, "Content-Security-Policy-Report-Only");
  assert.equal(CSP_ENFORCED_HEADER, "Content-Security-Policy");
});

test("CSP_ENFORCE switch picks the header name; default is report-only", () => {
  // Default / unset / anything-but-"true" -> report-only (never blocks).
  assert.equal(cspEnforced({}), false);
  assert.equal(cspEnforced({ CSP_ENFORCE: "false" }), false);
  assert.equal(cspEnforced({ CSP_ENFORCE: "1" }), false);
  assert.equal(cspHeaderName({}), CSP_REPORT_ONLY_HEADER);
  assert.equal(cspHeaderName({ CSP_ENFORCE: "false" }), CSP_REPORT_ONLY_HEADER);

  // Exactly "true" -> enforcing header.
  assert.equal(cspEnforced({ CSP_ENFORCE: "true" }), true);
  assert.equal(cspHeaderName({ CSP_ENFORCE: "true" }), CSP_ENFORCED_HEADER);
});

test("remotePatterns and img-src share the loader and supplier hosts", () => {
  const patterns = nextConfig.images?.remotePatterns ?? [];
  const hosts = patterns.map((pattern) => pattern.hostname);
  assert.deepEqual(hosts, [...PRODUCT_IMAGE_REMOTE_HOSTS]);
});

test("img-src lists the loader, supplier hosts, and Supabase storage", () => {
  const policy = contentSecurityPolicyReportOnly();
  const img = directive(policy, "img-src");
  assert.equal(PRODUCT_IMAGE_PROXY_HOST, "wsrv.nl");
  for (const host of PRODUCT_IMAGE_REMOTE_HOSTS) {
    assert.match(img, new RegExp(`https://${host.replaceAll(".", "\\.")}(?:\\s|$)`));
  }
  assert.match(img, /https:\/\/www\.joma-sport\.com/);
  assert.match(img, /https:\/\/v1\.joma-sport\.net/);
  assert.match(img, /https:\/\/wsrv\.nl/);
});

test("connect-src, form-action, and frame-src follow the env hosts", () => {
  const policy = contentSecurityPolicyReportOnly({
    supabaseUrl: "https://example.supabase.co/storage/v1",
    dpoPayUrl: "https://secure.3gdirectpay.com/payv3.php",
  });
  const connect = directive(policy, "connect-src");
  const form = directive(policy, "form-action");
  const frame = directive(policy, "frame-src");

  assert.match(connect, /https:\/\/example\.supabase\.co/);
  assert.match(connect, /wss:\/\/example\.supabase\.co/);
  assert.match(connect, /https:\/\/secure\.3gdirectpay\.com/);
  assert.match(form, /'self'/);
  assert.match(form, /https:\/\/secure\.3gdirectpay\.com/);
  assert.match(frame, /https:\/\/accounts\.google\.com/);
  assert.match(frame, /https:\/\/secure\.3gdirectpay\.com/);
  assert.equal(policy.split("; ").some((entry) => entry.startsWith("navigate-to")), false);
});

test("the policy reports violations to the collector path", () => {
  const policy = contentSecurityPolicyReportOnly();
  assert.equal(CSP_REPORT_PATH, "/api/csp-report");
  assert.match(directive(policy, "report-uri"), /report-uri \/api\/csp-report/);
});

test("without a nonce script-src keeps the legacy unsafe-inline shape", () => {
  const script = directive(contentSecurityPolicy(), "script-src");
  assert.match(script, /'unsafe-inline'/);
  assert.doesNotMatch(script, /'nonce-|'strict-dynamic'/);
});

test("with a nonce script-src is nonce + strict-dynamic", () => {
  const script = directive(contentSecurityPolicy({}, "testnonce123"), "script-src");
  assert.match(script, /'nonce-testnonce123'/);
  assert.match(script, /'strict-dynamic'/);
  // The explicit hosts stay as a fallback for pre-CSP3 browsers.
  assert.match(script, /https:\/\/accounts\.google\.com/);
});

const IMG_SRC_HOSTS = [
  "https://wsrv.nl",
  "https://wzmzwerzbyudcvoiiege.supabase.co",
  "https://www.joma-sport.com",
  "https://v1.joma-sport.net",
] as const;

const IMG_SRC_ALLOWED = new Set<string>(["'self'", "data:", "blob:", ...IMG_SRC_HOSTS]);

test("img-src allowlist has no wildcards and only the known hosts", () => {
  const policy = contentSecurityPolicy({}, "n");
  const sources = directive(policy, "img-src").split(/\s+/).slice(1);
  for (const host of IMG_SRC_HOSTS) {
    assert.ok(sources.includes(host), `img-src missing ${host}`);
  }
  for (const source of sources) {
    assert.equal(source.includes("*"), false, `wildcard in img-src: ${source}`);
    assert.ok(IMG_SRC_ALLOWED.has(source), `img-src allows ${source}`);
  }
});

test("CSP is built per-request in middleware, not emitted statically", async () => {
  // The static header list (next.config.ts) must not carry any CSP header —
  // the nonce-based policy is sent from middleware instead.
  const built = securityHeaders();
  assert.equal(
    built.some((header) => header.key.toLowerCase().startsWith("content-security-policy")),
    false,
    "securityHeaders() must not include a CSP header",
  );

  const routes = await nextConfig.headers?.();
  assert.ok(routes, "next.config headers() missing");
  assert.equal(
    routes.some((route) =>
      route.headers?.some((header) => header.key.toLowerCase().startsWith("content-security-policy")),
    ),
    false,
    "next.config headers() must not include a CSP header",
  );
});

test("HSTS is one year and does not include subdomains or preload", async () => {
  const built = securityHeaders().find((header) => header.key === "Strict-Transport-Security");
  assert.equal(built?.value, "max-age=31536000");
  const routes = await nextConfig.headers?.();
  const site = routes?.find((route) => route.source === "/:path*");
  const sent = site?.headers?.find((header) => header.key === "Strict-Transport-Security");
  assert.equal(sent?.value, "max-age=31536000");
  assert.doesNotMatch(sent?.value ?? "", /includeSubDomains|preload/i);
});

test("a non-https DPO or Supabase value falls back to the known hosts", () => {
  const policy = contentSecurityPolicyReportOnly({
    supabaseUrl: "http://evil.example",
    dpoPayUrl: "javascript:alert(1)",
  });
  assert.match(directive(policy, "connect-src"), /https:\/\/wzmzwerzbyudcvoiiege\.supabase\.co/);
  assert.match(directive(policy, "form-action"), /https:\/\/secure\.3gdirectpay\.com/);
  assert.doesNotMatch(policy, /evil\.example|javascript:/);
});
