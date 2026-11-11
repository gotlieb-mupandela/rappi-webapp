import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidateCatalog } from "@/lib/admin/revalidate-catalog";
import { DPO_TEST_CODE } from "@/lib/dpo-test-product";
import type { OdooClient } from "@/lib/odoo";
import type { ChatTool } from "./llm";

/** Website tables the agent may touch. Rate limits and push endpoints stay out. */
export const WEBSITE_TABLES = [
  "addresses",
  "bag_quotations",
  "cart_items",
  "categories",
  "discount_codes",
  "order_items",
  "orders",
  "payments",
  "product_sizes",
  "products",
  "profiles",
  "shipping_methods",
  "site_settings",
  "stock_sync_runs",
  "teamwear_quotes",
  "wishlist_items",
] as const;

const CATALOG_TABLES = new Set(["products", "product_sizes", "categories", "site_settings", "shipping_methods"]);

/** Odoo methods that only read. Every other method needs the admin's approval. */
const ODOO_READ_METHODS = new Set([
  "search_read",
  "search_count",
  "search",
  "read",
  "read_group",
  "formatted_read_group",
  "web_read_group",
  "fields_get",
  "name_search",
  "default_get",
]);

/** Keeps Odoo from emailing customers or followers when the agent writes. */
const ODOO_QUIET = {
  mail_create_nosubscribe: true,
  mail_create_nolog: true,
  mail_notrack: true,
  tracking_disable: true,
  mail_auto_subscribe_no_notify: true,
};

const MAX_RESULT_CHARS = 24_000;
const FILTER_OPS = ["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "in", "is"] as const;

const filterSchema = {
  type: "array",
  description: "Row filters, all must match. Example: [{\"column\":\"status\",\"op\":\"eq\",\"value\":\"shipped\"}]",
  items: {
    type: "object",
    required: ["column", "op", "value"],
    properties: {
      column: { type: "string" },
      op: { type: "string", enum: FILTER_OPS },
      value: { description: "For in, an array. For is, null/true/false." },
    },
  },
};

export const AGENT_TOOLS: ChatTool[] = [
  {
    type: "function",
    function: {
      name: "website_sales_summary",
      description:
        "Website sales in one call: paid orders (paid DPO payment, not cancelled, DPO test orders excluded), revenue, average order, orders by status, top products and latest orders. Use this for any sales, revenue or order-count question.",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string", description: "Start date YYYY-MM-DD (inclusive). Omit for all time." },
          to: { type: "string", description: "End date YYYY-MM-DD (inclusive). Omit for up to today." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "website_low_stock",
      description: "Products still for sale on the website with the lowest total stock, lowest first.",
      parameters: {
        type: "object",
        properties: {
          max_stock: { type: "integer", description: "Only products with stock at or below this. Default 5." },
          limit: { type: "integer", description: "1-100, default 20" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "website_select",
      description:
        "Read rows from a RAPPI website (Supabase) table. Use count_only for totals. Returns at most 200 rows.",
      parameters: {
        type: "object",
        required: ["table"],
        properties: {
          table: { type: "string", enum: WEBSITE_TABLES },
          columns: { type: "string", description: "Comma-separated columns, default *. Related rows: \"*, order_items(*)\"." },
          filters: filterSchema,
          order_by: { type: "string" },
          ascending: { type: "boolean" },
          limit: { type: "integer", description: "1-200, default 50" },
          offset: { type: "integer" },
          count_only: { type: "boolean" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "website_insert",
      description: "Insert rows into a website table. Needs the admin's approval.",
      parameters: {
        type: "object",
        required: ["table", "rows"],
        properties: {
          table: { type: "string", enum: WEBSITE_TABLES },
          rows: { type: "array", items: { type: "object" } },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "website_update",
      description: "Update website rows matching filters (at least one filter). Needs the admin's approval.",
      parameters: {
        type: "object",
        required: ["table", "filters", "values"],
        properties: {
          table: { type: "string", enum: WEBSITE_TABLES },
          filters: filterSchema,
          values: { type: "object" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "website_delete",
      description:
        "Delete website rows matching filters (at least one filter). Permanent. To hide a product set available=false instead. Needs the admin's approval.",
      parameters: {
        type: "object",
        required: ["table", "filters"],
        properties: {
          table: { type: "string", enum: WEBSITE_TABLES },
          filters: filterSchema,
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "odoo_call",
      description:
        "Call any Odoo 20 model method through the JSON-2 API with named arguments. Read methods (search_read, search_count, read, formatted_read_group, fields_get, name_search) run at once; any other method (create, write, unlink, action_confirm, ...) needs the admin's approval. Examples: search_read {\"domain\":[[\"state\",\"=\",\"sale\"]],\"fields\":[\"name\",\"amount_total\"],\"limit\":20}; search_count {\"domain\":[]}; totals per group with formatted_read_group {\"domain\":[],\"groupby\":[\"state\"],\"aggregates\":[\"amount_total:sum\",\"__count\"]}; create {\"vals_list\":[{...}]}; write {\"ids\":[1],\"vals\":{...}}; unlink and actions {\"ids\":[...]}.",
      parameters: {
        type: "object",
        required: ["model", "method"],
        properties: {
          model: { type: "string" },
          method: { type: "string" },
          args: { type: "object", description: "Named arguments for the method." },
        },
      },
    },
  },
];

type Filter = { column: string; op: (typeof FILTER_OPS)[number]; value: unknown };

export type ToolCallInput = { name: string; args: Record<string, unknown> };

const READ_ONLY_TOOLS = new Set(["website_select", "website_sales_summary", "website_low_stock"]);

export function needsApproval(call: ToolCallInput) {
  if (READ_ONLY_TOOLS.has(call.name)) return false;
  if (call.name === "odoo_call") {
    // Without a model and method there is nothing to approve: let it fail as an error.
    if (!call.args.model || !call.args.method) return false;
    return !ODOO_READ_METHODS.has(String(call.args.method));
  }
  return true;
}

/** Short label for the approval card and the activity line. */
export function describeCall(call: ToolCallInput) {
  const a = call.args;
  switch (call.name) {
    case "website_sales_summary":
      return `Website sales summary${a.from || a.to ? ` (${a.from ?? "start"} to ${a.to ?? "today"})` : ""}`;
    case "website_low_stock":
      return "Website low-stock products";
    case "website_select":
      return `Read website ${a.table}`;
    case "website_insert":
      return `Add ${Array.isArray(a.rows) ? a.rows.length : "?"} row(s) to website ${a.table}`;
    case "website_update":
      return `Update website ${a.table}`;
    case "website_delete":
      return `Delete from website ${a.table}`;
    case "odoo_call":
      return `Odoo ${a.model} → ${a.method}`;
    default:
      return call.name;
  }
}

function asTable(value: unknown) {
  const t = String(value ?? "");
  if (!(WEBSITE_TABLES as readonly string[]).includes(t)) throw new Error(`Unknown or blocked table: ${t}`);
  return t;
}

function asFilters(value: unknown, required: boolean): Filter[] {
  const list = Array.isArray(value) ? value : [];
  const filters = list.map((f) => {
    const o = (f ?? {}) as Record<string, unknown>;
    const op = String(o.op ?? "");
    if (!(FILTER_OPS as readonly string[]).includes(op)) throw new Error(`Unsupported filter op: ${op}`);
    if (typeof o.column !== "string" || !/^[a-z_][a-z0-9_]*$/.test(o.column)) {
      throw new Error("Filter column must be a plain column name.");
    }
    return { column: o.column, op: op as Filter["op"], value: o.value };
  });
  if (required && !filters.length) throw new Error("At least one filter is required for this action.");
  return filters;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilters(query: any, filters: Filter[]) {
  for (const f of filters) {
    if (f.op === "in") query = query.in(f.column, Array.isArray(f.value) ? f.value : [f.value]);
    else if (f.op === "is") query = query.is(f.column, f.value as null | boolean);
    else query = query.filter(f.column, f.op, f.value as string);
  }
  return query;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

type SummaryOrder = {
  id: string;
  created_at: string;
  status: string;
  total: number;
  full_name: string | null;
  order_items: Array<{ code: string; name: string; qty: number; unit_price: number }>;
};

async function salesSummary(db: SupabaseClient, from: unknown, to: unknown) {
  const paidIds = new Set<string>();
  for (let start = 0; ; start += 1000) {
    const { data, error } = await db
      .from("payments")
      .select("order_id")
      .eq("status", "paid")
      .not("order_id", "is", null)
      .range(start, start + 999);
    if (error) throw new Error(error.message);
    for (const p of data ?? []) paidIds.add(p.order_id as string);
    if (!data || data.length < 1000) break;
  }

  const ids = [...paidIds];
  const orders: SummaryOrder[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    let q = db
      .from("orders")
      .select("id,created_at,status,total,full_name,order_items(code,name,qty,unit_price)")
      .in("id", ids.slice(i, i + 200))
      .neq("status", "cancelled");
    if (typeof from === "string" && from) q = q.gte("created_at", from);
    if (typeof to === "string" && to) q = q.lt("created_at", `${to}T23:59:59.999Z`);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    orders.push(...((data ?? []) as SummaryOrder[]));
  }

  const isTest = (o: SummaryOrder) => o.order_items.length > 0 && o.order_items.every((it) => it.code === DPO_TEST_CODE);
  const real = orders.filter((o) => !isTest(o)).sort((x, y) => y.created_at.localeCompare(x.created_at));
  const revenue = real.reduce((s, o) => s + Number(o.total), 0);
  const byStatus: Record<string, number> = {};
  const products = new Map<string, { code: string; name: string; qty: number; revenue: number }>();
  for (const o of real) {
    byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
    for (const it of o.order_items) {
      const p = products.get(it.code) ?? { code: it.code, name: it.name, qty: 0, revenue: 0 };
      p.qty += it.qty;
      p.revenue = round2(p.revenue + it.qty * Number(it.unit_price));
      products.set(it.code, p);
    }
  }

  return {
    period: { from: from || "all time", to: to || "today" },
    currency: "NAD",
    paid_orders: real.length,
    revenue: round2(revenue),
    average_order: real.length ? round2(revenue / real.length) : 0,
    orders_by_status: byStatus,
    dpo_test_orders_excluded: orders.length - real.length,
    top_products: [...products.values()].sort((x, y) => y.qty - x.qty).slice(0, 10),
    latest_orders: real.slice(0, 10).map((o) => ({
      id: o.id,
      date: o.created_at.slice(0, 10),
      status: o.status,
      total: Number(o.total),
      customer: o.full_name,
    })),
  };
}

/** Accepts "a, b", ["a","b"] or the JSON text of an array, which some models send. */
function selectColumns(value: unknown) {
  let v = value;
  if (typeof v === "string" && v.trim().startsWith("[")) {
    try {
      v = JSON.parse(v);
    } catch {
      // Leave as text.
    }
  }
  if (Array.isArray(v)) v = v.map(String).join(",");
  return typeof v === "string" && v.trim() ? v : "*";
}

function asRecord(value: unknown, what: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${what} must be an object.`);
  return value as Record<string, unknown>;
}

function clip(data: unknown) {
  const text = JSON.stringify(data);
  return text.length > MAX_RESULT_CHARS
    ? `${text.slice(0, MAX_RESULT_CHARS)}… [cut: ${text.length} characters in total; narrow the query]`
    : text;
}

export async function runTool(
  call: ToolCallInput,
  deps: { supabase: SupabaseClient; odoo: () => OdooClient },
): Promise<string> {
  const a = call.args;
  const db = deps.supabase;

  switch (call.name) {
    case "website_sales_summary":
      return clip(await salesSummary(db, a.from, a.to));
    case "website_low_stock": {
      const max = Number.isFinite(Number(a.max_stock)) ? Number(a.max_stock) : 5;
      const limit = Math.min(Math.max(Number(a.limit) || 20, 1), 100);
      const { data, error } = await db
        .from("products")
        .select("code,name,stock_qty,price")
        .eq("available", true)
        .lte("stock_qty", max)
        .order("stock_qty", { ascending: true })
        .order("code", { ascending: true })
        .limit(limit);
      if (error) throw new Error(error.message);
      return clip({ max_stock: max, products: data });
    }
    case "website_select": {
      const table = asTable(a.table);
      const filters = asFilters(a.filters, false);
      if (a.count_only) {
        const { count, error } = await applyFilters(
          db.from(table).select("*", { count: "exact", head: true }),
          filters,
        );
        if (error) throw new Error(error.message);
        return clip({ count });
      }
      const limit = Math.min(Math.max(Number(a.limit) || 50, 1), 200);
      const offset = Math.max(Number(a.offset) || 0, 0);
      let query = applyFilters(db.from(table).select(selectColumns(a.columns)), filters);
      if (typeof a.order_by === "string" && a.order_by) {
        // Accept "col", "col.desc" or "col desc".
        const [col, dir] = a.order_by.trim().split(/[.\s]+/);
        const ascending = dir ? dir.toLowerCase() !== "desc" : a.ascending !== false;
        query = query.order(col, { ascending });
      }
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) throw new Error(error.message);
      return clip({ rows: data, returned: data?.length ?? 0 });
    }
    case "website_insert": {
      const table = asTable(a.table);
      const rows = Array.isArray(a.rows) ? a.rows.map((r) => asRecord(r, "Each row")) : [];
      if (!rows.length) throw new Error("rows must be a non-empty array.");
      const { data, error } = await db.from(table).insert(rows).select();
      if (error) throw new Error(error.message);
      if (CATALOG_TABLES.has(table)) revalidateCatalog();
      return clip({ inserted: data?.length ?? 0, rows: data });
    }
    case "website_update": {
      const table = asTable(a.table);
      const values = asRecord(a.values, "values");
      const { data, error } = await applyFilters(db.from(table).update(values), asFilters(a.filters, true)).select();
      if (error) throw new Error(error.message);
      if (CATALOG_TABLES.has(table)) revalidateCatalog();
      return clip({ updated: data?.length ?? 0, rows: data });
    }
    case "website_delete": {
      const table = asTable(a.table);
      const { data, error } = await applyFilters(db.from(table).delete(), asFilters(a.filters, true)).select();
      if (error) throw new Error(error.message);
      if (CATALOG_TABLES.has(table)) revalidateCatalog();
      return clip({ deleted: data?.length ?? 0 });
    }
    case "odoo_call": {
      const model = String(a.model ?? "");
      const method = String(a.method ?? "");
      if (!/^[a-z0-9_.]+$/.test(model) || !/^[a-z_][a-z0-9_]*$/.test(method) || method.startsWith("_")) {
        throw new Error("Invalid Odoo model or method name.");
      }
      const params = a.args ? { ...asRecord(a.args, "args") } : {};
      // Models often leave out the domain for "count everything"; Odoo requires it.
      if (["search_read", "search_count", "search", "read_group", "formatted_read_group"].includes(method)) {
        params.domain ??= [];
      }
      if (!ODOO_READ_METHODS.has(method)) {
        params.context = { ...ODOO_QUIET, ...((params.context as Record<string, unknown>) ?? {}) };
      }
      const result = await deps.odoo().call(model, method, params);
      return clip(result);
    }
    default:
      throw new Error(`Unknown tool: ${call.name}`);
  }
}
