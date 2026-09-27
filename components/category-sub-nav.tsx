"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  CATEGORIES,
  HIDDEN_TYPE_FOLDERS,
  SUBCATEGORY_LABELS,
  TYPE_FOLDERS,
  typeFolderForSubcategory,
} from "@/lib/catalog";
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

  const activeSub = params.get("sub");
  const activeGroup = params.get("group");
  const viewAll = params.get("view") === "all";
  const onShop = pathname.startsWith(`/shop/${slug}`);
  const onFolders = onShop && !activeSub && !viewAll && !activeGroup;

  return (
    <nav className="border-t border-[var(--border)] bg-[var(--header-bg-scrolled)]">
      <ScrollArea className="page-shell w-full">
        <ul className="flex items-center gap-x-5 py-2 xl:gap-x-6 lg:justify-center">
          <li className="shrink-0">
            <Link
              href={`/shop/${slug}`}
              data-active={onFolders ? "true" : undefined}
              className={cn("nav-link text-xs font-medium uppercase tracking-[0.12em]")}
            >
              {t("shop.shopByType")}
            </Link>
          </li>
          <li className="shrink-0">
            <Link
              href={`/shop/${slug}?view=all`}
              data-active={onShop && viewAll && !activeSub ? "true" : undefined}
              className={cn("nav-link text-xs font-medium uppercase tracking-[0.12em]")}
            >
              {t("common.all")}
            </Link>
          </li>
          {subs.map((s) => {
            const folder = typeFolderForSubcategory(s.slug);
            const groupParam =
              TYPE_FOLDERS[folder] && folder !== s.slug
                ? `&group=${encodeURIComponent(folder)}`
                : "";
            return (
              <li key={s.slug} className="shrink-0">
                <Link
                  href={`/shop/${slug}?sub=${encodeURIComponent(s.slug)}${groupParam}`}
                  data-active={activeSub === s.slug ? "true" : undefined}
                  className="nav-link text-xs font-medium uppercase tracking-[0.12em]"
                >
                  {subName(s.slug, t)}
                </Link>
              </li>
            );
          })}
        </ul>
      </ScrollArea>
    </nav>
  );
}
