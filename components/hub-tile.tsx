"use client";

import Link from "next/link";
import { CATEGORIES } from "@/lib/catalog";
import { ProductImage } from "@/components/product-image";
import { useT } from "@/components/locale-provider";
import { productImageAlt } from "@/lib/copy";
import { audienceName, groupName, hubName } from "@/lib/i18n/labels";
import { productCardImageUrl } from "@/lib/media";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACCENTS = [
  "#B6FF00",
  "#C8FF00",
  "#7CFF6B",
  "#E8FF8A",
  "#9CFF2E",
  "#D4FF4A",
];

export function HubTile({
  slug,
  name,
  nameHub,
  nameAudience,
  nameGroup,
  nameKey,
  count,
  href,
  compact = false,
  product,
  imageSrc,
  banner,
  bannerKey,
  shape = "portrait",
  fill = false,
  /** Cover crops to fill (product tiles). Contain keeps full lifestyle subjects visible. */
  imageFit = "cover",
  priority = false,
  className,
}: {
  slug: string;
  name?: string;
  nameHub?: string;
  nameAudience?: string;
  nameGroup?: { kind: "shoes" | "kids" | "rugby" | "brama"; key: string };
  nameKey?: string;
  count?: number;
  href?: string;
  compact?: boolean;
  product?: Product;
  /** Optional local/override cover (e.g. audience lifestyle photos). */
  imageSrc?: string;
  banner?: string;
  bannerKey?: string;
  shape?: "portrait" | "square";
  fill?: boolean;
  imageFit?: "cover" | "contain";
  priority?: boolean;
  className?: string;
}) {
  const idx = Math.max(
    0,
    CATEGORIES.findIndex((c) => c.slug === slug),
  );
  const accent = ACCENTS[idx % ACCENTS.length];
  const n = count ?? 0;
  const to = href ?? `/category/${slug}`;
  const t = useT();
  const label = nameKey
    ? t(nameKey)
    : nameAudience
      ? audienceName(nameAudience, t)
      : nameHub
        ? hubName(nameHub, t)
        : nameGroup
          ? groupName(nameGroup.kind, nameGroup.key, t)
          : (name ?? slug);
  const contain = imageFit === "contain";
  const productSrc = product ? productCardImageUrl(product) : "";
  const coverSrc = imageSrc || productSrc || "";
  const useProductPhoto = Boolean(product && coverSrc && !imageSrc);
  const hasCover = Boolean(coverSrc);
  const imageClassName = cn(
    // max-w-none: global `img { max-width:100% }` breaks object-fit on absolute fill images
    "absolute inset-0 h-full w-full max-w-none object-center transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100",
    contain ? "object-contain" : "object-cover",
  );

  return (
    <Link href={to} className={cn("group block h-full", className)}>
      <div
        className={cn(
          "media-frame relative overflow-hidden rounded-lg border border-[var(--border)] transition-[border-color,box-shadow] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:border-[var(--border-strong)] group-hover:shadow-[var(--shadow-lift)]",
          fill
            ? contain
              ? // Featured lifestyle (sportswear): tall enough for head-to-toe in a col-span-2 cell
                "h-full min-h-[18rem] sm:min-h-[24rem] md:min-h-full"
              : "h-full min-h-[20rem] md:min-h-full"
            : shape === "square" || compact
              ? "aspect-square"
              : "aspect-[3/4]",
        )}
        style={
          hasCover
            ? contain
              ? { backgroundColor: "#fff" }
              : undefined
            : {
                backgroundImage: `linear-gradient(160deg, ${accent}26 0%, var(--tile-mid) 58%, var(--tile-end) 100%)`,
              }
        }
      >
        {useProductPhoto && product ? (
          <ProductImage
            product={product}
            src={coverSrc}
            alt={productImageAlt(product)}
            priority={priority}
            className={imageClassName}
            fallbackClassName="absolute inset-0 h-full w-full"
          />
        ) : imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageSrc}
            alt={label}
            className={imageClassName}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={priority ? "high" : "auto"}
          />
        ) : (
          <div className="absolute inset-0 opacity-40 mix-blend-overlay [background-image:repeating-linear-gradient(90deg,transparent,transparent_18px,rgba(255,255,255,0.04)_19px)]" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
        {banner || bannerKey ? (
          <div className="absolute inset-x-3 top-3 rounded-full bg-[var(--danger)] py-1 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-white">
            {bannerKey ? t(bannerKey) : banner}
          </div>
        ) : null}
        <div className="absolute inset-x-0 bottom-0 p-3">
          {n > 0 ? (
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--accent)]">
              {t.plural("count.pieces", n)}
            </p>
          ) : null}
          <p className="mt-0.5 font-[family-name:var(--font-oswald)] text-sm uppercase tracking-wide text-white sm:text-base">
            {label}
          </p>
        </div>
      </div>
    </Link>
  );
}
