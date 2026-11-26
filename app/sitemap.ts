import type { MetadataRoute } from "next";
import { AUDIENCES, CATEGORIES } from "@/lib/catalog";
import { metaSiteUrl } from "@/lib/meta/site";
import { getCatalogLive } from "@/lib/supabase/catalog";
import { productPath } from "@/lib/utils";
import { isDeliberatelyHidden } from "@/lib/visibility";

export const revalidate = 86400;

const STATIC_PAGES: { path: string; priority: number }[] = [
  { path: "/", priority: 1 },
  { path: "/black-friday", priority: 0.9 },
  { path: "/promotions", priority: 0.8 },
  { path: "/teamwear", priority: 0.8 },
  { path: "/catalog", priority: 0.6 },
  { path: "/store", priority: 0.5 },
  { path: "/about", priority: 0.4 },
  { path: "/returns", priority: 0.3 },
  { path: "/privacy", priority: 0.2 },
  { path: "/terms", priority: 0.2 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = metaSiteUrl();
  const catalog = await getCatalogLive();

  const pages: MetadataRoute.Sitemap = STATIC_PAGES.map(({ path, priority }) => ({
    url: `${site}${path === "/" ? "" : path}`,
    changeFrequency: "weekly",
    priority,
  }));

  const listings: MetadataRoute.Sitemap = [
    ...CATEGORIES.flatMap((c) => [`/category/${c.slug}`, `/shop/${c.slug}`]),
    ...AUDIENCES.map((a) => `/shop/${a.slug}`),
  ].map((path) => ({ url: `${site}${path}`, changeFrequency: "daily", priority: 0.7 }));

  const seen = new Set<string>();
  const products: MetadataRoute.Sitemap = [];
  for (const p of catalog) {
    if (p.available === false || isDeliberatelyHidden(p) || seen.has(p.code)) continue;
    seen.add(p.code);
    products.push({ url: `${site}${productPath(p.code)}`, changeFrequency: "weekly", priority: 0.6 });
  }

  return [...pages, ...listings, ...products];
}
