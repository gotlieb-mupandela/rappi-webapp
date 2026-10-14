import { FolderTabs } from "@/components/folder-tabs";
import { ProductGrid } from "@/components/product-grid";
import { tabSlug, type FolderTab } from "@/lib/folder-tabs";
import type { Product } from "@/lib/types";

/**
 * Joma portal folder page: tab strip (All + portal tabs). "All" shows every tab
 * as a section with the portal heading (e.g. JACKET); a tab shows its products only,
 * always in portal order.
 */
export function TabbedFolderProducts({
  products,
  tabs,
  activeTab,
  hrefFor,
}: {
  products: Product[];
  tabs: FolderTab[];
  activeTab: string;
  hrefFor: (slug: string) => string;
}) {
  const byCode = new Map(products.map((p) => [p.code, p]));
  const sections = tabs
    .map((t) => ({
      tab: t,
      slug: tabSlug(t.label),
      items: t.codes.map((c) => byCode.get(c)).filter((p): p is Product => Boolean(p)),
    }))
    .filter((s) => s.items.length);
  const active = sections.find((s) => s.slug === activeTab);
  return (
    <div>
      {sections.length > 1 ? (
        <FolderTabs
          tabs={sections.map((s) => s.tab)}
          active={active ? activeTab : ""}
          allLabel="All"
          hrefFor={hrefFor}
        />
      ) : null}
      {active ? (
        <ProductGrid products={active.items} />
      ) : (
        sections.map((s) => (
          <section key={s.slug} className="mb-10">
            <h2 className="mb-4 border-b border-[var(--border)] pb-2 text-sm font-bold uppercase tracking-[0.12em] text-[var(--text)]">
              {s.tab.label}
            </h2>
            <ProductGrid products={s.items} />
          </section>
        ))
      )}
    </div>
  );
}

/** Count shown in the page header for a tabbed folder. */
export function tabbedCount(products: Product[], tabs: FolderTab[], activeTab: string) {
  const codes = new Set(products.map((p) => p.code));
  const tab = tabs.find((t) => tabSlug(t.label) === activeTab);
  const list = tab ? tab.codes : [...new Set(tabs.flatMap((t) => t.codes))];
  return list.filter((c) => codes.has(c)).length;
}
