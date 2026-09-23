import Link from "next/link";
import { cn } from "@/lib/utils";

export type AudienceLandingTile = {
  label: string;
  href: string;
  /** Empty string = solid gray placeholder (Joma-style missing asset). */
  imageSrc: string;
  /** Optional strip overlaid on the image (e.g. OUTLET “SPECIAL OFFERS”). */
  banner?: string;
  bannerTone?: "green" | "magenta" | "red";
  /** Outlet graphic tiles: orange category or red price card. */
  outletKind?: "photo" | "category" | "price";
  /** Text on the colored bar for outlet graphic tiles. */
  barLabel?: string;
};

/** Joma B2B-style dense subcategory grid: portrait image + uppercase label under it. */
export function AudienceLandingGrid({
  tiles,
  className,
  variant = "audience",
}: {
  tiles: AudienceLandingTile[];
  className?: string;
  /**
   * `audience` = dense Man/Woman apparel grid;
   * `footwear` = 4 equal shoe tiles with object-contain;
   * `kits` = 3 equal Official Kits portrait tiles;
   * `kids` = 4 equal Children portrait cards;
   * `outlet` = photo + orange/red graphic OUTLET cards.
   */
  variant?: "audience" | "footwear" | "kits" | "kids" | "outlet";
}) {
  const isFootwear = variant === "footwear";
  const isKits = variant === "kits";
  const isKids = variant === "kids";
  const isOutlet = variant === "outlet";

  return (
    <div
      className={cn(
        isKits
          ? "grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-4 md:gap-6"
          : isKids || isFootwear
            ? "grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5"
            : "grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5 md:grid-cols-4 lg:grid-cols-7",
        className,
      )}
    >
      {tiles.map((tile, index) => {
        const outletKind = tile.outletKind ?? (isOutlet ? "photo" : undefined);
        const isGraphic = outletKind === "category" || outletKind === "price";
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
              "group flex flex-col border border-transparent p-0.5 transition-colors hover:border-[#c5c9d4]",
              (isKids || isKits) && "hover:border-transparent",
            )}
          >
            <div
              className={cn(
                "relative overflow-hidden",
                isFootwear ? "aspect-square bg-[#e8eaed]" : "aspect-[3/4]",
                isKids && "rounded-[18px] bg-[#e8eaed]",
                !isKids && !isGraphic && "bg-[#e8eaed]",
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
                      OUTLET
                    </span>
                  </div>
                  <div
                    className={cn(
                      "flex flex-1 items-center justify-center px-2 py-2",
                      outletKind === "category" ? "bg-[#e07112]" : "bg-[#d4453a]",
                    )}
                  >
                    <span className="text-center text-[10px] font-bold uppercase leading-snug tracking-[0.04em] text-white sm:text-[11px]">
                      {tile.barLabel ?? tile.label}
                    </span>
                  </div>
                </div>
              ) : tile.imageSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tile.imageSrc}
                  alt={tile.label}
                  className={cn(
                    "absolute inset-0 h-full w-full transition-transform duration-300 ease-out group-hover:scale-[1.03] motion-reduce:transition-none",
                    isFootwear
                      ? "object-contain object-center p-5 sm:p-6"
                      : "min-h-full min-w-full max-w-none object-cover object-center",
                  )}
                  loading="lazy"
                  decoding="async"
                />
              ) : null}
              {tile.banner && !isGraphic ? (
                <div
                  className={cn(
                    "absolute inset-x-0 bottom-0 px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-[0.06em] text-white sm:py-2 sm:text-xs",
                    bannerBg,
                  )}
                >
                  {tile.banner}
                </div>
              ) : null}
            </div>
            <p
              className={cn(
                "mt-2 px-0.5 text-center font-bold uppercase leading-snug tracking-[0.04em] text-[#212f5c]",
                isKits
                  ? "text-xs sm:text-sm"
                  : isKids
                    ? "text-[11px] sm:text-xs"
                    : "text-[10px] sm:text-[11px] lg:text-xs",
              )}
            >
              {tile.label}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
