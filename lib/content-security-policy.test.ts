import assert from "node:assert/strict";
import test from "node:test";
import nextConfig from "../next.config";
import { PRODUCT_IMAGE_PROXY_HOST } from "./product-image-loader";
import {
  CSP_REPORT_ONLY_HEADER,
  PRODUCT_IMAGE_REMOTE_HOSTS,
  contentSecurityPolicyReportOnly,
} from "./content-security-policy";

function directive(policy: string, name: string) {
  const part = policy.split("; ").find((entry) => entry.startsWith(`${name} `));
  assert.ok(part, `${name} missing`);
  return part;
}

test("the header stays report-only", () => {
  assert.equal(CSP_REPORT_ONLY_HEADER, "Content-Security-Policy-Report-Only");
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

test("connect-src, form-action, frame-src, and navigate-to follow the env hosts", () => {
  const policy = contentSecurityPolicyReportOnly({
    supabaseUrl: "https://example.supabase.co/storage/v1",
    dpoPayUrl: "https://secure.3gdirectpay.com/payv3.php",
    instagramUrl: "https://instagram.com/rappi",
    facebookUrl: "not a url",
  });
  const connect = directive(policy, "connect-src");
  const form = directive(policy, "form-action");
  const frame = directive(policy, "frame-src");
  const navigate = directive(policy, "navigate-to");

  assert.match(connect, /https:\/\/example\.supabase\.co/);
  assert.match(connect, /wss:\/\/example\.supabase\.co/);
  assert.match(connect, /https:\/\/secure\.3gdirectpay\.com/);
  assert.match(form, /'self'/);
  assert.match(form, /https:\/\/secure\.3gdirectpay\.com/);
  assert.match(frame, /https:\/\/accounts\.google\.com/);
  assert.match(frame, /https:\/\/secure\.3gdirectpay\.com/);
  assert.match(navigate, /'self'/);
  assert.match(navigate, /https:\/\/secure\.3gdirectpay\.com/);
  assert.match(navigate, /https:\/\/example\.supabase\.co/);
  assert.match(navigate, /https:\/\/accounts\.google\.com/);
  assert.match(navigate, /https:\/\/wa\.me/);
  assert.match(navigate, /mailto:/);
  assert.match(navigate, /https:\/\/instagram\.com/);
  assert.doesNotMatch(navigate, /not a url/);
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
