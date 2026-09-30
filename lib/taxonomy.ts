import { CATEGORIES, SUBCATEGORY_LABELS, subcategoryChipRank } from "@/lib/catalog";
import type { StorefrontTaxonomy } from "@/lib/listing-types";
import { productInHub } from "@/lib/hub-membership";
import type { Product } from "@/lib/types";

export function buildTaxonomy(catalog: Product[]): StorefrontTaxonomy {
  const out: StorefrontTaxonomy = {};
  for (const c of CATEGORIES) {
    const items = catalog.filter((p) => productInHub(p, c.slug));
    const counts = new Map<string, number>();
    for (const p of items) counts.set(p.subcategory, (counts.get(p.subcategory) ?? 0) + 1);
    out[c.slug] = [...counts.entries()]
      .map(([slug, count]) => ({
        slug,
        name: SUBCATEGORY_LABELS[slug] ?? slug,
        count,
      }))
      .sort(
        (a, b) =>
          subcategoryChipRank(a.slug) - subcategoryChipRank(b.slug) ||
          a.name.localeCompare(b.name),
      );
  }
  return out;
}

export function categoryCountsFromTaxonomy(taxonomy: StorefrontTaxonomy) {
  return Object.fromEntries(
    CATEGORIES.map((c) => [
      c.slug,
      (taxonomy[c.slug] ?? []).reduce((sum, s) => sum + s.count, 0),
    ]),
  ) as Record<string, number>;
}
