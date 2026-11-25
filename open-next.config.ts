import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";

/**
 * Cloudflare Workers build (OpenNext). Vercel ignores this file.
 * - Saved pages and unstable_cache data live in Workers KV (R2 is not enabled on the account).
 * - revalidateTag("catalog") is tracked in D1.
 * - Background page refreshes go through a Durable Object queue.
 */
const cloudflareConfig = defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
  tagCache: d1NextTagCache,
  queue: doQueue,
});

const config = {
  ...cloudflareConfig,
  // `npm run build` uses webpack (see package.json): Turbopack inlines the
  // data/*.json catalogue into every route chunk, which takes the Worker far
  // past Cloudflare's script size limit.
  buildCommand: "npm run build",
};

export default config;
