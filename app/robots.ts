import type { MetadataRoute } from "next";
import { metaSiteUrl } from "@/lib/meta/site";

/**
 * Filter, sort and search links are rendered on demand for every combination,
 * which costs server time each time a crawler follows one. Product, category and
 * shop pages (including pagination and type tabs) stay crawlable.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin/",
        "/checkout/",
        "/account/",
        "/search",
        "/*?*size=",
        "/*?*max=",
        "/*?*q=",
        "/*?*view=",
        "/*?*age=",
        "/*?*gender=",
      ],
    },
    sitemap: `${metaSiteUrl()}/sitemap.xml`,
  };
}
