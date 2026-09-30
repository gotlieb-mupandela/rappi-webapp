import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import raw from "../data/products.json";
import fixData from "../data/b2c-price-fix-data.json";
import mapBData from "../data/b2c-map-b.json";
import { productAudience } from "../lib/audience";
import { applyInferredSurtidoAssortments } from "../lib/assortment";
import { withStorefrontCategories, withStorefrontMerchandising } from "../lib/classify";
import { productCardImageCandidates, withProductImages } from "../lib/media";
import { isAvailable } from "../lib/product-stock";
import { buildTaxonomy, categoryCountsFromTaxonomy } from "../lib/taxonomy";
import type { ListingItem } from "../lib/listing-types";
import type { Product } from "../lib/types";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalogDest = join(root, "data", "products.json");
const navDest = join(root, "data", "storefront-nav.json");
const listingDest = join(root, "public", "listing-index.json");
const listingOnly = process.argv.includes("--listing-only");
const indexesOnly = process.argv.includes("--indexes-only");

/**
 * Pack-policy enforcement. data/b2c-price-fix-data.json + data/b2c-map-b.json
 * are the audited sources of truth for pack NAD and hidden packs. The daily
 * stock sync manages `available` by stock level (and could drift prices), so
 * every bake re-pins policy prices and re-hides policy packs first — the
 * guardrail (scripts/check-pack-prices.mjs) asserts the same afterwards.
 */
function enforcePackPolicy(catalog: Product[]) {
  const fix = fixData as {
    pack_price_overrides?: Array<{ code: string; pack_nad: number }>;
    hidden_packs?: Array<{ code: string }>;
  };
  const mapB = mapBData as { prices?: Record<string, number> };
  const priceByCode = new Map<string, number>();
  for (const o of fix.pack_price_overrides ?? []) priceByCode.set(o.code, o.pack_nad);
  for (const [code, nad] of Object.entries(mapB.prices ?? {})) priceByCode.set(code, nad);
  const hidden = new Set((fix.hidden_packs ?? []).map((s) => s.code));
  let pinned = 0;
  let rehidden = 0;
  for (const p of catalog) {
    const nad = priceByCode.get(p.code);
    if (nad !== undefined && Number.isInteger(nad) && (p.price !== nad || p.unitPrice !== nad)) {
      p.price = nad;
      p.unitPrice = nad;
      pinned++;
    }
    if (hidden.has(p.code) && p.available !== false) {
      p.available = false;
      rehidden++;
    }
  }
  if (pinned || rehidden) {
    console.log(`pack policy enforced (prices pinned: ${pinned}, re-hidden: ${rehidden})`);
  }
}

enforcePackPolicy(raw as Product[]);
const surtidoLabeled = applyInferredSurtidoAssortments(raw as Product[]);
if (surtidoLabeled) console.log(`surtido assortments labeled: ${surtidoLabeled}`);

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
    ...(product.sellAs ? { sellAs: product.sellAs } : {}),
    ...(product.packSize && product.packSize > 1 ? { packSize: product.packSize } : {}),
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
  const listingIndex = catalog.filter(isAvailable).map(toListingItem);
  mkdirSync(dirname(listingDest), { recursive: true });
  writeFileSync(listingDest, `${JSON.stringify(listingIndex)}\n`);
  console.log(`baked listing index (${listingIndex.length}) → ${listingDest}`);
}

if (listingOnly || indexesOnly) {
  const classified = withStorefrontCategories((raw as Product[]).map(withProductImages)).filter(
    isAvailable,
  );
  if (indexesOnly) {
    const taxonomy = buildTaxonomy(classified);
    const categoryCounts = categoryCountsFromTaxonomy(taxonomy);
    writeFileSync(navDest, `${JSON.stringify({ taxonomy, categoryCounts })}\n`);
    console.log(`baked storefront nav → ${navDest}`);
  }
  writeListingIndex(classified);
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
