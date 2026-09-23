"use client";

import type { ReactNode } from "react";
import { Breadcrumbs, type Crumb } from "@/components/breadcrumbs";
import { useT } from "@/components/locale-provider";
import { audienceBlurb, audienceName, hubBlurb, hubName } from "@/lib/i18n/labels";
import type { MessageVars } from "@/lib/i18n/translate";
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
  description,
  descriptionKey,
  descriptionVars,
  descriptionHub,
  descriptionAudience,
  actions,
  media,
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
  description?: string;
  descriptionKey?: string;
  descriptionVars?: MessageVars;
  descriptionHub?: string;
  descriptionAudience?: string;
  actions?: ReactNode;
  media?: ReactNode;
}) {
  const t = useT();
  const resolvedEyebrow =
    eyebrowPlural && typeof eyebrowCount === "number"
      ? t.plural(eyebrowPlural, eyebrowCount)
      : eyebrowKey
        ? t(eyebrowKey)
        : eyebrow;
  const resolvedTitle = titleAudience
    ? audienceName(titleAudience, t)
    : titleHub
      ? hubName(titleHub, t)
      : titleKey
        ? t(titleKey)
        : (title ?? "");
  const resolvedDescription = descriptionAudience
    ? audienceBlurb(descriptionAudience, t)
    : descriptionHub
      ? hubBlurb(descriptionHub, t)
      : descriptionKey
        ? t(descriptionKey, descriptionVars)
        : description;

  return (
    <header className="border-b border-[var(--border)]">
      <div
        className={cn(
          "page-shell py-8 sm:py-10 lg:py-14",
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
                crumbs?.length ? "mt-6" : "",
              )}
            >
              {resolvedEyebrow}
            </p>
          ) : null}
          <h1
            className={cn(
              "font-[family-name:var(--font-oswald)] text-4xl font-bold uppercase leading-[0.92] tracking-tight text-[var(--text-secondary)] sm:text-5xl md:text-6xl",
              resolvedEyebrow || crumbs?.length ? "mt-3" : "",
            )}
          >
            {resolvedTitle}
          </h1>
          {resolvedDescription ? (
            <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--muted)] sm:text-base">
              {resolvedDescription}
            </p>
          ) : null}
          {actions ? (
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
