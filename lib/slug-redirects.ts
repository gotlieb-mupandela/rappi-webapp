/**
 * Browser 308s for the two retired public slugs.
 * Every target is a fixed relative path. The request path and query are
 * used only as a lookup key. Unknown URLs, including extra query params,
 * fall through and are not copied into a Location header.
 */
const SLUG_REDIRECTS: Readonly<Record<string, string>> = {
  "/shop/joma-flow": "/shop/shoes?group=flow",
  "/category/joma-flow": "/shop/shoes?group=flow",
  "/shop/shoes?group=joma-flow": "/shop/shoes?group=flow",
  "/shop/shoes?audience=men&group=joma-flow": "/shop/shoes?audience=men&group=flow",
  "/shop/shoes?audience=women&group=joma-flow": "/shop/shoes?audience=women&group=flow",
  "/shop/shoes?sub=joma-flow": "/shop/shoes?sub=flow",
  "/shop/kids?group=k14-outerwear-anoracks-jackets&tab=joma-kids":
    "/shop/kids?group=k14-outerwear-anoracks-jackets&tab=kids",
  "/shop/kids?group=k14-outerwear-chubasqueros&tab=joma-kids":
    "/shop/kids?group=k14-outerwear-chubasqueros&tab=kids",
  "/shop/kids?group=k14-pants-pants-largos&tab=joma-kids":
    "/shop/kids?group=k14-pants-pants-largos&tab=kids",
  "/shop/kids?group=k14-sweatshirts-jackets&tab=joma-kids":
    "/shop/kids?group=k14-sweatshirts-jackets&tab=kids",
  "/shop/kids?group=k1214b-outerwear-anorak-jackets&tab=joma-kids":
    "/shop/kids?group=k1214b-outerwear-anorak-jackets&tab=kids",
  "/shop/kids?group=k1214b-pants-leggings&tab=joma-kids":
    "/shop/kids?group=k1214b-pants-leggings&tab=kids",
  "/shop/kids?group=k1214b-tshirts-polos&tab=joma-kids":
    "/shop/kids?group=k1214b-tshirts-polos&tab=kids",
  "/shop/kids?group=k1214b-tw-outerwear-anorak-jackets&tab=joma-kids":
    "/shop/kids?group=k1214b-tw-outerwear-anorak-jackets&tab=kids",
  "/shop/kids?group=k1214g-outerwear-jacket&tab=joma-kids":
    "/shop/kids?group=k1214g-outerwear-jacket&tab=kids",
  "/shop/kids?group=k610-outerwear&tab=joma-kids": "/shop/kids?group=k610-outerwear&tab=kids",
  "/shop/kids?group=k610-tshirts-polos&tab=joma-kids":
    "/shop/kids?group=k610-tshirts-polos&tab=kids",
  "/shop/men?group=anorak-jackets&tab=joma-kids": "/shop/men?group=anorak-jackets&tab=kids",
};

function assertFixedRelativePath(path: string) {
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\") ||
    path.includes("://") ||
    path.includes(":") ||
    path.includes("..") ||
    /[\r\n]/.test(path)
  ) {
    throw new Error("Slug redirect target must be a fixed relative path.");
  }
}

for (const [from, to] of Object.entries(SLUG_REDIRECTS)) {
  assertFixedRelativePath(from.split("?")[0] ?? from);
  assertFixedRelativePath(to);
}

function lookupKey(pathname: string, searchParams: URLSearchParams) {
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const pairs = [...searchParams.entries()];
  if (pairs.length === 0) return path;
  pairs.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
  const query = pairs.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&");
  return `${path}?${query}`;
}

/** Fixed relative path for a known old URL, or undefined when the request should continue. */
export function fixedSlugRedirect(pathname: string, searchParams: URLSearchParams): string | undefined {
  if (!pathname.startsWith("/") || pathname.startsWith("//") || pathname.includes("\\") || pathname.includes("..")) {
    return undefined;
  }
  return SLUG_REDIRECTS[lookupKey(pathname, searchParams)];
}

export function slugRedirectEntries(): readonly (readonly [string, string])[] {
  return Object.entries(SLUG_REDIRECTS);
}

export function slugRedirectTargets(): readonly string[] {
  return Object.values(SLUG_REDIRECTS);
}
