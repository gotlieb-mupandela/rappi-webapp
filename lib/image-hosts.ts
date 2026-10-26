export type AllowedImageHost = {
  host: string;
  /** Path prefix on that host. "/" allows every path. */
  pathnamePrefix: string;
  /**
   * When false, cardImage may use the host and next/image remotePatterns must not.
   * The proxy host would let /_next/image fetch arbitrary URLs.
   */
  nextImage: boolean;
};

/**
 * Hosts a product photo may already live on.
 * cardImage reads this list. next.config.ts writes its own remotePatterns
 * and does not import this module. Rows with nextImage false stay out of
 * that optimizer list. Delete the remote rows later to leave only this site.
 * Nothing in that path copies or uploads a photo.
 * This module does not set a Content-Security-Policy header.
 */
export const ALLOWED_IMAGE_HOSTS: readonly AllowedImageHost[] = [
  { host: "wsrv.nl", pathnamePrefix: "/", nextImage: false },
  {
    host: "wzmzwerzbyudcvoiiege.supabase.co",
    pathnamePrefix: "/storage/v1/object/public/product-images/",
    nextImage: true,
  },
  { host: "www.joma-sport.com", pathnamePrefix: "/on/demandware.static/", nextImage: true },
  { host: "v1.joma-sport.net", pathnamePrefix: "/files/", nextImage: true },
];

/** The card-image host list. The canonical site origin is not a row in this list. */
export function allowedImageHosts(): readonly AllowedImageHost[] {
  return ALLOWED_IMAGE_HOSTS;
}

export function imageHostAllows(hostname: string, pathname: string, rule: AllowedImageHost) {
  return hostname === rule.host && pathname.startsWith(rule.pathnamePrefix);
}

/**
 * Optimizer hosts only. Excludes nextImage: false (wsrv.nl).
 * next.config.ts does not call this. It lists the same three hosts itself.
 */
export function imageRemotePatterns() {
  return allowedImageHosts()
    .filter((rule) => rule.nextImage)
    .map((rule) => ({
      protocol: "https" as const,
      hostname: rule.host,
      pathname: rule.pathnamePrefix === "/" ? "/**" : `${rule.pathnamePrefix.replace(/\/$/, "")}/**`,
    }));
}

/** https origins for the hosts above. A later policy can read this. No header is set here. */
export function allowedImageOrigins(): string[] {
  return [...new Set(allowedImageHosts().map((rule) => `https://${rule.host}`))];
}
