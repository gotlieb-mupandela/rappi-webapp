"use client";

import Image from "next/image";
import Link from "next/link";
import { useT } from "@/components/locale-provider";
import { cn } from "@/lib/utils";

function Figure({ src, alt }: { src: string; alt: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(min-width: 1024px) 50vw, 100vw"
      priority
      className="max-w-none object-contain object-center p-[6%] transition-transform duration-500 ease-out group-hover:scale-[1.03]"
    />
  );
}

function Title({ children }: { children: string }) {
  return (
    <span className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[90%] font-[family-name:var(--font-oswald)] text-[clamp(1.15rem,2.5vw,2.65rem)] font-semibold uppercase leading-[0.88] tracking-tight text-black sm:bottom-4 sm:left-4">
      {children}
    </span>
  );
}

function Tile({
  href,
  src,
  title,
  className,
}: {
  href: string;
  src: string;
  title: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("group relative min-h-0 overflow-hidden rounded-md bg-white", className)}
    >
      <Figure src={src} alt={title} />
      <Title>{title}</Title>
    </Link>
  );
}

export function HomeCatalog() {
  const t = useT();

  return (
    <section className="bg-white">
      <div className="grid grid-cols-2 gap-3 p-3 lg:h-[calc(100dvh-var(--header-h)-env(safe-area-inset-top))] lg:grid-cols-4 lg:grid-rows-2">
        <Tile
          className="aspect-[16/10] lg:col-span-2 lg:row-start-1 lg:aspect-auto"
          href="/teamwear"
          src="/brand/hub-teampro-2026.png"
          title={t("home.tileTeamwear")}
        />
        <Tile
          className="aspect-[16/10] lg:col-span-2 lg:row-start-1 lg:aspect-auto"
          href="/shop/teampro-2026"
          src="/brand/hub-rugby.png"
          title={t("home.tileTeamwearPro")}
        />
        <Tile
          className="aspect-square lg:col-span-1 lg:row-start-2 lg:aspect-auto"
          href="/shop/sportswear"
          src="/brand/hub-sportswear.png"
          title={t("home.tileSportswear")}
        />
        <Tile
          className="aspect-square lg:col-span-1 lg:row-start-2 lg:aspect-auto"
          href="/shop/shoes"
          src="/brand/hub-shoes.png"
          title={t("home.tileShoes")}
        />
        <Tile
          className="col-span-2 aspect-[16/10] lg:col-span-2 lg:row-start-2 lg:aspect-auto"
          href="/shop/lifestyle"
          src="/brand/hub-lifestyle.png"
          title={t("home.tileLifestyle")}
        />
      </div>
    </section>
  );
}
