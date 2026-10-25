import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createRequire } from "node:module";
import {
  checkoutRateLimitBackend,
  memoryRateLimitAllowed,
} from "./checkout-memory-rate-limit";

const require = createRequire(import.meta.url);
const { installCheckoutLocalHooks } = require("./checkout-local-hook.cjs") as {
  installCheckoutLocalHooks: () => boolean;
};

const HOST = "127.0.0.1";
const PORT = 43124;

type PostHandler = (req: Request) => Promise<Response>;

if (!memoryRateLimitAllowed()) {
  console.error(
    "Refusing to start. This server is ignored when VERCEL_ENV is production or preview, or NODE_ENV is production.",
  );
  process.exit(1);
}

function headerLines(req: IncomingMessage) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else {
      headers.set(key, value);
    }
  }
  return headers;
}

function readBody(req: IncomingMessage) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function handle(quotePost: PostHandler, pricesPost: PostHandler, req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
  const handler =
    url.pathname === "/api/checkout/quote"
      ? quotePost
      : url.pathname === "/api/cart/prices"
        ? pricesPost
        : null;
  if (!handler) {
    res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "Not found." }));
    return;
  }
  if (req.method !== "POST") {
    res.writeHead(405, { allow: "POST", "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "Method not allowed." }));
    return;
  }
  void (async () => {
    try {
      const body = await readBody(req);
      const request = new Request(url, {
        method: "POST",
        headers: headerLines(req),
        body: body.toString("utf8"),
      });
      const response = await handler(request);
      const bytes = Buffer.from(await response.arrayBuffer());
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      res.writeHead(response.status, headers);
      res.end(bytes);
    } catch (err) {
      console.error("checkout local", err instanceof Error ? err.message : "failed");
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: "Could not price the cart." }));
      }
    }
  })();
}

async function main() {
  if (!installCheckoutLocalHooks()) {
    console.error("Refusing to start because the in-memory rate limiter cannot be installed.");
    process.exit(1);
  }

  const rateLimit = require("../lib/rate-limit") as {
    checkoutRateLimitBackend?: string;
  };
  if (rateLimit.checkoutRateLimitBackend !== checkoutRateLimitBackend) {
    console.error("Refusing to start because the Supabase rate limiter is still loaded.");
    process.exit(1);
  }

  const quoteRoute = require("../app/api/checkout/quote/route") as { POST: PostHandler };
  const pricesRoute = require("../app/api/cart/prices/route") as { POST: PostHandler };
  const quotePost = quoteRoute.POST;
  const pricesPost = pricesRoute.POST;
  const server = createServer((req, res) => {
    handle(quotePost, pricesPost, req, res);
  });
  server.listen(PORT, HOST, () => {
    console.log(`Checkout quote local server http://${HOST}:${PORT}`);
    console.log("POST /api/checkout/quote");
    console.log("POST /api/cart/prices");
    console.log("In-memory rate limit: 60 requests per minute per IP. No Supabase writes.");
  });
}

void main();
