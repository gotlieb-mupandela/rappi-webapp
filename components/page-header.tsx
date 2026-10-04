"use client";

import type { ReactNode } from "react";
import { Breadcrumbs, type Crumb } from "@/components/breadcrumbs";
import { useT } from "@/components/locale-provider";
import { audienceBlurb, audienceName, groupName, hubBlurb, hubName, subName } from "@/lib/i18n/labels";
import type { MessageVars } from "@/lib/i18n/translate";
import { jomaFolderByKey } from "@/lib/joma-folder-meta";
import { cn } from "@/lib/utils";

export function PageHeader({
  crumbs,
  eyebrow,
  eyebrowKey,
  eyebrowPlural,
  eyebrowCount,
  title,
  titleKey,
  titleHub,
  titleAudience,
  titleSub,
  titleCount,
  description,
  descriptionKey,
  descriptionVars,
  descriptionHub,
  descriptionAudience,
  actions,
  media,
  /** Tighter chrome for Joma folder landings (crumbs + title only). */
  compact = false,
  /** Full-bleed browse width (Men / Women / folder grids). */
  wide = false,
}: {
  crumbs?: Crumb[];
  eyebrow?: string;
  eyebrowKey?: string;
  eyebrowPlural?: string;
  eyebrowCount?: number;
  title?: string;
  titleKey?: string;
  titleHub?: string;
  titleAudience?: string;
  /** When set, overrides hub/audience title with a subcategory / type-folder label. */
  titleSub?: string;
  /** Appended as `[n]` after the title (Joma listing style). */
  titleCount?: number;
  description?: string;
  descriptionKey?: string;
  descriptionVars?: MessageVars;
  descriptionHub?: string;
  descriptionAudience?: string;
  actions?: ReactNode;
  media?: ReactNode;
  compact?: boolean;
  wide?: boolean;
}) {
  const t = useT();
  const resolvedEyebrow =
    eyebrowPlural && typeof eyebrowCount === "number" && titleCount == null
      ? t.plural(eyebrowPlural, eyebrowCount)
      : eyebrowKey
        ? t(eyebrowKey)
        : eyebrow;
  const resolvedTitle = titleSub
    ? (() => {
        const fromSub = subName(titleSub, t);
        if (fromSub !== titleSub) return fromSub;
        for (const kind of ["apparel", "footwear", "kids"] as const) {
          const g = groupName(kind, titleSub, t);
          if (g !== titleSub) return g;
        }
        return jomaFolderByKey(titleSub)?.label ?? fromSub;
      })()
    : titleAudience
      ? audienceName(titleAudience, t)
      : titleHub
        ? hubName(titleHub, t)
        : titleKey
          ? t(titleKey)
          : (title ?? "");
  const displayTitle =
    typeof titleCount === "number"
      ? `${resolvedTitle} [${titleCount}]`
      : resolvedTitle;
  const resolvedDescription = descriptionAudience
    ? audienceBlurb(descriptionAudience, t)
    : descriptionHub
      ? hubBlurb(descriptionHub, t)
      : descriptionKey
        ? t(descriptionKey, descriptionVars)
        : description;

  return (
    <header className={cn(!compact && "border-b border-[var(--border)]")}>
      <div
        className={cn(
          "page-shell",
          wide && "page-shell--browse",
          compact ? "py-4 sm:py-5" : "py-8 sm:py-10 lg:py-14",
          media &&
            "grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,24rem)] lg:gap-12",
        )}
      >
        <div className="min-w-0">
          {crumbs?.length ? <Breadcrumbs items={crumbs} /> : null}
          {resolvedEyebrow ? (
            <p
              className={cn(
                "text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]",
                crumbs?.length ? (compact ? "mt-3" : "mt-6") : "",
              )}
            >
              {resolvedEyebrow}
            </p>
          ) : null}
          <h1
            className={cn(
              "font-[family-name:var(--font-oswald)] font-bold uppercase leading-[0.92] tracking-tight text-[var(--text-secondary)]",
              compact
                ? "mt-2 text-2xl sm:text-3xl md:text-4xl"
                : "text-4xl sm:text-5xl md:text-6xl",
              !compact && (resolvedEyebrow || crumbs?.length) ? "mt-3" : null,
              compact && (resolvedEyebrow || crumbs?.length) ? "mt-2" : null,
            )}
          >
            {displayTitle}
          </h1>
          {resolvedDescription && !compact ? (
            <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--muted)] sm:text-base">
              {resolvedDescription}
            </p>
          ) : null}
          {actions && !compact ? (
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {actions}
            </div>
          ) : null}
        </div>
        {media ? <div className="min-w-0">{media}</div> : null}
      </div>
    </header>
  );
}
