import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidateCatalog } from "@/lib/admin/revalidate-catalog";
import { DPO_TEST_CODE } from "@/lib/dpo-test-product";
import type { OdooClient } from "@/lib/odoo";
import { syncOrdersToOdoo } from "@/lib/odoo-orders";
import type { ChatTool } from "./llm";

/** Every table in the website database. */
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
  "push_subscriptions",
  "rate_limits",
  "shipping_methods",
  "site_settings",
  "stock_sync_runs",
  "teamwear_quotes",
  "wishlist_items",
] as const;

/** Website database functions that only read; any other function needs approval. */
const WEBSITE_READ_FUNCTIONS = new Set(["discount_use_counts", "storefront_catalog_page", "is_admin"]);

export type ToolDeps = {
  /** Service-role client: full table access. */
  supabase: SupabaseClient;
  /** The signed-in admin's own session, so database functions see them as admin. */
  adminDb: SupabaseClient;
  odoo: () => OdooClient;
};

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
      name: "search_everywhere",
      description:
        "Search both systems at once for a name, code, email, order id or word: website products, orders and customers, and Odoo contacts, products, sales orders, invoices, tasks, CRM leads, employees and knowledge articles. Use it first when you don't know where something lives.",
      parameters: {
        type: "object",
        required: ["query"],
        properties: { query: { type: "string" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "odoo_find_models",
      description:
        "Find which Odoo models (tables) hold a kind of data, e.g. \"payslip\", \"expense\", \"attendance\", \"survey\". Returns model names to use with odoo_call. Then call fields_get on a model to see its fields.",
      parameters: {
        type: "object",
        required: ["query"],
        properties: { query: { type: "string" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "website_function",
      description:
        "Run a website database function, as the signed-in admin. E.g. set_order_status {\"p_order_id\":\"RSH…\",\"p_status\":\"shipped\"} (statuses: reserved, preparing, shipped, cancelled), discount_use_counts {}. Functions that change data need approval.",
      parameters: {
        type: "object",
        required: ["function"],
        properties: {
          function: { type: "string" },
          args: { type: "object", description: "Named arguments." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "sync_orders_to_odoo",
      description:
        "Copy paid website orders and their customers that are not in Odoo yet into Odoo as confirmed sales orders. Safe to repeat: orders already in Odoo are skipped. Needs approval.",
      parameters: {
        type: "object",
        properties: {
          since: { type: "string", description: "Only orders from this date, YYYY-MM-DD. Default: last 30 days." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "odoo_person_agenda",
      description:
        "Everything on a staff member's plate in Odoo in one call: their open tasks and to-dos (due that day, overdue, upcoming, with the task notes), activities, calendar events and approved time off. Use for any question about a person's tasks, to-dos, schedule, meetings or day.",
      parameters: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", description: "Person's name or email, e.g. Gotlieb" },
          date: { type: "string", description: "Day as YYYY-MM-DD. Default: today (Namibia time)." },
          days: { type: "integer", description: "How many days from date to cover, default 1, max 31." },
        },
      },
    },
  },
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

const READ_ONLY_TOOLS = new Set([
  "website_select",
  "website_sales_summary",
  "website_low_stock",
  "odoo_person_agenda",
  "search_everywhere",
  "odoo_find_models",
]);

export function needsApproval(call: ToolCallInput) {
  if (READ_ONLY_TOOLS.has(call.name)) return false;
  if (call.name === "odoo_call") {
    // Without a model and method there is nothing to approve: let it fail as an error.
    if (!call.args.model || !call.args.method) return false;
    return !ODOO_READ_METHODS.has(String(call.args.method));
  }
  if (call.name === "website_function") return !WEBSITE_READ_FUNCTIONS.has(String(call.args.function ?? ""));
  return true;
}

/** Deletions always wait for the admin, even with auto-approve on. */
export function isDestructive(call: ToolCallInput) {
  if (call.name === "website_delete") return true;
  if (call.name === "odoo_call") return /unlink|delete|cancel/i.test(String(call.args.method ?? ""));
  return false;
}

/** Short label for the approval card and the activity line. */
export function describeCall(call: ToolCallInput) {
  const a = call.args;
  switch (call.name) {
    case "odoo_person_agenda":
      return `Odoo agenda for ${a.name ?? "?"}${a.date ? ` (${a.date})` : ""}`;
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
    case "search_everywhere":
      return `Search website and Odoo for “${a.query ?? ""}”`;
    case "odoo_find_models":
      return `Find Odoo data about “${a.query ?? ""}”`;
    case "website_function":
      return `Website function ${a.function}`;
    case "sync_orders_to_odoo":
      return "Copy new paid website orders into Odoo";
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

/** Namibia is UTC+2 all year; Odoo stores datetimes in UTC. */
const TZ_OFFSET_HOURS = 2;

function namibiaToday() {
  return new Date(Date.now() + TZ_OFFSET_HOURS * 3600_000).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD HH:MM:SS" in UTC, Odoo's datetime format, for local midnight of a day. */
function odooUtc(day: string, addDays = 0) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + addDays);
  d.setUTCHours(d.getUTCHours() - TZ_OFFSET_HOURS);
  return d.toISOString().slice(0, 19).replace("T", " ");
}

function stripHtml(html: unknown, max = 1500) {
  if (typeof html !== "string") return "";
  const text = html
    .replace(/<\/(p|div|li|h\d)>|<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

type Row = Record<string, unknown>;
const m2o = (v: unknown) => (Array.isArray(v) ? v[1] : null);

/** Odoo models searched by name; each one is skipped if its app is missing. */
const ODOO_SEARCH_MODELS: Array<[model: string, label: string]> = [
  ["res.partner", "contacts"],
  ["product.template", "products"],
  ["sale.order", "sales orders"],
  ["account.move", "invoices and bills"],
  ["purchase.order", "purchase orders"],
  ["project.task", "tasks and to-dos"],
  ["project.project", "projects"],
  ["crm.lead", "CRM leads"],
  ["hr.employee", "employees"],
  ["knowledge.article", "knowledge articles"],
  ["calendar.event", "calendar events"],
];

async function searchEverywhere(deps: ToolDeps, raw: string) {
  const q = raw.trim();
  if (!q) throw new Error("query is required.");
  // PostgREST or-filter values: keep to safe characters.
  const like = `%${q.replace(/[,()*%\\]/g, " ").trim()}%`;
  const db = deps.supabase;

  const website = Promise.all([
    db.from("products").select("code,name,price,stock_qty,available").or(`code.ilike.${like},name.ilike.${like}`).limit(10),
    db.from("orders").select("id,full_name,email,status,total,created_at").or(`id.ilike.${like},email.ilike.${like},full_name.ilike.${like}`).order("created_at", { ascending: false }).limit(10),
    db.from("profiles").select("id,full_name,email,role,created_at").or(`email.ilike.${like},full_name.ilike.${like}`).limit(10),
  ]).then(([p, o, c]) => ({
    products: p.data ?? [],
    orders: o.data ?? [],
    customers: c.data ?? [],
  }));

  const odoo = Promise.all(
    ODOO_SEARCH_MODELS.map(async ([model, label]) => {
      try {
        const hits = await deps.odoo().call<Array<[number, string]> | Array<{ id: number; display_name: string }>>(
          model,
          "name_search",
          { name: q, limit: 8 },
        );
        const list = (hits ?? []).map((h) => (Array.isArray(h) ? { id: h[0], name: h[1] } : { id: h.id, name: h.display_name }));
        return list.length ? [label, { model, results: list }] : null;
      } catch {
        return null;
      }
    }),
  ).then((rows) => Object.fromEntries(rows.filter((r): r is [string, { model: string; results: { id: number; name: string }[] }] => r !== null)));

  const [w, o] = await Promise.all([website, odoo]);
  return { query: q, website: w, odoo: o };
}

async function personAgenda(odoo: OdooClient, nameArg: unknown, dateArg: unknown, daysArg: unknown) {
  const name = String(nameArg ?? "").trim();
  if (!name) throw new Error("name is required.");
  const day = typeof dateArg === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateArg) ? dateArg : namibiaToday();
  const days = Math.min(Math.max(Number(daysArg) || 1, 1), 31);
  const start = odooUtc(day);
  const end = odooUtc(day, days);

  const users = await odoo.searchRead<Row>(
    "res.users",
    ["|", ["name", "ilike", name], ["login", "ilike", name]],
    ["name", "login", "partner_id"],
    { limit: 5 },
  );
  if (!users.length) {
    return { found: false, message: `No Odoo user matches "${name}". Try another spelling or their email.` };
  }
  if (users.length > 1 && !users.some((u) => String(u.name).toLowerCase() === name.toLowerCase())) {
    const exact = users.filter((u) => String(u.name).toLowerCase().startsWith(name.toLowerCase()));
    if (exact.length !== 1) {
      return { found: false, ambiguous: users.map((u) => ({ id: u.id, name: u.name, login: u.login })) };
    }
  }
  const user = users.find((u) => String(u.name).toLowerCase() === name.toLowerCase()) ?? users[0];
  const uid = Number(user.id);
  const partnerId = Array.isArray(user.partner_id) ? Number(user.partner_id[0]) : null;
  const notes: string[] = [];

  const safe = async <T,>(what: string, fn: () => Promise<T>, fallback: T) => {
    try {
      return await fn();
    } catch (error) {
      notes.push(`${what}: ${error instanceof Error ? error.message.slice(0, 160) : "failed"}`);
      return fallback;
    }
  };

  const [tasks, activities, events, leaves] = await Promise.all([
    safe(
      "tasks",
      () =>
        odoo.searchRead<Row>(
          "project.task",
          [["user_ids", "in", [uid]], ["state", "not in", ["1_done", "1_canceled"]]],
          ["name", "project_id", "stage_id", "state", "priority", "date_deadline", "description"],
          { limit: 40, order: "date_deadline asc, priority desc" },
        ),
      [] as Row[],
    ),
    safe(
      "activities",
      () =>
        odoo.searchRead<Row>(
          "mail.activity",
          [["user_id", "=", uid], ["date_deadline", "<", end.slice(0, 10)]],
          ["summary", "activity_type_id", "res_name", "res_model", "date_deadline", "note"],
          { limit: 40, order: "date_deadline asc" },
        ),
      [] as Row[],
    ),
    partnerId
      ? safe(
          "calendar",
          () =>
            odoo.searchRead<Row>(
              "calendar.event",
              [["partner_ids", "in", [partnerId]], ["start", "<", end], ["stop", ">=", start]],
              ["name", "start", "stop", "allday", "location"],
              { limit: 40, order: "start asc" },
            ),
          [] as Row[],
        )
      : Promise.resolve([] as Row[]),
    safe(
      "time off",
      () =>
        odoo.searchRead<Row>(
          "hr.leave",
          [["user_id", "=", uid], ["state", "in", ["confirm", "validate1", "validate"]], ["date_from", "<", end], ["date_to", ">=", start]],
          ["name", "date_from", "date_to", "state"],
          { limit: 10 },
        ),
      [] as Row[],
    ),
  ]);

  const bucket = (t: Row) => {
    const due = typeof t.date_deadline === "string" ? t.date_deadline : null;
    if (!due) return "no_deadline";
    if (due < start) return "overdue";
    if (due < end) return "due_in_period";
    return "upcoming";
  };
  const taskOut = (t: Row) => ({
    id: t.id,
    name: t.name,
    project: m2o(t.project_id) ?? "To-do",
    stage: m2o(t.stage_id),
    priority: t.priority,
    deadline_utc: t.date_deadline || null,
    notes: stripHtml(t.description),
  });
  const grouped: Record<string, ReturnType<typeof taskOut>[]> = { due_in_period: [], overdue: [], no_deadline: [], upcoming: [] };
  for (const t of tasks) grouped[bucket(t)].push(taskOut(t));

  return {
    person: { odoo_user_id: uid, name: user.name, login: user.login },
    period: { from: day, days, timezone: "Africa/Windhoek (UTC+2); datetimes below are UTC" },
    tasks: { ...grouped, upcoming: grouped.upcoming.slice(0, 10) },
    activities: activities.map((x) => ({
      summary: x.summary || m2o(x.activity_type_id),
      type: m2o(x.activity_type_id),
      on: x.res_name,
      due: x.date_deadline,
      overdue: typeof x.date_deadline === "string" && x.date_deadline < day,
      note: stripHtml(x.note, 400),
    })),
    calendar: events.map((e) => ({ name: e.name, start_utc: e.start, stop_utc: e.stop, all_day: e.allday, location: e.location || null })),
    time_off: leaves.map((l) => ({ name: l.name, from_utc: l.date_from, to_utc: l.date_to, state: l.state })),
    ...(notes.length ? { could_not_read: notes } : {}),
  };
}

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
  deps: ToolDeps,
): Promise<string> {
  const a = call.args;
  const db = deps.supabase;

  switch (call.name) {
    case "search_everywhere":
      return clip(await searchEverywhere(deps, String(a.query ?? "")));
    case "odoo_find_models": {
      const q = String(a.query ?? "").trim();
      if (!q) throw new Error("query is required.");
      const rows = await deps.odoo().searchRead<Row>(
        "ir.model",
        ["&", ["transient", "=", false], "|", ["model", "ilike", q], ["name", "ilike", q]],
        ["model", "name"],
        { limit: 40, order: "model asc" },
      );
      return clip({ models: rows.map((r) => ({ model: r.model, name: r.name })) });
    }
    case "website_function": {
      const fn = String(a.function ?? "");
      if (!/^[a-z_][a-z0-9_]*$/.test(fn)) throw new Error("Invalid function name.");
      const { data, error } = await deps.adminDb.rpc(fn, a.args ? asRecord(a.args, "args") : {});
      if (error) throw new Error(error.message);
      if (!WEBSITE_READ_FUNCTIONS.has(fn)) revalidateCatalog();
      return clip({ result: data ?? null });
    }
    case "sync_orders_to_odoo": {
      const since =
        typeof a.since === "string" && /^\d{4}-\d{2}-\d{2}$/.test(a.since)
          ? a.since
          : new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
      const r = await syncOrdersToOdoo(deps.supabase as never, deps.odoo(), {
        apply: true,
        confirm: true,
        since,
        limit: 25,
        timeBudgetMs: 120_000,
      });
      return clip({
        created: r.created.map((c) => c.order),
        already_in_odoo: r.alreadyInOdoo,
        contacts_created: r.contactsCreated,
        needs_review: r.needsReview,
        errors: r.errors,
        stopped_early: r.stoppedEarly,
      });
    }
    case "odoo_person_agenda":
      return clip(await personAgenda(deps.odoo(), a.name, a.date, a.days));
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
