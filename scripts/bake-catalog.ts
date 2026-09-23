import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import raw from "../data/products.json";
import { productAudience } from "../lib/audience";
import { withStorefrontCategories, withStorefrontMerchandising } from "../lib/classify";
import { productCardImageCandidates, withProductImages } from "../lib/media";
import { buildTaxonomy, categoryCountsFromTaxonomy } from "../lib/taxonomy";
import type { ListingItem } from "../lib/listing-types";
import type { Product } from "../lib/types";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalogDest = join(root, "data", "products.json");
const navDest = join(root, "data", "storefront-nav.json");
const listingDest = join(root, "public", "listing-index.json");
const listingOnly = process.argv.includes("--listing-only");

function toListingItem(product: Product): ListingItem {
  const candidates = productCardImageCandidates(product).slice(0, 3);
  const card = candidates[0] || product.imageUrl;
  const sizes = (product.sizes ?? []).filter((s) => s.stock > 0);
  return {
    id: product.id,
    code: product.code,
    item: product.item,
    title: product.title,
    name: product.name,
    displayName: product.displayName,
    category: product.category,
    ...(product.hubs?.length ? { hubs: product.hubs } : {}),
    subcategory: product.subcategory,
    gender: product.gender,
    audience: productAudience(product),
    price: product.price,
    unitPrice: product.unitPrice,
    currency: product.currency ?? "NAD",
    sheetCategory: product.sheetCategory ?? null,
    totalQty: product.totalQty,
    stockQty: product.stockQty,
    badge: product.badge,
    sizeOptions: product.sizeOptions ?? sizes.map((s) => s.size),
    sizes,
    imageUrl: card,
    images: candidates,
  } as ListingItem;
}

function writeListingIndex(catalog: Product[]) {
  const listingIndex = catalog.map(toListingItem);
  mkdirSync(dirname(listingDest), { recursive: true });
  writeFileSync(listingDest, `${JSON.stringify(listingIndex)}\n`);
  console.log(`baked listing index (${listingIndex.length}) → ${listingDest}`);
}

if (listingOnly) {
  writeListingIndex(withStorefrontCategories((raw as Product[]).map(withProductImages)));
  process.exit(0);
}

const baked = (raw as Product[]).map((product) => {
  const next = withStorefrontMerchandising(product);
  return {
    ...product,
    price: next.price,
    unitPrice: next.unitPrice,
    imageUrl: next.imageUrl,
    images: next.images,
    description: next.description,
    title: next.title,
    displayName: next.displayName,
    category: next.category,
    subcategory: next.subcategory,
    ...(next.hubs?.length ? { hubs: next.hubs } : {}),
  };
});

writeFileSync(catalogDest, `${JSON.stringify(baked)}\n`);
console.log(`baked ${baked.length} products → ${catalogDest}`);

const navCatalog = withStorefrontCategories((baked as Product[]).map(withProductImages));
const taxonomy = buildTaxonomy(navCatalog);
const categoryCounts = categoryCountsFromTaxonomy(taxonomy);
writeFileSync(navDest, `${JSON.stringify({ taxonomy, categoryCounts })}\n`);
console.log(`baked storefront nav → ${navDest}`);
writeListingIndex(navCatalog);
