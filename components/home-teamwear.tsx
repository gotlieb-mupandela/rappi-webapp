"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/locale-provider";

const TEAMWEAR_COVER = "/brand/hub-teampro-2026.png";

export function HomeTeamwear() {
  const t = useT();

  return (
    <section className="relative overflow-hidden border-y border-[var(--border)]">
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-none sm:aspect-[16/9] lg:aspect-[2/1]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={TEAMWEAR_COVER}
          alt={t("home.teamwearTitle")}
          className="absolute inset-0 h-full w-full max-w-none object-cover object-[center_16%]"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-[var(--accent-dim)]/90 via-[var(--accent-dim)]/50 to-transparent"
        />
        <div className="page-shell relative z-10 flex h-full flex-col justify-end py-12 lg:py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/70">
            {t("home.teamwearEyebrow")}
          </p>
          <h2 className="mt-3 max-w-xl font-[family-name:var(--font-oswald)] text-3xl font-bold uppercase leading-[0.95] tracking-tight text-white sm:text-5xl">
            {t("home.teamwearTitle")}
          </h2>
          <p className="mt-4 max-w-lg text-sm leading-6 text-white/80 sm:text-base">
            {t("home.teamwearBody")}
          </p>
          <div className="mt-6">
            <Button asChild size="lg">
              <Link href="/teamwear">{t("home.teamwearCta")}</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
