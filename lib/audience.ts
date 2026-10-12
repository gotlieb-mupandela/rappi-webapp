import {
  WOMEN_CODED_TYPE_FOLDERS,
  typeFolderForSubcategory,
  type AudienceSlug,
} from "@/lib/catalog";
import { isJomaBrowseFolder } from "@/lib/joma-folder-meta";
import type { Product } from "@/lib/types";

const KIDS_NAME_RE = /\b(junior| jr\b|kids|child|baby|youth|teen)\b/;

/**
 * Kids apparel packs whose import row is unisex. They belong on the kids
 * cotton-trousers folder; the name does not say junior, so the heuristic
 * would hide them from that shop.
 */
const KIDS_PACK_CODES = new Set(["500480.322", "500680.579", "500680.715"]);
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
  if (KIDS_PACK_CODES.has(product.code)) return true;
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

/**
 * Folder pages show the supplier list for that menu node.
 * A gender filter must not drop a product the supplier filed there:
 * Woman nodes that reuse a Man key, swim briefs on Swimming, kids anoraks
 * on the man outerwear leaf.
 */
export function matchesAudienceInFolder(
  product: Product & { audience?: ListingAudience },
  audience: string | null,
  folderKey?: string | null,
) {
  if (folderKey && isJomaBrowseFolder(folderKey)) return true;
  return matchesAudience(product, audience);
}
