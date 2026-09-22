"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CATEGORIES, HIDDEN_TYPE_FOLDERS, SUBCATEGORY_LABELS } from "@/lib/catalog";
import type { StorefrontTaxonomy } from "@/lib/listing-types";
import { cn } from "@/lib/utils";
import { useT } from "@/components/locale-provider";
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
    <nav className="border-t border-[var(--border)] bg-[var(--header-bg-scrolled)]">
      <ul className="scroll-touch page-shell flex items-center gap-x-5 overflow-x-auto py-2 [mask-image:linear-gradient(90deg,transparent,black_1.25rem,black_calc(100%-1.25rem),transparent)] lg:justify-center lg:[mask-image:none] xl:gap-x-6">
        <li className="shrink-0">
          <Link
            href={`/shop/${slug}`}
            data-active={onShop && !active ? "true" : undefined}
            className={cn(
              "nav-link text-xs font-medium uppercase tracking-[0.12em]",
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
              className="nav-link text-xs font-medium uppercase tracking-[0.12em]"
            >
              {subName(s.slug, t)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
