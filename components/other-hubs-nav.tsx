"use client";

import Link from "next/link";
import { useT } from "@/components/locale-provider";
import { hubName } from "@/lib/i18n/labels";

export function OtherHubsNav({ hubs }: { hubs: string[] }) {
  const t = useT();
  return (
    <nav className="mt-14 border-t border-[var(--border)] pt-8" aria-label={t("common.otherHubs")}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-2)]">
        {t("common.otherHubs")}
      </p>
      <ul className="mt-4 flex flex-wrap gap-2">
        {hubs.map((slug) => (
          <li key={slug}>
            <Link
              href={`/category/${slug}`}
              className="inline-flex min-h-10 items-center rounded-full border border-[var(--border-strong)] px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              {hubName(slug, t)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
