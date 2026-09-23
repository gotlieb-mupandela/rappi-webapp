"use client";

import type { Product } from "@/lib/types";
import { ProductCard } from "@/components/product-card";
import { useT } from "@/components/locale-provider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { subName } from "@/lib/i18n/labels";
import { SUBCATEGORY_LABELS } from "@/lib/catalog";

const GRID =
  "grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 lg:grid-cols-[repeat(auto-fit,minmax(15.75rem,1fr))]";

export function ProductGrid({
  products,
  grouped = false,
  layout = "grid",
  groupCounts,
}: {
  products: Product[];
  grouped?: boolean;
  layout?: "grid" | "list";
  /** Facet / catalog totals — keep headings aligned with filter counts. */
  groupCounts?: Record<string, number>;
}) {
  const t = useT();
  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-6 py-16 text-center">
        <p className="text-lg font-semibold text-ink">{t("search.noProducts")}</p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {t("search.noProductsBody")}
        </p>
      </div>
    );
  }

  if (!grouped) {
    if (layout === "list") {
      return (
        <div>
          {products.map((p) => (
            <ProductCard key={p.code} product={p} layout="list" />
          ))}
        </div>
      );
    }
    return (
      <div className={GRID}>
        {products.map((p) => (
          <ProductCard key={p.code} product={p} />
        ))}
      </div>
    );
  }

  const groups = new Map<string, Product[]>();
  for (const p of products) {
    const key = p.subcategory;
    const list = groups.get(key) ?? [];
    list.push(p);
    groups.set(key, list);
  }
  const entries = [...groups.entries()];
  const labeled = entries.filter(([sub]) => SUBCATEGORY_LABELS[sub]).length;
  const shouldGroup =
    entries.length > 1 &&
    entries.length <= 8 &&
    labeled >= Math.ceil(entries.length / 2);

  if (!shouldGroup) {
    if (layout === "list") {
      return (
        <div>
          {products.map((p) => (
            <ProductCard key={p.code} product={p} layout="list" />
          ))}
        </div>
      );
    }
    return (
      <div className={GRID}>
        {products.map((p) => (
          <ProductCard key={p.code} product={p} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {entries.length > 1 ? (
        <ScrollArea className="mb-2 w-full border-b border-[var(--border)] pb-3">
          <nav className="flex gap-x-6">
            {entries.map(([sub, list]) => (
              <a
                key={sub}
                href={`#${sub}`}
                className="inline-flex min-h-10 shrink-0 items-center whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)] hover:text-[var(--accent)]"
              >
                {subName(sub, t)} [{groupCounts?.[sub] ?? list.length}]
              </a>
            ))}
          </nav>
        </ScrollArea>
      ) : null}
      {entries.map(([sub, list]) => (
        <section key={sub} id={sub}>
          <div className="mb-6">
            <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-ink">
              {subName(sub, t)} [{groupCounts?.[sub] ?? list.length}]
            </h2>
          </div>
          {layout === "list" ? (
            <div>
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
          )}
        </section>
      ))}
    </div>
  );
}
