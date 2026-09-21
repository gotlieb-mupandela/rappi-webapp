"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/locale-provider";

const TEAMWEAR_COVER = "/brand/hub-teampro-2026.png";

export function HomeTeamwear() {
  const t = useT();

  return (
    <section className="relative overflow-hidden border-y border-[var(--border)]">
      <div className="relative min-h-[22rem] lg:min-h-[30rem]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={TEAMWEAR_COVER}
          alt={t("home.teamwearTitle")}
          className="absolute inset-0 h-full w-full max-w-none object-cover object-center"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-black/15"
        />
        <div className="page-shell relative z-10 flex min-h-[22rem] flex-col justify-end py-12 lg:min-h-[30rem] lg:py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
            {t("home.teamwearEyebrow")}
          </p>
          <h2 className="mt-3 max-w-xl font-[family-name:var(--font-oswald)] text-3xl uppercase leading-[0.95] tracking-tight text-white sm:text-5xl">
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
