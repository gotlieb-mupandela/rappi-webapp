import { metaSiteUrl } from "./meta/site";

export type AllowedImageHost = {
  host: string;
  /** Path prefix on that host. "/" allows every path. */
  pathnamePrefix: string;
};

/**
 * Hosts a product photo may already live on.
 * cardImage and next.config images.remotePatterns read this list.
 * Delete the remote rows later to leave only this site.
 * Nothing in that path copies or uploads a photo.
 * This module does not set a Content-Security-Policy header.
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

/** https origins for the hosts above. A later policy can read this. No header is set here. */
export function allowedImageOrigins(): string[] {
  return [...new Set(allowedImageHosts().map((rule) => `https://${rule.host}`))];
}
