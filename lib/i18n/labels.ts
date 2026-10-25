import { AUDIENCES, CATEGORIES, SUBCATEGORY_LABELS } from "@/lib/catalog";
import { SHIPPING_METHODS } from "@/lib/shipping";
import type { TFunction } from "@/lib/i18n/translate";

export function hubName(slug: string, t: TFunction) {
  const translated = t(`hub.${slug}.name`);
  if (!translated.startsWith("hub.")) return translated;
  return CATEGORIES.find((c) => c.slug === slug)?.name ?? slug;
}

export function hubNav(slug: string, t: TFunction) {
  const translated = t(`hub.${slug}.nav`);
  if (!translated.startsWith("hub.")) return translated;
  const cat = CATEGORIES.find((c) => c.slug === slug);
  return cat?.nav ?? cat?.name ?? slug;
}

export function hubBlurb(slug: string, t: TFunction) {
  const translated = t(`hub.${slug}.blurb`);
  if (!translated.startsWith("hub.")) return translated;
  return CATEGORIES.find((c) => c.slug === slug)?.blurb ?? "";
}

export function audienceName(slug: string, t: TFunction) {
  const translated = t(`audience.${slug}.name`);
  if (!translated.startsWith("audience.")) return translated;
  return AUDIENCES.find((a) => a.slug === slug)?.name ?? slug;
}

export function audienceBlurb(slug: string, t: TFunction) {
  const translated = t(`audience.${slug}.blurb`);
  if (!translated.startsWith("audience.")) return translated;
  return AUDIENCES.find((a) => a.slug === slug)?.blurb ?? "";
}

export function subName(slug: string, t: TFunction) {
  const translated = t(`sub.${slug}`);
  if (translated !== `sub.${slug}`) return translated;
  for (const kind of ["apparel", "footwear", "kids"] as const) {
    const g = t(`group.${kind}.${slug}`);
    if (!g.startsWith("group.")) return g;
  }
  return SUBCATEGORY_LABELS[slug] ?? slug;
}

export function shippingName(id: string, fallback: string, t: TFunction) {
  const translated = t(`shipping.${id}`);
  return translated === `shipping.${id}` ? fallback : translated;
}

export function translateStoredShipping(label: string, t: TFunction) {
  const row = SHIPPING_METHODS.find((m) => m.id === label || m.name === label);
  if (row) return shippingName(row.id, row.name, t);
  return label;
}

export function groupName(
  kind: "shoes" | "kids" | "rugby" | "brama" | "footwear" | "apparel",
  key: string,
  t: TFunction,
) {
  const translated = t(`group.${kind}.${key}`);
  return translated.startsWith("group.") ? key : translated;
}
