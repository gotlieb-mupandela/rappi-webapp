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
import { subName } from "@/lib/i18n/labels";
import { isJomaBrowseFolder } from "@/lib/joma-folder-meta";

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

  const items = [
    {
      key: "all",
      href: `/shop/${slug}`,
      label: t("common.all"),
      active: onShop && viewAll && !activeSub,
    },
    ...subs.map((s) => {
      const folder = typeFolderForSubcategory(s.slug);
      const groupParam =
        TYPE_FOLDERS[folder] && folder !== s.slug
          ? `&group=${encodeURIComponent(folder)}`
          : "";
      return {
        key: s.slug,
        href: `/shop/${slug}?sub=${encodeURIComponent(s.slug)}${groupParam}`,
        label: subName(s.slug, t),
        active: activeSub === s.slug,
      };
    }),
  ];

  return (
    <nav className="border-t border-black/8 bg-white">
      <div className="page-shell w-full">
        <div className="category-marquee-viewport">
          <div className="category-marquee">
            {[0, 1].map((copy) => (
              <ul
                key={copy}
                aria-hidden={copy === 1 ? true : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-x-5 py-2 pr-5 xl:gap-x-6 xl:pr-6 lg:justify-center",
                  copy === 1 && "category-marquee-copy",
                )}
              >
                {items.map((item) => (
                  <li key={item.key} className="shrink-0">
                    <Link
                      href={item.href}
                      tabIndex={copy === 1 ? -1 : undefined}
                      data-active={item.active ? "true" : undefined}
                      className={cn(
                        "text-xs font-medium uppercase tracking-[0.12em] text-neutral-800 hover:text-neutral-500",
                        item.active && "text-black",
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
