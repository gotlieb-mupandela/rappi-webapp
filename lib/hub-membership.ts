import type { Product } from "@/lib/types";
import leaves from "@/data/joma-hub-leaves.json";

/** Sport / campaign hubs — kit, footwear, and equipment for that sport all belong here. */
export const SPORT_HUBS = [
  "football",
  "rugby",
  "basketball",
  "netball",
  "swimming",
  "cricket",
  "boxing",
  "hockey",
  "running-fitness",
  "padel",
  "hiking",
  "resort",
  "lifestyle",
  "brama",
  "teampro-2026",
] as const;

/** Type hubs — the same SKU can also live here when it is a shoe, ball/bag, or apparel piece. */
export const TYPE_HUBS = ["sportswear", "shoes", "balls-bags"] as const;

/** Joma B2B leaf SKU → storefront sport hub. Other sports can be added the same way. */
const CODE_TO_HUB = new Map<string, string>();
for (const [hub, codes] of Object.entries(leaves as Record<string, string[]>)) {
  for (const code of codes) CODE_TO_HUB.set(code, hub);
}

export function jomaLeafHub(code: string): string | undefined {
  return CODE_TO_HUB.get(code);
}

export function jomaLeafCodes(hub: string): string[] {
  return (leaves as Record<string, string[]>)[hub] ?? [];
}

/** Every hub this SKU should appear on (primary category first). */
export function productHubs(product: Product): string[] {
  const extra = product.hubs ?? [];
  const out = [product.category];
  for (const h of extra) {
    if (h && h !== product.category && !out.includes(h)) out.push(h);
  }
  return out;
}

export function productInHub(product: Product, slug: string) {
  return productHubs(product).includes(slug);
}

export function isSportHub(slug: string) {
  return (SPORT_HUBS as readonly string[]).includes(slug);
}
