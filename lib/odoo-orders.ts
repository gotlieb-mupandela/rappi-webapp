import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { OdooClient } from "@/lib/odoo";

/**
 * Copies paid website orders (Supabase) into Odoo as sales orders, and website
 * customers into Odoo as contacts.
 *
 * - Read-only on Supabase: nothing on the website side is written or deleted.
 * - Never deletes in Odoo and never sends email from Odoo.
 * - Safe to run again: an order is recognised in Odoo by its website order id
 *   (stored in the sales order "Customer Reference"), a customer by email.
 * - An order whose Odoo total does not match the website total is left as a
 *   quotation (not confirmed) and reported, so nothing wrong is confirmed.
 */

type Supabase = SupabaseClient<Database>;
type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type ItemRow = Database["public"]["Tables"]["order_items"]["Row"];

export type OrderSyncOptions = {
  apply: boolean;
  /** Confirm orders in Odoo (default true). False leaves them as quotations. */
  confirm?: boolean;
  /** Max orders to create in this run. */
  limit?: number;
  /** Only these website order ids. */
  orderIds?: string[];
  /** Only orders created at/after this ISO date. */
  since?: string;
  /** Also copy registered customers who have not ordered yet (default true). */
  customers?: boolean;
  /** Stop starting new orders after this many ms (for serverless time limits). */
  timeBudgetMs?: number;
  log?: (line: string) => void;
};

export type OrderSyncResult = {
  websiteOrders: number;
  alreadyInOdoo: number;
  skippedCancelled: number;
  skippedUnpaid: number;
  created: Array<{ order: string; odooId: number; total: number; confirmed: boolean }>;
  wouldCreate: Array<{ order: string; customer: string; lines: number; total: number }>;
  needsReview: Array<{ order: string; reason: string }>;
  contactsCreated: number;
  contactsWouldCreate: number;
  errors: Array<{ order?: string; message: string }>;
  stoppedEarly: boolean;
};

/** No tracking, chatter, followers or emails for anything this sync writes. */
const QUIET = {
  tracking_disable: true,
  mail_create_nolog: true,
  mail_create_nosubscribe: true,
  mail_notrack: true,
  mail_auto_subscribe_no_notify: true,
  mail_notify_force_send: false,
};

const DISCOUNT_REF = "WEB-DISCOUNT";
const DELIVERY_REF = "Delivery_007";

function odooDate(iso: string) {
  return new Date(iso).toISOString().slice(0, 19).replace("T", " ");
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

async function readAllSupabase<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
) {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await fetchPage(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function syncOrdersToOdoo(
  supabase: Supabase,
  odoo: OdooClient,
  opts: OrderSyncOptions,
): Promise<OrderSyncResult> {
  const started = Date.now();
  const log = opts.log ?? (() => {});
  const confirm = opts.confirm ?? true;
  const result: OrderSyncResult = {
    websiteOrders: 0,
    alreadyInOdoo: 0,
    skippedCancelled: 0,
    skippedUnpaid: 0,
    created: [],
    wouldCreate: [],
    needsReview: [],
    contactsCreated: 0,
    contactsWouldCreate: 0,
    errors: [],
    stoppedEarly: false,
  };

  // ---- Website side (read-only) -------------------------------------------
  let orders = await readAllSupabase<OrderRow>((from, to) => {
    let q = supabase.from("orders").select("*").order("created_at", { ascending: true }).range(from, to);
    if (opts.since) q = q.gte("created_at", opts.since);
    if (opts.orderIds?.length) q = q.in("id", opts.orderIds);
    return q;
  });
  result.websiteOrders = orders.length;

  // An order counts as paid when a DPO payment marked "paid" points at it.
  const paid = new Set(
    (
      await readAllSupabase<{ order_id: string | null }>((from, to) =>
        supabase.from("payments").select("order_id").eq("status", "paid").not("order_id", "is", null).range(from, to),
      )
    ).map((p) => p.order_id as string),
  );

  orders = orders.filter((o) => {
    if (o.status === "cancelled") {
      result.skippedCancelled += 1;
      return false;
    }
    if (!paid.has(o.id)) {
      result.skippedUnpaid += 1;
      return false;
    }
    return true;
  });

  // ---- Odoo side: what is already there -----------------------------------
  const existing = new Set<string>();
  for (let i = 0; i < orders.length; i += 200) {
    const ids = orders.slice(i, i + 200).map((o) => o.id);
    const rows = await odoo.searchRead<{ id: number; client_order_ref: string | false }>(
      "sale.order",
      [["client_order_ref", "in", ids]],
      ["client_order_ref"],
      { context: { active_test: false } },
    );
    for (const r of rows) if (r.client_order_ref) existing.add(r.client_order_ref);
  }
  result.alreadyInOdoo = orders.filter((o) => existing.has(o.id)).length;
  let todo = orders.filter((o) => !existing.has(o.id));
  if (opts.limit !== undefined) todo = todo.slice(0, opts.limit);

  const items = new Map<string, ItemRow[]>();
  for (let i = 0; i < todo.length; i += 200) {
    const ids = todo.slice(i, i + 200).map((o) => o.id);
    const rows = await readAllSupabase<ItemRow>((from, to) =>
      supabase.from("order_items").select("*").in("order_id", ids).order("code").range(from, to),
    );
    for (const r of rows) {
      if (!items.has(r.order_id)) items.set(r.order_id, []);
      items.get(r.order_id)!.push(r);
    }
  }

  // Shared lookups.
  const vatTaxes = await odoo.searchRead<{ id: number; amount: number }>(
    "account.tax",
    [["type_tax_use", "=", "sale"], ["amount_type", "=", "percent"], ["price_include", "=", false]],
    ["amount"],
  );
  const taxFor = (rate: number) => vatTaxes.find((t) => Math.abs(t.amount - rate) < 0.001)?.id;
  const countries = await odoo.searchRead<{ id: number; name: string; code: string }>("res.country", [], ["name", "code"]);
  const countryId = (name: string) => {
    const n = norm(name || "Namibia");
    return countries.find((c) => norm(c.name) === n || norm(c.code) === n)?.id ?? false;
  };

  const serviceProduct = async (ref: string, name: string) => {
    const found = await odoo.searchRead<{ id: number }>("product.product", [["default_code", "=", ref]], ["id"], {
      context: { active_test: false },
    });
    if (found.length) return found[0].id;
    if (!opts.apply) return -1;
    const [tmpl] = await odoo.create(
      "product.template",
      [{ name, type: "service", default_code: ref, sale_ok: true, purchase_ok: false, list_price: 0, taxes_id: [[6, 0, []]] }],
      QUIET,
    );
    const [variant] = await odoo.searchRead<{ id: number }>("product.product", [["product_tmpl_id", "=", tmpl]], ["id"]);
    log(`  created service product "${name}"`);
    return variant.id;
  };
  const productCache = new Map<string, number | null>();
  const findVariant = async (code: string, size: string) => {
    const refs = [size ? `${code}-${size.trim()}` : null, code].filter(Boolean) as string[];
    for (const ref of refs) {
      if (productCache.has(ref)) {
        const hit = productCache.get(ref);
        if (hit) return hit;
        continue;
      }
      const rows = await odoo.searchRead<{ id: number }>("product.product", [["default_code", "=", ref]], ["id"], {
        context: { active_test: false },
        limit: 1,
      });
      productCache.set(ref, rows[0]?.id ?? null);
      if (rows[0]) return rows[0].id;
    }
    return null;
  };

  // ---- Contacts ------------------------------------------------------------
  const partnerCache = new Map<string, number>();
  const findPartner = async (email: string) => {
    const key = norm(email);
    if (partnerCache.has(key)) return partnerCache.get(key)!;
    const rows = await odoo.searchRead<{ id: number }>(
      "res.partner",
      [["email", "=ilike", email.trim()], ["parent_id", "=", false]],
      ["id"],
      { limit: 1, order: "id", context: { active_test: false } },
    );
    if (rows[0]) partnerCache.set(key, rows[0].id);
    return rows[0]?.id ?? null;
  };

  const ensurePartner = async (o: OrderRow) => {
    let id = await findPartner(o.email);
    if (!id) {
      if (!opts.apply) return { partner: -1, shipping: -1, isNew: true };
      [id] = await odoo.create(
        "res.partner",
        [
          {
            name: o.full_name || o.email,
            email: o.email.trim(),
            phone: o.phone || false,
            street: o.address || false,
            city: o.city || false,
            country_id: countryId(o.country),
            customer_rank: 1,
            comment: "Website customer",
          },
        ],
        QUIET,
      );
      partnerCache.set(norm(o.email), id);
      result.contactsCreated += 1;
      return { partner: id, shipping: id, isNew: true };
    }
    // Existing contact: use it as the delivery address if it matches, otherwise
    // reuse or add a delivery address under it (the contact itself is not changed).
    const [p] = await odoo.read<{ street: string | false; city: string | false }>("res.partner", [id], ["street", "city"]);
    if (!o.address || (norm(p.street || "") === norm(o.address) && norm(p.city || "") === norm(o.city))) {
      return { partner: id, shipping: id, isNew: false };
    }
    const children = await odoo.searchRead<{ id: number; street: string | false; city: string | false }>(
      "res.partner",
      [["parent_id", "=", id], ["type", "=", "delivery"]],
      ["street", "city"],
    );
    const match = children.find((c) => norm(c.street || "") === norm(o.address) && norm(c.city || "") === norm(o.city));
    if (match) return { partner: id, shipping: match.id, isNew: false };
    if (!opts.apply) return { partner: id, shipping: -1, isNew: false };
    const [child] = await odoo.create(
      "res.partner",
      [
        {
          parent_id: id,
          type: "delivery",
          name: o.full_name || o.email,
          phone: o.phone || false,
          street: o.address,
          city: o.city || false,
          country_id: countryId(o.country),
        },
      ],
      QUIET,
    );
    return { partner: id, shipping: child, isNew: false };
  };

  // ---- Orders --------------------------------------------------------------
  const deliveryProduct = await serviceProduct(DELIVERY_REF, "Standard delivery");
  let discountProduct: number | null = null;

  for (const o of todo) {
    if (opts.timeBudgetMs && Date.now() - started > opts.timeBudgetMs) {
      result.stoppedEarly = true;
      break;
    }
    try {
      const lines = items.get(o.id) ?? [];
      if (!lines.length) {
        result.needsReview.push({ order: o.id, reason: "order has no items" });
        continue;
      }
      const vatRate = Number(o.vat_rate) || 0;
      const taxId = vatRate > 0 ? taxFor(vatRate) : undefined;
      if (vatRate > 0 && !taxId) {
        result.needsReview.push({ order: o.id, reason: `no ${vatRate}% sales tax in Odoo` });
        continue;
      }
      const taxes = [[6, 0, taxId ? [taxId] : []]];

      const orderLines: unknown[] = [];
      const missing: string[] = [];
      for (const it of lines) {
        const pid = await findVariant(it.code, it.size);
        if (!pid) {
          missing.push(it.size ? `${it.code} size ${it.size}` : it.code);
          continue;
        }
        orderLines.push([
          0,
          0,
          { product_id: pid, product_uom_qty: it.qty, price_unit: Number(it.unit_price), tax_ids: taxes },
        ]);
      }
      if (missing.length) {
        result.needsReview.push({ order: o.id, reason: `product not in Odoo: ${missing.join(", ")}` });
        continue;
      }
      if (Number(o.shipping_cost) > 0 || o.shipping_method) {
        orderLines.push([
          0,
          0,
          {
            product_id: deliveryProduct,
            name: `Delivery: ${o.shipping_method || "standard"}`,
            product_uom_qty: 1,
            price_unit: Number(o.shipping_cost) || 0,
            tax_ids: taxes,
          },
        ]);
      }
      if (Number(o.discount_amount) > 0) {
        discountProduct ??= await serviceProduct(DISCOUNT_REF, "Website discount");
        orderLines.push([
          0,
          0,
          {
            product_id: discountProduct,
            name: `Discount${o.discount_code ? ` ${o.discount_code}` : ""}${o.discount_rate ? ` (${o.discount_rate}%)` : ""}`,
            product_uom_qty: 1,
            price_unit: -Number(o.discount_amount),
            tax_ids: taxes,
          },
        ]);
      }

      const customer = await ensurePartner(o);
      if (!opts.apply) {
        if (customer.isNew) result.contactsWouldCreate += 1;
        result.wouldCreate.push({ order: o.id, customer: o.email, lines: lines.length, total: Number(o.total) });
        continue;
      }

      const [soId] = await odoo.create(
        "sale.order",
        [
          {
            partner_id: customer.partner,
            partner_invoice_id: customer.partner,
            partner_shipping_id: customer.shipping,
            client_order_ref: o.id,
            origin: `Website ${o.id}`,
            date_order: odooDate(o.created_at),
            note: o.notes || false,
            order_line: orderLines,
          },
        ],
        QUIET,
      );
      const [so] = await odoo.read<{ amount_total: number; name: string }>("sale.order", [soId], ["amount_total", "name"]);
      const diff = Math.abs(so.amount_total - Number(o.total));
      if (diff > 0.05) {
        result.needsReview.push({
          order: o.id,
          reason: `left as quotation ${so.name}: Odoo total ${so.amount_total} vs website ${o.total}`,
        });
        result.created.push({ order: o.id, odooId: soId, total: so.amount_total, confirmed: false });
        continue;
      }
      let confirmed = false;
      if (confirm) {
        await odoo.call("sale.order", "action_confirm", { ids: [soId], context: QUIET });
        // Confirming stamps today's date; keep the date the customer ordered.
        await odoo.write("sale.order", [soId], { date_order: odooDate(o.created_at) }, QUIET);
        confirmed = true;
      }
      result.created.push({ order: o.id, odooId: soId, total: so.amount_total, confirmed });
      log(`  ${o.id} -> ${so.name} (NAD ${so.amount_total})${confirmed ? " confirmed" : ""}`);
    } catch (error) {
      result.errors.push({ order: o.id, message: error instanceof Error ? error.message : String(error) });
    }
  }

  // ---- Registered customers who have not ordered ----------------------------
  if ((opts.customers ?? true) && !opts.orderIds?.length && !result.stoppedEarly) {
    const profiles = await readAllSupabase<{ email: string; full_name: string; role: string }>((from, to) =>
      supabase.from("profiles").select("email, full_name, role").range(from, to),
    );
    for (const p of profiles) {
      if (p.role !== "customer" || !p.email) continue;
      if (opts.timeBudgetMs && Date.now() - started > opts.timeBudgetMs) {
        result.stoppedEarly = true;
        break;
      }
      try {
        if (await findPartner(p.email)) continue;
        if (!opts.apply) {
          result.contactsWouldCreate += 1;
          continue;
        }
        const [id] = await odoo.create(
          "res.partner",
          [{ name: p.full_name || p.email, email: p.email.trim(), customer_rank: 1, comment: "Website customer" }],
          QUIET,
        );
        partnerCache.set(norm(p.email), id);
        result.contactsCreated += 1;
      } catch (error) {
        result.errors.push({ message: `contact ${p.email}: ${error instanceof Error ? error.message : String(error)}` });
      }
    }
  }

  return result;
}
