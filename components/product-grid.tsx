"use client";

import type { Product } from "@/lib/types";
import { ProductCard } from "@/components/product-card";
import { useT } from "@/components/locale-provider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { subName } from "@/lib/i18n/labels";
import { SUBCATEGORY_LABELS, subcategoryChipRank } from "@/lib/catalog";
import { itemFamilyOf } from "@/lib/joma-tree";
import { cn } from "@/lib/utils";

/** Dense Joma-style catalog grid — up to ~5 columns on wide screens. */
const GRID =
  "grid grid-cols-2 gap-x-3 gap-y-10 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4 lg:grid-cols-5 xl:gap-x-5 [&>*]:relative";

const COLOR_STOP =
  /^(dark|light|neon|navy|black|white|red|blue|green|grey|gray|orange|yellow|pink|purple|beige|brown|soft|shell|polar|fleece|jacket|anorak|man|woman|junior|ii|iii|iv|v|vi|vii|viii)$/i;

function collectionLineOf(product: Product) {
  const fam = itemFamilyOf(product);
  if (!fam) return "general";
  const tokens = fam.split(/\s+/).filter(Boolean);
  if (!tokens.length) return "general";
  const out: string[] = [tokens[0]];
  if (tokens[1] && !COLOR_STOP.test(tokens[1])) out.push(tokens[1]);
  return out.join(" ");
}

function collectionLabel(key: string) {
  return key.replace(/\b\w/g, (c) => c.toUpperCase());
}

type Section = { key: string; display: string; list: Product[]; count: number };

function sectionsFor(
  products: Product[],
  t: ReturnType<typeof useT>,
  groupCounts?: Record<string, number>,
): Section[] {
  const bySub = new Map<string, Product[]>();
  for (const p of products) {
    const key = p.subcategory || "general";
    const list = bySub.get(key) ?? [];
    list.push(p);
    bySub.set(key, list);
  }
  const subEntries = [...bySub.entries()].sort(
    (a, b) => subcategoryChipRank(a[0]) - subcategoryChipRank(b[0]) || a[0].localeCompare(b[0]),
  );
  const labeled = subEntries.filter(([sub]) => SUBCATEGORY_LABELS[sub]).length;
  if (
    subEntries.length > 1 &&
    subEntries.length <= 8 &&
    labeled >= Math.ceil(subEntries.length / 2)
  ) {
    return subEntries.map(([key, list]) => ({
      key,
      display: subName(key, t),
      list,
      count: groupCounts?.[key] ?? list.length,
    }));
  }

  const byLine = new Map<string, Product[]>();
  for (const p of products) {
    const key = collectionLineOf(p);
    const list = byLine.get(key) ?? [];
    list.push(p);
    byLine.set(key, list);
  }
  const lineEntries = [...byLine.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  if (lineEntries.length > 1 && lineEntries.length <= 14) {
    return lineEntries.map(([key, list]) => ({
      key: `line-${key.replace(/\s+/g, "-")}`,
      display: collectionLabel(key),
      list,
      count: list.length,
    }));
  }

  return [];
}

export function ProductGrid({
  products,
  grouped = false,
  layout = "grid",
  groupCounts,
}: {
  products: Product[];
  grouped?: boolean;
  layout?: "grid" | "list";
  groupCounts?: Record<string, number>;
}) {
  const t = useT();
  if (products.length === 0) {
    return (
      <div className="border border-[var(--border)] bg-[var(--bg-elevated)] px-6 py-20 text-center">
        <p className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-wide text-ink">
          {t("search.noProducts")}
        </p>
        <p className="mx-auto mt-3 max-w-sm text-sm text-[var(--muted)]">
          {t("search.noProductsBody")}
        </p>
      </div>
    );
  }

  const flat = (list: Product[]) =>
    layout === "list" ? (
      <div className="divide-y divide-[var(--border)] border border-[var(--border)] bg-white px-4 sm:px-5">
        {list.map((p) => (
          <ProductCard key={p.code} product={p} layout="list" />
        ))}
      </div>
    ) : (
      <div className={GRID}>
        {list.map((p) => (
          <ProductCard key={p.code} product={p} />
        ))}
      </div>
    );

  if (!grouped) return flat(products);

  const entries = sectionsFor(products, t, groupCounts);
  if (!entries.length) return flat(products);

  return (
    <div className="space-y-10 sm:space-y-12">
      {entries.length > 1 ? (
        <ScrollArea className="w-full">
          <nav
            aria-label={t("filters.type")}
            className="flex gap-x-5 border-b border-[var(--border)] sm:gap-x-7"
          >
            {entries.map((e) => (
              <a
                key={e.key}
                href={`#${e.key}`}
                className={cn(
                  "relative shrink-0 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)] transition-colors duration-200",
                  "hover:text-[var(--accent)]",
                  "after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:origin-left after:scale-x-0 after:bg-[var(--accent)] after:transition-transform after:duration-300 after:ease-[cubic-bezier(0.16,1,0.3,1)]",
                  "hover:after:scale-x-100",
                )}
              >
                {e.display}
              </a>
            ))}
          </nav>
        </ScrollArea>
      ) : null}
      {entries.map((e) => (
        <section key={e.key} id={e.key} className="scroll-mt-28">
          <header className="relative mb-5 sm:mb-6">
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[var(--accent)]" />
            <h2 className="relative inline-block bg-white pr-3 text-sm font-bold uppercase tracking-[0.06em] text-[var(--accent)] sm:text-base">
              {e.display}
            </h2>
          </header>
          {flat(e.list)}
        </section>
      ))}
    </div>
  );
}
