/**
 * Local storefront fixture. Not imported by Next routes.
 * Refuses to listen when this process is marked as Vercel or production.
 * Binds to loopback only and does not call Supabase.
 */
import http from "node:http";
import { catalogVersion } from "../lib/catalog-version";
import { buildMobileStorefront } from "../lib/mobile-feed";
import { feedVersionParamStatus } from "../lib/mobile-feed-version";
import { loadFixtureProducts } from "./feed-fixture";

const HOST = "127.0.0.1";
const PORT = 43124;

if (process.env.VERCEL || process.env.VERCEL_ENV || process.env.NODE_ENV === "production") {
  console.error(
    "dev:fixture refuses to start because VERCEL, VERCEL_ENV, or NODE_ENV=production is set. This runner is local only.",
  );
  process.exit(1);
}

const products = loadFixtureProducts();
const feed = buildMobileStorefront(products, catalogVersion(products));
const feedBody = JSON.stringify(feed);
const versionBody = JSON.stringify({ version: feed.version });

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${HOST}`);
  if (req.method !== "GET") {
    res.writeHead(405, {
      Allow: "GET",
      "Content-Type": "application/json; charset=utf-8",
    });
    res.end(JSON.stringify({ error: "Method not allowed." }));
    return;
  }
  if (url.pathname === "/api/mobile/v1/version") {
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    });
    res.end(versionBody);
    return;
  }
  if (url.pathname === "/api/mobile/v1/storefront") {
    if (feedVersionParamStatus(url.searchParams.getAll("v")) === "invalid") {
      res.writeHead(400, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify({ error: "Invalid version." }));
      return;
    }
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
    });
    res.end(feedBody);
    return;
  }
  res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ error: "Not found." }));
});

server.listen(PORT, HOST, () => {
  console.log(`dev:fixture listening on http://${HOST}:${PORT}`);
});
