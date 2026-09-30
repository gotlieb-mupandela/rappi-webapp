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
import { isJomaBrowseFolder } from "@/lib/joma-tree";

export function CategorySubNav({ taxonomy }: { taxonomy: StorefrontTaxonomy }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const t = useT();
  const slug = CATEGORIES.find(
    (c) =>
      pathname === `/category/${c.slug}` || pathname.startsWith(`/shop/${c.slug}`),
  )?.slug;

  if (!slug) return null;

  const activeSub = params.get("sub");
  const viewAll = params.get("view") === "all";
  const onShop = pathname.startsWith(`/shop/${slug}`);

  // Joma folder drill-downs show the folder sibling strip instead.
  const group = params.get("group");
  if (group && group !== "all" && isJomaBrowseFolder(group)) return null;

  // Footwear folder landings (audience tiles + sport folders) have no type strip.
  // Show Boots / Sneakers / … only on product lists (`sub` or `view=all`).
  if (slug === "shoes" && onShop && !activeSub && !viewAll) {
    return null;
  }

  const subs = (taxonomy[slug] ?? []).filter(
    (s) => s.count > 0 && SUBCATEGORY_LABELS[s.slug] && !HIDDEN_TYPE_FOLDERS.has(s.slug),
  );
  if (!subs.length) return null;

  return (
    <nav className="border-t border-black/8 bg-white">
      <ScrollArea className="page-shell w-full">
        <ul className="flex items-center gap-x-5 py-2 xl:gap-x-6 lg:justify-center">
          <li className="shrink-0">
            <Link
              href={`/shop/${slug}`}
              data-active={onShop && viewAll && !activeSub ? "true" : undefined}
              className={cn(
                "text-xs font-medium uppercase tracking-[0.12em] text-neutral-800 hover:text-neutral-500",
                onShop && viewAll && !activeSub && "text-black",
              )}
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
                  className={cn(
                    "text-xs font-medium uppercase tracking-[0.12em] text-neutral-800 hover:text-neutral-500",
                    activeSub === s.slug && "text-black",
                  )}
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
