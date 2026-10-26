/** Fixed site origin. Feed paths use this constant, not the request Host and not env. */
export const CANONICAL_SITE_ORIGIN = "https://www.rappisportshub.com";

export function metaSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || CANONICAL_SITE_ORIGIN).replace(/\/$/, "");
}

export function metaAbsoluteUrl(pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${metaSiteUrl()}${path}`;
}
