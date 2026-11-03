export type JomaSizeStock = { size: string; stock: number };

export type JomaExportRow = {
  code?: unknown;
  sku?: unknown;
  ref?: unknown;
  qty?: unknown;
  stock?: unknown;
  stockQty?: unknown;
  available?: unknown;
  sizes?: unknown;
  size_run?: unknown;
  sizeOptions?: unknown;
};

export type JomaParsedRow = {
  code: string;
  qty: number | null;
  available?: boolean;
  sizes: string[];
  perSize: Record<string, number> | null;
};

export type JomaSyncLine = {
  code: string;
  available?: boolean;
  sizes: JomaSizeStock[];
};

export function parseSizes(value: unknown): {
  sizes: string[];
  perSize: Record<string, number> | null;
} {
  if (!value) return { sizes: [], perSize: null };
  if (Array.isArray(value)) {
    if (value.length && typeof value[0] === "object" && value[0] && "size" in value[0]) {
      const perSize: Record<string, number> = {};
      const sizes: string[] = [];
      for (const row of value as Array<{ size?: unknown; name?: unknown; stock?: unknown; qty?: unknown }>) {
        const size = String(row.size ?? row.name ?? "").trim();
        if (!size) continue;
        sizes.push(size);
        const n = Number(row.stock ?? row.qty);
        if (Number.isFinite(n)) perSize[size] = Math.max(0, n);
      }
      return { sizes, perSize: Object.keys(perSize).length ? perSize : null };
    }
    return {
      sizes: value.map(String).map((s) => s.trim()).filter(Boolean),
      perSize: null,
    };
  }
  const sizes = String(value)
    .split(/[\/|,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return { sizes, perSize: null };
}

export function parseJomaExport(input: unknown): JomaParsedRow[] {
  const rows = Array.isArray(input)
    ? input
    : input && typeof input === "object"
      ? ((input as { products?: unknown; items?: unknown }).products ??
          (input as { items?: unknown }).items ??
          [])
      : [];
  if (!Array.isArray(rows)) return [];

  const out: JomaParsedRow[] = [];
  for (const raw of rows as JomaExportRow[]) {
    const code = String(raw.code || raw.sku || raw.ref || "").trim();
    if (!code) continue;
    const { sizes, perSize } = parseSizes(raw.sizes || raw.size_run || raw.sizeOptions);
    const qtyRaw = Number(raw.qty ?? raw.stock ?? raw.stockQty);
    const qty = Number.isFinite(qtyRaw) ? Math.max(0, qtyRaw) : null;
    const available = typeof raw.available === "boolean" ? raw.available : undefined;
    out.push({ code, qty, available, sizes, perSize });
  }
  return out;
}

export function previewJomaSync(
  parsed: JomaParsedRow[],
  knownCodes: Set<string>,
): { matched: JomaSyncLine[]; unmatched: string[] } {
  const unmatched: string[] = [];
  const matched: JomaSyncLine[] = [];
  const seen = new Set<string>();

  for (const row of parsed) {
    if (!knownCodes.has(row.code)) {
      if (!unmatched.includes(row.code)) unmatched.push(row.code);
      continue;
    }
    if (seen.has(row.code)) continue;
    seen.add(row.code);

    const sizes: JomaSizeStock[] = row.sizes.length
      ? row.sizes.map((size) => ({
          size,
          stock:
            row.available === false
              ? 0
              : row.perSize && row.perSize[size] != null
                ? row.perSize[size]
                : row.qty ?? 0,
        }))
      : row.qty != null
        ? [{ size: "ONE", stock: row.available === false ? 0 : row.qty }]
        : [];

    matched.push({
      code: row.code,
      ...(row.available === undefined ? {} : { available: row.available }),
      sizes,
    });
  }

  return { matched, unmatched };
}
