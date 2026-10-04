import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import raw from "../data/products.json";
import fixData from "../data/b2c-price-fix-data.json";
import mapBData from "../data/b2c-map-b.json";
import { productAudience } from "../lib/audience";
import { applyInferredSurtidoAssortments } from "../lib/assortment";
import { withStorefrontCategories, withStorefrontMerchandising } from "../lib/classify";
import {
  folderKeysForProduct,
  indexCatalogIntoJomaFolders,
  jomaFolderMetaSnapshot,
} from "../lib/joma-tree";
import { listingHay } from "../lib/listing-core";
import type { ListingItem } from "../lib/listing-types";
import { hasUsableProductImage, productCardImageCandidates, withProductImages } from "../lib/media";
import { isAvailable } from "../lib/product-stock";
import { buildTaxonomy, categoryCountsFromTaxonomy } from "../lib/taxonomy";
import type { Product } from "../lib/types";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalogDest = join(root, "data", "products.json");
const folderMapDest = join(root, "data", "product-folders.json");
const folderMetaDest = join(root, "data", "joma-folder-meta.json");
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

function attachListingFields(catalog: Product[]) {
  indexCatalogIntoJomaFolders(catalog);
  for (const product of catalog) {
    const item = product as ListingItem;
    item.audience = productAudience(product);
    item.hasImage = hasUsableProductImage(product);
    item.hay = listingHay(item);
    item.folders = folderKeysForProduct(product);
  }
}

function toListingItem(product: ListingItem): ListingItem {
  const candidates = productCardImageCandidates(product).slice(0, 1);
  const card = candidates[0] || product.imageUrl;
  const sizes = (product.sizes ?? []).filter((s) => s.stock > 0);
  return {
    id: product.id,
    code: product.code,
    item: product.item,
    name: product.name,
    displayName: product.displayName,
    category: product.category,
    ...(product.hubs?.length ? { hubs: product.hubs } : {}),
    ...(product.sellAs ? { sellAs: product.sellAs } : {}),
    ...(product.packSize && product.packSize > 1 ? { packSize: product.packSize } : {}),
    subcategory: product.subcategory,
    gender: product.gender,
    audience: product.audience ?? productAudience(product),
    price: product.price,
    unitPrice: product.unitPrice,
    stockQty: product.stockQty,
    badge: product.badge,
    sizes,
    imageUrl: card,
    images: candidates,
    folders: product.folders ?? [],
    hasImage: true,
  } as ListingItem;
}

function writeFolderMeta() {
  writeFileSync(folderMetaDest, `${JSON.stringify(jomaFolderMetaSnapshot())}\n`);
  console.log(`baked joma folder meta → ${folderMetaDest}`);
}

function writeListingIndex(catalog: Product[]) {
  const listingIndex = catalog.filter(isAvailable).map((p) => toListingItem(p as ListingItem));
  mkdirSync(dirname(listingDest), { recursive: true });
  writeFileSync(listingDest, `${JSON.stringify(listingIndex)}\n`);
  console.log(`baked listing index (${listingIndex.length}) → ${listingDest}`);
}

function writeProductFolders(catalog: Product[]) {
  const map: Record<string, string[]> = {};
  for (const product of catalog) {
    map[product.id] = (product as ListingItem).folders ?? [];
  }
  writeFileSync(folderMapDest, `${JSON.stringify(map)}\n`);
  console.log(`baked product folders (${Object.keys(map).length}) → ${folderMapDest}`);
}

writeFolderMeta();

if (listingOnly || indexesOnly) {
  const classified = withStorefrontCategories((raw as Product[]).map(withProductImages));
  attachListingFields(classified);
  if (indexesOnly) {
    const taxonomy = buildTaxonomy(classified);
    const categoryCounts = categoryCountsFromTaxonomy(taxonomy);
    writeFileSync(navDest, `${JSON.stringify({ taxonomy, categoryCounts })}\n`);
    console.log(`baked storefront nav → ${navDest}`);
  }
  writeProductFolders(classified);
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
attachListingFields(navCatalog);
const taxonomy = buildTaxonomy(navCatalog);
const categoryCounts = categoryCountsFromTaxonomy(taxonomy);
writeFileSync(navDest, `${JSON.stringify({ taxonomy, categoryCounts })}\n`);
console.log(`baked storefront nav → ${navDest}`);
writeProductFolders(navCatalog);
writeListingIndex(navCatalog);
