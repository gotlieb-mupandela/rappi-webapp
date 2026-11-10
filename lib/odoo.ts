import "server-only";

/**
 * Server-only client for Odoo's External JSON-2 API.
 *
 *   POST {ODOO_URL}/json/2/<model>/<method>
 *   Authorization: bearer <ODOO_API_KEY>
 *   X-Odoo-Database: <ODOO_DB>   (optional on Odoo Online)
 *
 * Arguments are passed by name in the JSON body (`ids`, `domain`, `fields`,
 * `vals_list`, `vals`, `context`, ...). Each call is its own transaction.
 *
 * The API key is read from the environment only. It is never logged, never
 * included in error messages, and must never be given a NEXT_PUBLIC_ prefix.
 */

export type OdooConfig = {
  url: string;
  db?: string;
  apiKey: string;
};

export type OdooDomain = unknown[];

type EnvLike = Record<string, string | undefined>;

export class OdooConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OdooConfigError";
  }
}

export class OdooApiError extends Error {
  readonly status: number;
  readonly odooName?: string;
  readonly model: string;
  readonly method: string;

  constructor(opts: { status: number; model: string; method: string; message: string; odooName?: string }) {
    super(`Odoo ${opts.model}.${opts.method} failed (${opts.status}): ${opts.message}`);
    this.name = "OdooApiError";
    this.status = opts.status;
    this.odooName = opts.odooName;
    this.model = opts.model;
    this.method = opts.method;
  }
}

/** Reads ODOO_URL / ODOO_DB / ODOO_API_KEY. Throws a clear error when missing. */
export function odooConfigFromEnv(env: EnvLike = process.env): OdooConfig {
  const rawUrl = env.ODOO_URL?.trim();
  const apiKey = env.ODOO_API_KEY?.trim();
  const db = env.ODOO_DB?.trim() || undefined;

  const missing = [!rawUrl && "ODOO_URL", !apiKey && "ODOO_API_KEY"].filter(Boolean);
  if (missing.length) {
    throw new OdooConfigError(`Missing environment variable(s): ${missing.join(", ")}`);
  }

  let url: URL;
  try {
    url = new URL(rawUrl!);
  } catch {
    throw new OdooConfigError("ODOO_URL is not a valid URL");
  }
  if (url.protocol !== "https:") {
    throw new OdooConfigError("ODOO_URL must use https");
  }

  return { url: url.origin, db, apiKey: apiKey! };
}

/** Remove the key from any text before it is shown or thrown. */
function redact(text: string, apiKey: string) {
  return apiKey ? text.split(apiKey).join("[redacted]") : text;
}

export type OdooClient = ReturnType<typeof createOdooClient>;

export function createOdooClient(
  config: OdooConfig = odooConfigFromEnv(),
  opts: { timeoutMs?: number; retries?: number; userAgent?: string } = {},
) {
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const retries = opts.retries ?? 3;
  const userAgent = opts.userAgent ?? "rappi-webapp-odoo-sync/1.0";

  async function call<T = unknown>(model: string, method: string, body: Record<string, unknown> = {}): Promise<T> {
    const endpoint = `${config.url}/json/2/${encodeURIComponent(model)}/${encodeURIComponent(method)}`;
    const headers: Record<string, string> = {
      Authorization: `bearer ${config.apiKey}`,
      "Content-Type": "application/json; charset=utf-8",
      "User-Agent": userAgent,
    };
    if (config.db) headers["X-Odoo-Database"] = config.db;

    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      let res: Response;
      try {
        res = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        // Network error or timeout: retry.
        lastError = new OdooApiError({
          status: 0,
          model,
          method,
          message: redact(error instanceof Error ? error.message : String(error), config.apiKey),
        });
        continue;
      }

      const text = await res.text();
      if (res.ok) {
        return (text ? JSON.parse(text) : null) as T;
      }

      let message = text.slice(0, 500);
      let odooName: string | undefined;
      try {
        const parsed = JSON.parse(text) as { name?: string; message?: string };
        message = parsed.message ?? message;
        odooName = parsed.name;
      } catch {
        // Non-JSON error body (HTML error page, proxy error).
      }
      lastError = new OdooApiError({
        status: res.status,
        model,
        method,
        message: redact(message, config.apiKey),
        odooName,
      });
      // Retry only on rate limiting and server-side errors.
      if (res.status !== 429 && res.status < 500) break;
    }
    throw lastError;
  }

  return {
    call,
    searchRead<T = Record<string, unknown>>(
      model: string,
      domain: OdooDomain,
      fields: string[],
      extra: { limit?: number; offset?: number; order?: string; context?: Record<string, unknown> } = {},
    ) {
      return call<T[]>(model, "search_read", { domain, fields, ...extra });
    },
    create(model: string, valsList: Record<string, unknown>[], context?: Record<string, unknown>) {
      return call<number[]>(model, "create", { vals_list: valsList, ...(context ? { context } : {}) });
    },
    write(model: string, ids: number[], vals: Record<string, unknown>, context?: Record<string, unknown>) {
      return call<boolean>(model, "write", { ids, vals, ...(context ? { context } : {}) });
    },
    read<T = Record<string, unknown>>(model: string, ids: number[], fields: string[]) {
      return call<T[]>(model, "read", { ids, fields });
    },
    fieldsGet(model: string) {
      return call<Record<string, { type: string; string: string }>>(model, "fields_get", {
        attributes: ["type", "string"],
      });
    },
  };
}
