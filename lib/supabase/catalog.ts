import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { productAudience } from "@/lib/audience";
import { mapStorefrontRow, type StorefrontCatalogRow } from "@/lib/catalog-map";
import { hasUsableProductImage } from "@/lib/classify";
import { listingHay, type ListingItem } from "@/lib/listing-core";
import { withProductImages } from "@/lib/media";
import { buildTaxonomy, categoryCountsFromTaxonomy } from "@/lib/taxonomy";
import { DPO_TEST_CODE, dpoTestProduct, isDpoTestCheckoutEnabled } from "@/lib/dpo-test-product";
import { indexCatalogFromBakedFolders, matchJomaFolderKeys } from "@/lib/joma-tree";
import bakedFolders from "@/data/product-folders.json";
import {
  getOfflineCatalog,
  offlineCatalog,
  productsByCategory,
  productsByCode,
} from "@/lib/offline-catalog";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { shippingMethodsSnapshot } from "@/lib/shipping";
import type { Database } from "@/lib/database.types";
import type { Product } from "@/lib/types";

const BAKED_FOLDERS = bakedFolders as Record<string, string[]>;
const FULL_ROW_CHUNK = 200;
const MIN_LIVE_ROWS = 1000;

function createPublicClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

function finalizeLiveProduct(product: Product): Product {
  const next = withProductImages(product);
  const item = next as ListingItem;
  item.hay = listingHay(item);
  item.audience = productAudience(next);
  item.hasImage = hasUsableProductImage(next);
  return next;
}

/** [code, price, available, stock_qty, "S:3|M:0", content_changed] from storefront_overlay(). */
type OverlayRow = [string, number | null, boolean | null, number | null, string, boolean];

type LiveSnapshot = { overlay: OverlayRow[]; changed: StorefrontCatalogRow[] };

/**
 * Live data small enough for the 2 MB data cache (~0.8 MB): price, stock, sizes and
 * visibility for every product, plus full rows only for products edited after the
 * bake or missing from it. Titles, images and folders come from the baked catalog.
 */
async function fetchLiveSnapshot(): Promise<LiveSnapshot | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createPublicClient();
  let { data, error } = await supabase.rpc("storefront_overlay");
  if (error) ({ data, error } = await supabase.rpc("storefront_overlay"));
  if (error) throw new Error(error.message);
  const overlay = (Array.isArray(data) ? data : []) as OverlayRow[];
  if (overlay.length < Math.min(offlineCatalog.length, MIN_LIVE_ROWS)) return null;

  const fullCodes = overlay
    .filter(([code, , , , , changed]) => code !== DPO_TEST_CODE && (changed || !productsByCode.has(code)))
    .map(([code]) => code);
  const changed: StorefrontCatalogRow[] = [];
  for (let i = 0; i < fullCodes.length; i += FULL_ROW_CHUNK) {
    const { data: rows, error: rowsError } = await supabase
      .from("storefront_catalog")
      .select("*")
      .in("code", fullCodes.slice(i, i + FULL_ROW_CHUNK));
    if (rowsError) throw new Error(rowsError.message);
    changed.push(...((rows ?? []) as StorefrontCatalogRow[]));
  }
  return { overlay, changed };
}

const getCachedLiveSnapshot = unstable_cache(
  async () => fetchLiveSnapshot(),
  ["storefront-overlay-v1"],
  { revalidate: 3600, tags: ["catalog"] },
);

function parseOverlaySizes(packed: string, order: string[]): Product["sizes"] {
  if (!packed) return [];
  const rank = new Map(order.map((size, i) => [size, i]));
  return packed
    .split("|")
    .map((part) => {
      const at = part.lastIndexOf(":");
      return { size: part.slice(0, at), stock: Math.max(0, Number(part.slice(at + 1)) || 0) };
    })
    .sort(
      (a, b) =>
        (rank.get(a.size) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.size) ?? Number.MAX_SAFE_INTEGER),
    );
}

function applyOverlay(base: Product, row: OverlayRow): Product {
  const [, rawPrice, rawAvailable, rawStock, packedSizes] = row;
  const sizes = parseOverlaySizes(packedSizes, base.sizeOptions ?? []);
  const stockQty = Number(rawStock) || sizes.reduce((sum, s) => sum + s.stock, 0);
  const price = Number(rawPrice) || 0;
  const available = rawAvailable ?? true;
  const baseSizes = new Map((base.sizes ?? []).map((s) => [s.size, s.stock]));
  const sameSizes =
    baseSizes.size === sizes.length && sizes.every((s) => baseSizes.get(s.size) === s.stock);
  if (
    sameSizes &&
    price === base.price &&
    stockQty === base.stockQty &&
    available === (base.available ?? true)
  ) {
    return base;
  }
  return {
    ...base,
    price,
    available,
    stockQty,
    totalQty: stockQty,
    sizes,
    sizeOptions: sizes.map((s) => s.size),
  };
}

function buildLiveCatalog(snapshot: LiveSnapshot): Product[] {
  const overlayByCode = new Map(snapshot.overlay.map((row) => [row[0], row]));

  const fullByCode = new Map<string, Product>();
  for (const row of snapshot.changed) {
    const mapped = mapStorefrontRow(row);
    if (!mapped) continue;
    const product = finalizeLiveProduct(mapped);
    const computed = matchJomaFolderKeys(product);
    (product as ListingItem).folders = computed.length
      ? computed
      : (BAKED_FOLDERS[product.id] ?? []);
    fullByCode.set(product.code, product);
  }

  const catalog: Product[] = [];
  for (const base of offlineCatalog) {
    if (base.code === DPO_TEST_CODE) {
      if (isDpoTestCheckoutEnabled()) catalog.push(base);
      continue;
    }
    const full = fullByCode.get(base.code);
    if (full) {
      catalog.push(full);
      fullByCode.delete(base.code);
      continue;
    }
    const row = overlayByCode.get(base.code);
    catalog.push(row ? applyOverlay(base, row) : { ...base, available: false });
  }
  catalog.push(...fullByCode.values());

  indexCatalogFromBakedFolders(catalog as ListingItem[]);
  return catalog;
}

const LIVE_MEMO_TTL_MS = 60_000;
let liveMemo: { at: number; catalog: Product[] } | null = null;
let liveMemoPending: Promise<Product[] | null> | null = null;

/** Drop this instance's merged catalog so the next read picks up a revalidated snapshot. */
export function clearLiveCatalogMemo() {
  liveMemo = null;
}

async function loadLiveCatalog(): Promise<Product[] | null> {
  const snapshot = await getCachedLiveSnapshot();
  if (!snapshot) return null;
  const catalog = buildLiveCatalog(snapshot);
  liveMemo = { at: Date.now(), catalog };
  return catalog;
}

function refreshLiveCatalog() {
  liveMemoPending ??= loadLiveCatalog()
    .catch((err) => {
      console.error("live catalog failed", err);
      return null;
    })
    .finally(() => {
      liveMemoPending = null;
    });
  return liveMemoPending;
}

/**
 * Storefront HTML — baked catalog only. A warm instance may already have a
 * live overlay in memory; we never start that overlay from a page render.
 */
export async function getCatalog(): Promise<Product[]> {
  if (liveMemo) {
    if (Date.now() - liveMemo.at >= LIVE_MEMO_TTL_MS) void refreshLiveCatalog();
    return liveMemo.catalog;
  }
  return getOfflineCatalog();
}

/** Listing APIs / ops — load the live overlay (cached ~1 hour). */
export async function getCatalogLive(): Promise<Product[]> {
  if (liveMemo && Date.now() - liveMemo.at < LIVE_MEMO_TTL_MS) {
    return liveMemo.catalog;
  }
  return (await loadLiveCatalog()) ?? getOfflineCatalog();
}

export const getCachedCatalog = cache(getCatalog);

/** Admin/ops helper — uncached live catalog. */
export async function getLiveCatalog(): Promise<Product[]> {
  try {
    const snapshot = await fetchLiveSnapshot();
    if (snapshot) return buildLiveCatalog(snapshot);
  } catch {
    /* fall through */
  }
  return offlineCatalog;
}

export async function getFreshCheckoutProducts(codes: string[]): Promise<Map<string, Product>> {
  const unique = [...new Set(codes.map((c) => c.trim()).filter(Boolean))];
  const map = new Map<string, Product>();
  if (!unique.length) return map;

  if (isDpoTestCheckoutEnabled() && unique.includes(DPO_TEST_CODE)) {
    map.set(DPO_TEST_CODE, finalizeLiveProduct(dpoTestProduct));
  }

  const liveCodes = unique.filter((code) => code !== DPO_TEST_CODE);
  if (isSupabaseConfigured()) {
    if (liveCodes.length) {
      try {
        const supabase = createPublicClient();
        const { data, error } = await supabase
          .from("storefront_catalog")
          .select("*")
          .in("code", liveCodes);
        if (!error && data?.length) {
          for (const row of data as StorefrontCatalogRow[]) {
            const mapped = mapStorefrontRow(row);
            if (mapped) map.set(mapped.code, finalizeLiveProduct(mapped));
          }
        }
      } catch (err) {
        console.error("fresh checkout products failed", err);
      }
    }
    return map;
  }

  if (map.size < unique.length) {
    const catalog = await getCatalog();
    for (const code of unique) {
      if (map.has(code)) continue;
      if (code === DPO_TEST_CODE && !isDpoTestCheckoutEnabled()) continue;
      const found = catalog.find((p) => p.code === code);
      if (found) map.set(code, found);
    }
  }
  return map;
}

export async function getStorefrontNav() {
  const catalog = await getCatalog();
  const visible = catalog.filter((p) => p.available !== false && p.code !== DPO_TEST_CODE);
  const taxonomy = buildTaxonomy(visible);
  return {
    taxonomy,
    categoryCounts: categoryCountsFromTaxonomy(taxonomy),
  };
}

const getCachedSiteSettings = unstable_cache(
  async () => {
    if (!isSupabaseConfigured()) return null;
    try {
      const supabase = createPublicClient();
      const { data } = await supabase
        .from("site_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      return data;
    } catch {
      return null;
    }
  },
  ["site-settings-v1"],
  { revalidate: 3600, tags: ["site-settings"] },
);

export async function getSiteSettings() {
  return getCachedSiteSettings();
}

const getCachedShippingMethods = unstable_cache(
  async () => {
    const locked = shippingMethodsSnapshot();
    if (!isSupabaseConfigured()) return locked;
    try {
      const supabase = createPublicClient();
      const { data } = await supabase
        .from("shipping_methods")
        .select("*")
        .order("sort_order");
      if (data?.length) {
        const byId = new Map(locked.map((m) => [m.id, m.cost]));
        return data.map((row) => ({
          ...row,
          cost: byId.has(row.id) ? byId.get(row.id)! : Number(row.cost) || 0,
        }));
      }
    } catch {
      /* fall through */
    }
    return locked;
  },
  ["shipping-methods-v1"],
  { revalidate: 3600, tags: ["shipping"] },
);

export async function getShippingMethods() {
  return getCachedShippingMethods();
}

export { productsByCategory };
