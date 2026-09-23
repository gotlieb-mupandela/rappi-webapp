"use client";

import Link from "next/link";
import { useT } from "@/components/locale-provider";
import type { MessageVars } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  titleKey,
  titleVars,
  href,
  linkLabel,
  linkLabelKey,
  linkLabelVars,
  className,
}: {
  eyebrow?: string;
  title?: string;
  titleKey?: string;
  titleVars?: MessageVars;
  href?: string;
  linkLabel?: string;
  linkLabelKey?: string;
  linkLabelVars?: MessageVars;
  className?: string;
}) {
  const t = useT();
  const resolvedTitle = titleKey ? t(titleKey, titleVars) : (title ?? "");
  const resolvedLink = linkLabelKey ? t(linkLabelKey, linkLabelVars) : linkLabel;

  return (
    <div className={cn("mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-2", className)}>
      <div>
        {eyebrow ? (
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted-2)]">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="font-[family-name:var(--font-oswald)] text-2xl font-bold uppercase tracking-[0.06em] text-[var(--text-secondary)] sm:text-3xl">
          {resolvedTitle}
        </h2>
      </div>
      {href && resolvedLink ? (
        <Link
          href={href}
          className="shrink-0 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)] transition-colors hover:text-[var(--accent-bright)]"
        >
          {resolvedLink}
        </Link>
      ) : null}
    </div>
  );
}
