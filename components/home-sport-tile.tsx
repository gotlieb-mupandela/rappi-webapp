"use client";

import { HubTile } from "@/components/hub-tile";
import { useT } from "@/components/locale-provider";
import { hubNav } from "@/lib/i18n/labels";
import type { Product } from "@/lib/types";

export function HomeSportTile({
  slug,
  product,
  imageSrc,
  priority = false,
}: {
  slug: string;
  product?: Product;
  imageSrc?: string;
  priority?: boolean;
}) {
  const t = useT();
  return (
    <HubTile
      slug={slug}
      name={hubNav(slug, t)}
      href={`/shop/${slug}`}
      product={product}
      imageSrc={imageSrc}
      shape="square"
      compact
      imageFit={imageSrc ? "contain" : "cover"}
      priority={priority}
    />
  );
}
