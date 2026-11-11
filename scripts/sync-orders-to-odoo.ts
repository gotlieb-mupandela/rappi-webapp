/**
 * Copy paid website orders and customers into Odoo.
 *
 *   npm run odoo:orders                      dry run: shows what would be created
 *   npm run odoo:orders -- --apply --limit 5 create the first 5 orders
 *   npm run odoo:orders -- --apply           create all paid orders not yet in Odoo
 *
 * Options:
 *   --orders RSH1,RSH2   only these website orders
 *   --since 2026-11-01   only orders from this date
 *   --no-confirm         leave orders as quotations in Odoo
 *   --no-customers       skip registered customers who have not ordered
 *
 * Needs in .env.local: ODOO_URL, ODOO_API_KEY, NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY. Reads Supabase only; never deletes; never emails.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import { createOdooClient, odooConfigFromEnv } from "../lib/odoo";
import { syncOrdersToOdoo } from "../lib/odoo-orders";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function arg(name: string) {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}
const has = (name: string) => process.argv.includes(name);

async function main() {
  const envFile = join(root, ".env.local");
  if (existsSync(envFile)) process.loadEnvFile(envFile);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.");
    process.exit(1);
  }
  const supabase = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const odoo = createOdooClient(odooConfigFromEnv(), { timeoutMs: 120_000 });

  const apply = has("--apply");
  const limitRaw = arg("--limit");
  console.log(apply ? "APPLY: writing to Odoo." : "DRY RUN: nothing will be written. Add --apply to write.");

  const result = await syncOrdersToOdoo(supabase, odoo, {
    apply,
    confirm: !has("--no-confirm"),
    limit: limitRaw ? Number(limitRaw) : undefined,
    orderIds: arg("--orders")?.split(",").map((s) => s.trim()).filter(Boolean),
    since: arg("--since"),
    customers: !has("--no-customers"),
    log: (l) => console.log(l),
  });

  console.log("\n=== Orders: website -> Odoo ===");
  console.log(`Website orders:            ${result.websiteOrders}`);
  console.log(`Skipped, cancelled:        ${result.skippedCancelled}`);
  console.log(`Skipped, not paid:         ${result.skippedUnpaid}`);
  console.log(`Already in Odoo:           ${result.alreadyInOdoo}`);
  if (apply) {
    console.log(`Created in Odoo:           ${result.created.length} (${result.created.filter((c) => c.confirmed).length} confirmed)`);
    console.log(`Contacts created:          ${result.contactsCreated}`);
  } else {
    console.log(`Would create:              ${result.wouldCreate.length}`);
    console.log(`Contacts would be created: ${result.contactsWouldCreate}`);
    for (const w of result.wouldCreate.slice(0, 10)) console.log(`  ${w.order}: ${w.lines} item(s), NAD ${w.total}`);
  }
  console.log(`Needs review:              ${result.needsReview.length}`);
  for (const r of result.needsReview.slice(0, 20)) console.log(`  ${r.order}: ${r.reason}`);
  console.log(`Errors:                    ${result.errors.length}`);
  for (const e of result.errors.slice(0, 20)) console.log(`  ${e.order ?? ""} ${e.message}`);

  const outDir = join(root, "tmp", "odoo-sync");
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, `orders-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(outFile, JSON.stringify(result, null, 2));
  console.log(`\nFull report: ${outFile}`);
  if (result.errors.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
