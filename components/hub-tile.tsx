"use client";

import Link from "next/link";
import { ProductImage } from "@/components/product-image";
import { useT } from "@/components/locale-provider";
import { productImageAlt } from "@/lib/copy";
import { audienceName, groupName, hubName, subName } from "@/lib/i18n/labels";
import { productCardImageCandidates, productCardImageUrl } from "@/lib/media";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

export function HubTile({
  slug,
  name,
  nameHub,
  nameAudience,
  nameSubcategory,
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
  /** Tailwind object-* position utility, e.g. object-left, object-[center_30%]. */
  imagePosition = "object-center",
  size = "medium",
  /** Dark = white label on dark gradient; light = navy label for bright imagery. */
  tone = "dark",
  labelPosition = "bottom",
  showLabel = true,
  priority = false,
  className,
}: {
  slug: string;
  name?: string;
  nameHub?: string;
  nameAudience?: string;
  nameSubcategory?: string;
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
  imagePosition?: string;
  size?: "large" | "medium" | "small";
  tone?: "dark" | "light";
  labelPosition?: "bottom" | "center";
  showLabel?: boolean;
  priority?: boolean;
  className?: string;
}) {
  const n = count ?? 0;
  const to = href ?? `/category/${slug}`;
  const t = useT();
  const label = nameKey
    ? t(nameKey)
    : nameAudience
      ? audienceName(nameAudience, t)
      : nameSubcategory
        ? subName(nameSubcategory, t)
        : nameHub
          ? hubName(nameHub, t)
          : nameGroup
            ? groupName(nameGroup.kind, nameGroup.key, t)
            : (name ?? slug);
  const contain = imageFit === "contain";
  const productSrc = product ? productCardImageUrl(product) : "";
  const productSources = product ? productCardImageCandidates(product) : [];
  const coverSrc = imageSrc || productSrc || "";
  const useProductPhoto = Boolean(product && coverSrc && !imageSrc);
  const hasCover = Boolean(coverSrc);
  const light = tone === "light";
  const imageClassName = cn(
    // max-w-none: global `img { max-width:100% }` breaks object-fit on absolute fill images
    "bento-tile__media absolute inset-0 h-full w-full min-h-full min-w-full max-w-none motion-reduce:transition-none",
    contain ? "object-contain" : "object-cover",
    imagePosition,
  );

  const sizeClass =
    fill || size === "large"
      ? "h-full min-h-0"
      : size === "small"
        ? "aspect-square min-h-0"
        : shape === "square" || compact
          ? "aspect-square"
          : "aspect-[3/4]";

  return (
    <Link href={to} className={cn("bento-tile group block h-full min-h-0", className)}>
      <div
        className={cn(
          "media-frame relative h-full overflow-hidden rounded-[1rem] sm:rounded-[1.15rem]",
          sizeClass,
        )}
        style={
          hasCover
            ? contain
              ? { backgroundColor: "#e8eaed" }
              : { backgroundColor: "#1a1c1e" }
            : {
                backgroundImage:
                  "linear-gradient(160deg, var(--visual-from) 0%, var(--tile-mid) 58%, var(--tile-end) 100%)",
              }
        }
      >
        {useProductPhoto && product ? (
          <ProductImage
            product={product}
            src={coverSrc}
            sources={productSources}
            alt={productImageAlt(product)}
            priority={priority}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 280px"
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
          <div className="absolute inset-0 bg-[var(--surface-2)]" />
        )}
        {light ? (
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/55 via-white/10 to-transparent" />
        ) : contain ? (
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
        ) : (
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
        )}
        {banner || bannerKey ? (
          <div className="absolute inset-x-3 top-3 rounded-full bg-[var(--danger)] py-1 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-white">
            {bannerKey ? t(bannerKey) : banner}
          </div>
        ) : null}
        {showLabel ? (
        <div
          className={cn(
            "absolute inset-x-0 p-4 sm:p-5",
            labelPosition === "center" ? "bottom-0 top-0 flex flex-col justify-center" : "bottom-0",
          )}
        >
          {n > 0 ? (
            <p
              className={cn(
                "text-[10px] font-medium uppercase tracking-[0.2em]",
                light ? "text-[var(--muted)]" : "text-white/75",
              )}
            >
              {t.plural("count.pieces", n)}
            </p>
          ) : null}
          <p
            className={cn(
              "mt-0.5 font-[family-name:var(--font-oswald)] font-bold uppercase tracking-wide",
              light ? "text-[var(--text-secondary)]" : "text-white",
              size === "large" || fill
                ? "text-lg sm:text-xl lg:text-2xl xl:text-[1.65rem]"
                : "text-sm sm:text-base lg:text-lg",
            )}
          >
            {label}
          </p>
        </div>
        ) : null}
      </div>
    </Link>
  );
}
