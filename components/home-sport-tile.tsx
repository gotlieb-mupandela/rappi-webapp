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
  size = "small",
  className,
}: {
  slug: string;
  product?: Product;
  imageSrc?: string;
  priority?: boolean;
  size?: "large" | "medium" | "small";
  className?: string;
}) {
  const t = useT();
  return (
    <HubTile
      slug={slug}
      name={hubNav(slug, t)}
      href={`/category/${slug}`}
      product={product}
      imageSrc={imageSrc}
      shape="square"
      compact
      size={size}
      imageFit={imageSrc ? "contain" : "cover"}
      priority={priority}
      className={className}
    />
  );
}
