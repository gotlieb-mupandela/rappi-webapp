"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useT } from "@/components/locale-provider";
import { audienceName, groupName, hubName, subName } from "@/lib/i18n/labels";
import type { MessageVars } from "@/lib/i18n/translate";
import { jomaFolderByKey } from "@/lib/joma-tree";
import { cn } from "@/lib/utils";

export type Crumb = {
  href?: string;
  label?: string;
  key?: string;
  vars?: MessageVars;
  hub?: string;
  audience?: string;
  sub?: string;
};

function crumbLabel(
  item: Crumb,
  t: ReturnType<typeof useT>,
) {
  if (item.key) return t(item.key, item.vars);
  if (item.hub) return hubName(item.hub, t);
  if (item.audience) return audienceName(item.audience, t);
  if (item.sub) {
    const fromSub = subName(item.sub, t);
    if (fromSub !== item.sub) return fromSub;
    for (const kind of ["apparel", "footwear", "kids"] as const) {
      const g = groupName(kind, item.sub, t);
      if (g !== item.sub) return g;
    }
    return jomaFolderByKey(item.sub)?.label ?? fromSub;
  }
  return item.label ?? "";
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] text-[var(--muted)]">
      <Link
        href="/"
        className="inline-flex items-center gap-0.5 transition-colors hover:text-[var(--accent)]"
      >
        <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
        <span>{t("back")}</span>
      </Link>
      {items.map((item, i) => {
        const last = i === items.length - 1;
        const label = crumbLabel(item, t);
        return (
          <span
            key={`${label}-${i}`}
            className={cn(
              "items-center gap-x-1.5",
              last || items.length < 3 ? "flex" : "hidden sm:flex",
            )}
          >
            {i > 0 ? <span className="text-[var(--border-strong)]">/</span> : null}
            {item.href ? (
              <Link href={item.href} className="transition-colors hover:text-[var(--accent)]">
                {label}
              </Link>
            ) : (
              <span className="text-[var(--text)]">{label}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}
