"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CATEGORIES, HIDDEN_TYPE_FOLDERS, SUBCATEGORY_LABELS } from "@/lib/catalog";
import type { StorefrontTaxonomy } from "@/lib/listing-types";
import { cn } from "@/lib/utils";
import { useT } from "@/components/locale-provider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { subName } from "@/lib/i18n/labels";

export function CategorySubNav({ taxonomy }: { taxonomy: StorefrontTaxonomy }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const t = useT();
  const slug = CATEGORIES.find(
    (c) =>
      pathname === `/category/${c.slug}` || pathname.startsWith(`/shop/${c.slug}`),
  )?.slug;

  if (!slug) return null;

  const subs = (taxonomy[slug] ?? []).filter(
    (s) => s.count > 0 && SUBCATEGORY_LABELS[s.slug] && !HIDDEN_TYPE_FOLDERS.has(s.slug),
  );
  if (subs.length < 2) return null;

  const active = params.get("sub");
  const onShop = pathname.startsWith(`/shop/${slug}`);

  return (
    <nav className="border-t border-black/8 bg-white">
      <ScrollArea className="page-shell w-full">
        <ul className="flex items-center gap-x-5 py-2 xl:gap-x-6 lg:justify-center">
          <li className="shrink-0">
            <Link
              href={`/shop/${slug}`}
              data-active={onShop && !active ? "true" : undefined}
              className={cn(
                "text-xs font-medium uppercase tracking-[0.12em] text-neutral-800 hover:text-neutral-500",
                onShop && !active && "text-black",
              )}
            >
              {t("common.all")}
            </Link>
          </li>
          {subs.map((s) => (
            <li key={s.slug} className="shrink-0">
              <Link
                href={`/shop/${slug}?sub=${encodeURIComponent(s.slug)}`}
                data-active={active === s.slug ? "true" : undefined}
                className={cn(
                  "text-xs font-medium uppercase tracking-[0.12em] text-neutral-800 hover:text-neutral-500",
                  active === s.slug && "text-black",
                )}
              >
                {subName(s.slug, t)}
              </Link>
            </li>
          ))}
        </ul>
      </ScrollArea>
    </nav>
  );
}
