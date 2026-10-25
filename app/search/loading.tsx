"use client";

import { useT } from "@/components/locale-provider";

export default function SearchLoading() {
  const t = useT();
  return (
    <div className="page-shell py-16">
      <p className="text-sm uppercase tracking-[0.16em] text-[var(--muted)]">
        {t("search.searchingShort")}
      </p>
    </div>
  );
}
