import { createHash } from "node:crypto";
import type { Product } from "@/lib/types";

const versions = new WeakMap<readonly Product[], string>();

/** Drop the image cache-buster so a `?v=` change is not a catalogue change. */
function imageIdentity(url: string): string {
  if (!url) return "";
  const hashAt = url.indexOf("#");
  const withoutHash = hashAt === -1 ? url : url.slice(0, hashAt);
  const queryAt = withoutHash.indexOf("?");
  if (queryAt === -1) return url;
  const params = new URLSearchParams(withoutHash.slice(queryAt + 1));
  if (!params.has("v")) return url;
  params.delete("v");
  const query = params.toString();
  const hash = hashAt === -1 ? "" : url.slice(hashAt);
  return `${withoutHash.slice(0, queryAt)}${query ? `?${query}` : ""}${hash}`;
}

function line(product: Product): string {
  const sizes = (product.sizes ?? []).map((size) => `${size.size}:${size.stock}`).join(",");
  return [
    product.id,
    product.code,
    product.price,
    product.unitPrice,
    product.stockQty,
    product.totalQty,
    product.available === false ? 0 : 1,
    product.badge ?? "",
    product.category,
    product.subcategory,
    product.gender,
    product.sellAs ?? "",
    product.packSize ?? "",
    product.item,
    product.name,
    product.displayName,
    product.title,
    imageIdentity(product.imageUrl),
    (product.images ?? []).map(imageIdentity).join("|"),
    sizes,
  ].join("\u001f");
}

/**
 * Short stable id for a catalogue snapshot. Same products in any order share
 * a version. Memoized on the array identity returned by the catalogue loader.
 */
export function catalogVersion(products: readonly Product[]): string {
  const cached = versions.get(products);
  if (cached) return cached;
  const hash = createHash("sha256");
  const order = products.map((_, index) => index);
  order.sort((a, b) => {
    const byCode = products[a].code.localeCompare(products[b].code);
    return byCode === 0 ? a - b : byCode;
  });
  for (const index of order) {
    hash.update(line(products[index]));
    hash.update("\n");
  }
  const version = hash.digest("hex").slice(0, 12);
  versions.set(products, version);
  return version;
}
