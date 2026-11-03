/**
 * One-off: send a test invoice email with the current logo.
 * Usage: npx tsx scripts/send-test-invoice.mjs [orderId] [toEmail]
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const raw = readFileSync(".env.local", "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i <= 0) continue;
    const key = trimmed.slice(0, i).trim();
    let val = trimmed.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const orderId = process.argv[2] || "RSH8D7501BC";
const toEmail = process.argv[3] || "gotliebinvestment@gmail.com";

async function main() {
  const { sendOrderInvoice } = await import("../lib/invoice-email.ts");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase admin env");

  const admin = createClient(url, key);
  const { data: before, error: readErr } = await admin
    .from("orders")
    .select("id, email, full_name, status")
    .eq("id", orderId)
    .single();
  if (readErr || !before) throw new Error(readErr?.message || "Order not found");

  const prevEmail = before.email;
  const { error: updErr } = await admin
    .from("orders")
    .update({ email: toEmail, invoice_sent_at: null, invoice_last_error: null })
    .eq("id", orderId);
  if (updErr) throw new Error(updErr.message);

  console.log(`Sending invoice ${orderId} → ${toEmail} (was ${prevEmail})…`);
  const result = await sendOrderInvoice(orderId, { force: true });
  console.log(JSON.stringify(result, null, 2));

  await admin.from("orders").update({ email: prevEmail }).eq("id", orderId);
  console.log(`Restored order email to ${prevEmail}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
