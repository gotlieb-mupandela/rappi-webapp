"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/locale-provider";

export function TeamwearIntro() {
  const t = useT();
  return (
    <div>
      <h2 className="font-[family-name:var(--font-oswald)] text-2xl uppercase">
        {t("quote.whatInclude")}
      </h2>
      <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--muted)]">
        <li>{t("quote.includeOrg")}</li>
        <li>{t("quote.includeSport")}</li>
        <li>{t("quote.includeSizes")}</li>
        <li>{t("quote.includeKit")}</li>
      </ul>
      <p className="mt-6 text-sm text-[var(--muted)]">{t("quote.replyHint")}</p>
      <div className="mt-6">
        <Button asChild variant="outline">
          <Link href="/shop/teampro-2026">{t("home.exploreTeamwear")}</Link>
        </Button>
      </div>
    </div>
  );
}
