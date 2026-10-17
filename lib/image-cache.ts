import brandVersions from "@/data/brand-versions.json";

const BRAND_HASHES = brandVersions as Record<string, string>;

function splitUrl(url: string) {
  const hash = url.indexOf("#");
  const withoutHash = hash === -1 ? url : url.slice(0, hash);
  const q = withoutHash.indexOf("?");
  const base = q === -1 ? withoutHash : withoutHash.slice(0, q);
  const params = new URLSearchParams(q === -1 ? "" : withoutHash.slice(q + 1));
  return { base, params, hash: hash === -1 ? "" : url.slice(hash) };
}

export function withCacheParam(url: string, version: string): string {
  if (!url || !version) return url;
  const { base, params, hash } = splitUrl(url);
  params.set("v", version);
  const query = params.toString();
  return `${query ? `${base}?${query}` : base}${hash}`;
}

function withoutCacheParam(url: string): string {
  const { base, params, hash } = splitUrl(url);
  params.delete("v");
  const query = params.toString();
  return `${query ? `${base}?${query}` : base}${hash}`;
}

export function brandPath(url: string): string | undefined {
  if (!url) return undefined;
  try {
    const path = url.startsWith("http") ? new URL(url).pathname : url.split("?")[0];
    return path.startsWith("/brand/") ? path : undefined;
  } catch {
    return undefined;
  }
}

export function applyBrandHash(url: string, etags: Record<string, string> = {}): string {
  const path = brandPath(url);
  if (!path) return url;
  const version = etags[path] || BRAND_HASHES[path];
  return version ? withCacheParam(url, version) : url;
}

function shortHash(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function galleryVersion(imageUrl: string, images: string[] = []): string {
  return shortHash(`${withoutCacheParam(imageUrl)}\n${images.map(withoutCacheParam).join("\n")}`);
}

export function versionProductImages<T extends { imageUrl: string; images: string[] }>(
  product: T,
  etags: Record<string, string> = {},
): T {
  const token = galleryVersion(product.imageUrl, product.images);
  const versioned = (url: string) => {
    if (!url) return url;
    if (brandPath(url)) return applyBrandHash(url, etags);
    return withCacheParam(url, token);
  };
  return {
    ...product,
    imageUrl: versioned(product.imageUrl),
    images: (product.images ?? []).map(versioned),
  };
}
