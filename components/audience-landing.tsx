"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { useLocale } from "@/components/locale-provider";

export type AudienceLandingTile = {
  label: string;
  /** i18n key resolving the label at render (falls back to label). */
  labelKey?: string;
  href: string;
  /** Empty string = solid gray placeholder (Joma-style missing asset). */
  imageSrc: string;
  /** Optional strip overlaid on the image (e.g. OUTLET “SPECIAL OFFERS”). */
  banner?: string;
  /** i18n key resolving the banner at render (falls back to banner). */
  bannerKey?: string;
  bannerTone?: "green" | "magenta" | "red";
  /** Outlet graphic tiles: orange category or red price card. */
  outletKind?: "photo" | "category" | "price";
  /** Text on the colored bar for outlet graphic tiles. */
  barLabel?: string;
  /** i18n key resolving the bar label at render (falls back to barLabel). */
  barLabelKey?: string;
};

/** Joma B2B dense subcategory grid: portrait plate + white uppercase label bar. */
export function AudienceLandingGrid({
  tiles,
  className,
  variant = "audience",
}: {
  tiles: AudienceLandingTile[];
  className?: string;
  /**
   * `audience` = dense Man/Woman apparel grid (7-col);
   * `footwear` = 4 equal square shoe tiles with object-contain;
   * `kits` = 3 equal Official Kits portrait tiles;
   * `kids` = 4 equal Children portrait cards;
   * `outlet` = photo + orange/red graphic OUTLET cards.
   */
  variant?: "audience" | "footwear" | "kits" | "kids" | "outlet";
}) {
  const { t } = useLocale();
  const isFootwear = variant === "footwear";
  const isKits = variant === "kits";
  const isKids = variant === "kids";
  const isOutlet = variant === "outlet";
  const isDense = !isFootwear && !isKits && !isKids;

  return (
    <div
      className={cn(
        isKits
          ? "grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-4 md:gap-6"
          : isKids || isFootwear
            ? "grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5"
            : "joma-folder-grid grid grid-cols-2 gap-0.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7",
        className,
      )}
    >
      {tiles.map((tile, index) => {
        const outletKind = tile.outletKind ?? (isOutlet ? "photo" : undefined);
        const isGraphic = outletKind === "category" || outletKind === "price";
        const label = tile.labelKey ? t(tile.labelKey) : tile.label;
        const banner = tile.bannerKey ? t(tile.bannerKey) : tile.banner;
        const barLabel = tile.barLabelKey ? t(tile.barLabelKey) : (tile.barLabel ?? label);
        const bannerBg =
          tile.bannerTone === "green"
            ? "bg-[#7cb342]"
            : tile.bannerTone === "magenta"
              ? "bg-[#e4004b]"
              : "bg-[#e4004b]";

        return (
          <Link
            key={`${tile.label}-${tile.href}-${index}`}
            href={tile.href}
            className={cn(
              "group relative flex flex-col bg-white",
              isDense &&
                "outline-solid outline-1 outline-transparent -outline-offset-1 transition-[outline-color] duration-150 hover:outline-accent focus-visible:outline-accent",
              !isDense &&
                "border border-transparent p-0.5 transition-colors hover:border-[var(--border-strong)]",
              (isKids || isKits) && "hover:border-transparent",
            )}
          >
            <div
              className={cn(
                "relative overflow-hidden",
                /* Footwear hub stays square; catalog folders (HubTile) use portrait 3/4 */
                isFootwear ? "aspect-square bg-[#eceff1]" : "aspect-[3/4] bg-[#eceff1]",
                isKids && "rounded-[18px]",
                outletKind === "category" && "bg-[#f18a1f]",
                outletKind === "price" && "bg-[#e85a4f]",
              )}
            >
              {isGraphic ? (
                <div className="absolute inset-0 flex flex-col">
                  <div
                    className={cn(
                      "flex flex-[1.15] items-center justify-center px-2",
                      outletKind === "category" ? "bg-[#f18a1f]" : "bg-[#e85a4f]",
                    )}
                  >
                    <span className="text-center text-sm font-black uppercase tracking-[0.12em] text-white sm:text-base">
                      {t("tiles.outlet")}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "flex flex-1 items-center justify-center px-2 py-2",
                      outletKind === "category" ? "bg-[#e07112]" : "bg-[#d4453a]",
                    )}
                  >
                    <span className="text-center text-[10px] font-bold uppercase leading-snug tracking-[0.04em] text-white sm:text-[11px]">
                      {barLabel}
                    </span>
                  </div>
                </div>
              ) : tile.imageSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tile.imageSrc}
                  alt={label}
                  className={cn(
                    "absolute inset-0 h-full w-full transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100",
                    isFootwear
                      ? "object-contain object-center p-5 sm:p-6"
                      : "min-h-full min-w-full max-w-none object-cover object-center",
                  )}
                  loading={index < 7 ? "eager" : "lazy"}
                  decoding="async"
                />
              ) : null}
              {banner && !isGraphic ? (
                <div
                  className={cn(
                    "absolute inset-x-0 bottom-0 px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-[0.06em] text-white sm:py-2 sm:text-xs",
                    bannerBg,
                  )}
                >
                  {banner}
                </div>
              ) : null}
            </div>
            {isGraphic ? null : (
              <div
                className={cn(
                  "flex items-center justify-center bg-white px-1.5",
                  isDense
                    ? "min-h-9 border-t border-[#e8eaed] py-2 sm:min-h-10"
                    : "mt-2 min-h-0 py-0",
                  isKids && "mt-2 border-0",
                )}
              >
                <p
                  className={cn(
                    "text-center font-bold uppercase leading-snug tracking-[0.04em] text-[#1a1a2e]",
                    isKits
                      ? "text-xs sm:text-sm"
                      : isKids
                        ? "text-[11px] sm:text-xs"
                        : "text-[10px] sm:text-[11px]",
                  )}
                >
                  {label}
                </p>
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}
