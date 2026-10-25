import { metaSiteUrl } from "./meta/site";

export type AllowedImageHost = {
  host: string;
  /** Path prefix on that host. "/" allows every path. */
  pathnamePrefix: string;
};

/**
 * Hosts a product photo may already live on.
 * cardImage, the page CSP img-src, and next.config images.remotePatterns
 * all read this list. Delete the remote rows later to leave only this site.
 * Nothing in that path copies or uploads a photo.
 */
export const ALLOWED_IMAGE_HOSTS: readonly AllowedImageHost[] = [
  { host: "www.rappisportshub.com", pathnamePrefix: "/" },
  { host: "wsrv.nl", pathnamePrefix: "/" },
  {
    host: "wzmzwerzbyudcvoiiege.supabase.co",
    pathnamePrefix: "/storage/v1/object/public/product-images/",
  },
  { host: "www.joma-sport.com", pathnamePrefix: "/on/demandware.static/" },
  { host: "v1.joma-sport.net", pathnamePrefix: "/files/" },
];

/**
 * The noscript tracking pixel is not a product photo, so it stays out of
 * ALLOWED_IMAGE_HOSTS. img-src still has to name it or that pixel is blocked.
 */
const IMAGE_CSP_EXTRAS = ["https://www.facebook.com"] as const;

/** The editable list, plus the canonical site host when an env override names another one. */
export function allowedImageHosts(): readonly AllowedImageHost[] {
  let hostname = "";
  try {
    hostname = new URL(metaSiteUrl()).hostname;
  } catch {
    hostname = "";
  }
  if (!hostname || ALLOWED_IMAGE_HOSTS.some((rule) => rule.host === hostname)) {
    return ALLOWED_IMAGE_HOSTS;
  }
  return [{ host: hostname, pathnamePrefix: "/" }, ...ALLOWED_IMAGE_HOSTS];
}

export function imageHostAllows(hostname: string, pathname: string, rule: AllowedImageHost) {
  return hostname === rule.host && pathname.startsWith(rule.pathnamePrefix);
}

/** next.config `images.remotePatterns`. https only, same path prefixes as the list. */
export function imageRemotePatterns() {
  return allowedImageHosts().map((rule) => ({
    protocol: "https" as const,
    hostname: rule.host,
    pathname: rule.pathnamePrefix === "/" ? "/**" : `${rule.pathnamePrefix.replace(/\/$/, "")}/**`,
  }));
}

/** Page CSP that sets img-src only. Other directives stay unset. */
export function imageContentSecurityPolicy() {
  const hosts = allowedImageHosts().map((rule) => `https://${rule.host}`);
  const sources = ["'self'", ...hosts, ...IMAGE_CSP_EXTRAS];
  return `img-src ${[...new Set(sources)].join(" ")}`;
}
