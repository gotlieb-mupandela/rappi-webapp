import type { ListingItem } from "@/lib/listing-types";
import { listingHay } from "@/lib/listing-core";

let cached: ListingItem[] | null = null;
let pending: Promise<ListingItem[]> | null = null;

export function getListingIndexSync(): ListingItem[] | null {
  return cached;
}

async function fetchListingIndex(): Promise<ListingItem[]> {
  let res = await fetch("/listing-index.json", { cache: "force-cache" });
  // Dev/Turbopack can briefly 404 static files; a cached 404 also sticks with
  // force-cache — retry once bypassing the HTTP cache.
  if (!res.ok) {
    res = await fetch("/listing-index.json", { cache: "no-store" });
  }
  if (!res.ok) throw new Error(`listing index ${res.status}`);
  const rows = (await res.json()) as ListingItem[];
  for (const row of rows) {
    if (!row.images) row.images = row.imageUrl ? [row.imageUrl] : [];
    if (!row.currency) row.currency = "NAD";
    row.hay = listingHay(row);
  }
  return rows;
}

export function loadListingIndex(): Promise<ListingItem[]> {
  if (cached) return Promise.resolve(cached);
  if (pending) return pending;
  pending = fetchListingIndex()
    .then((rows) => {
      cached = rows;
      pending = null;
      return rows;
    })
    .catch((err) => {
      pending = null;
      throw err;
    });
  return pending;
}
