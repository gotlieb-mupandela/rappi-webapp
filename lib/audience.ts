import {
  WOMEN_CODED_TYPE_FOLDERS,
  typeFolderForSubcategory,
  type AudienceSlug,
} from "@/lib/catalog";
import type { Product } from "@/lib/types";

const KIDS_NAME_RE = /\b(junior| jr\b|kids|child|baby|youth|teen)\b/;
const WOMEN_NAME_RE = /\b(lady|ladies|women|woman|female|womens)\b/;
const MEN_NAME_RE = /\b(men|man|male|mens)\b/;

export type ListingAudience = AudienceSlug | "unisex";

export function isKidsShoe(product: Product) {
  if (product.gender === "kids") return true;
  if (product.subcategory === "kids-shoes" || product.subcategory === "tees-kids") return true;
  if (/^J[A-Z]/i.test(product.code)) return true;
  const blob = `${product.displayName} ${product.name} ${product.item}`.toLowerCase();
  if (KIDS_NAME_RE.test(blob)) return true;
  const nums = product.sizeOptions
    .map((s) => Number.parseFloat(s))
    .filter((n) => Number.isFinite(n));
  return nums.length > 0 && Math.max(...nums) <= 35;
}

export function isKidsProduct(product: Product) {
  if (product.gender === "kids") return true;
  if (
    product.subcategory === "tees-kids" ||
    product.subcategory === "jackets-kids" ||
    product.subcategory === "kids-shoes"
  ) {
    return true;
  }
  const blob = `${product.displayName} ${product.name} ${product.item}`.toLowerCase();
  if (KIDS_NAME_RE.test(blob)) return true;
  if (product.category === "shoes") return isKidsShoe(product);
  return false;
}

export function productAudience(product: Product): ListingAudience {
  if (isKidsProduct(product)) return "kids";
  const blob = `${product.displayName} ${product.name} ${product.item} ${product.title}`.toLowerCase();
  if (product.gender === "women" || WOMEN_NAME_RE.test(blob)) return "women";
  if (product.gender === "men" || MEN_NAME_RE.test(blob)) return "men";
  return "unisex";
}

function isWomenCodedFolderProduct(product: Product) {
  return WOMEN_CODED_TYPE_FOLDERS.has(typeFolderForSubcategory(product.subcategory));
}

export function matchesAudience(
  product: Product & { audience?: ListingAudience },
  audience: string | null,
) {
  if (!audience || audience === "all") return true;
  const resolved = product.audience ?? productAudience(product);
  if (audience === "kids") return resolved === "kids";
  if (audience === "women") return resolved === "women";
  if (audience === "men") {
    if (resolved === "men") return true;
    // Most adult kit is ungendered; treat it as men's unless it is a women-coded family.
    return resolved === "unisex" && !isWomenCodedFolderProduct(product);
  }
  if (audience === "adult") return resolved !== "kids";
  return true;
}
