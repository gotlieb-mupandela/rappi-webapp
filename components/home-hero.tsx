"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/locale-provider";
import { TAGLINE } from "@/lib/catalog";

const LEGACY_HERO_TITLE = "RAPPI SPORTS HUB";
const LEGACY_HERO_BODIES = [
  "Your home for quality sportswear, footwear & equipment. Shop trusted brands for athletes, teams, schools and clubs — all at competitive prices in Namibian Dollars.",
  "Opening shop stock across sportswear, football, court sports, and kit. Retail unit prices in Namibian dollars (N$).",
];

export function HomeHero({
  settingsTagline,
  settingsTitle,
  settingsBody,
}: {
  settingsTagline?: string | null;
  settingsTitle?: string | null;
  settingsBody?: string | null;
}) {
  const { t, market } = useLocale();
  const tagline =
    !settingsTagline ||
    settingsTagline === TAGLINE ||
    settingsTagline === "EQUIP | PERFORM | INSPIRE"
      ? t("home.tagline")
      : settingsTagline;
  const heroTitle =
    !settingsTitle || settingsTitle === LEGACY_HERO_TITLE ? t("home.title") : settingsTitle;
  const heroBody =
    !settingsBody || LEGACY_HERO_BODIES.includes(settingsBody)
      ? market === "eu"
        ? t("home.heroBodyEur")
        : t("home.heroBody")
      : settingsBody;

  return (
    <section className="relative overflow-hidden border-b border-[var(--border)]">
      <div className="page-shell grid items-end gap-6 pt-8 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,28rem)] lg:gap-6 lg:pt-12">
        <div className="relative z-10 pb-8 sm:pb-14 lg:pb-20">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
            {tagline}
          </p>
          <h1 className="mt-3 max-w-3xl break-words font-[family-name:var(--font-oswald)] text-[2.35rem] uppercase leading-[0.92] tracking-tight text-ink sm:mt-4 sm:text-6xl md:text-7xl">
            {heroTitle}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-[var(--muted)] sm:mt-6 sm:text-base sm:leading-7">
            {heroBody}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/shop/sportswear">{t("home.shopNow")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link href="/shop/teampro-2026">{t("home.exploreTeamwear")}</Link>
            </Button>
          </div>
        </div>
        <div className="relative -mx-4 h-[18rem] sm:-mx-0 sm:h-[30rem] lg:-mr-4 lg:h-[44rem]">
          <div
            aria-hidden
            className="hero-glow pointer-events-none absolute inset-x-[6%] bottom-[4%] top-[14%] rounded-[100%] bg-[radial-gradient(ellipse_at_center,var(--hero-glow),transparent_70%)] blur-3xl"
          />
          <Image
            src="/brand/hero-athlete.png"
            alt={t("home.heroAlt")}
            width={900}
            height={1100}
            priority
            className="hero-athlete absolute inset-x-0 bottom-0 mx-auto h-full w-auto max-w-none object-contain object-bottom [mask-image:linear-gradient(to_top,transparent_0%,#000_8%,#000_100%)] [-webkit-mask-image:linear-gradient(to_top,transparent_0%,#000_8%,#000_100%)]"
          />
        </div>
      </div>
    </section>
  );
}
