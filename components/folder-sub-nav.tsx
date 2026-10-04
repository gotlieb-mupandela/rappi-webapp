"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useT } from "@/components/locale-provider";
import { groupName, subName } from "@/lib/i18n/labels";
import {
  jomaFolderParentKey,
  jomaFolderSiblings,
  type JomaFolderMeta,
} from "@/lib/joma-folder-meta";
import { AUDIENCES, CATEGORIES } from "@/lib/catalog";
import { cn } from "@/lib/utils";

function folderLabel(folder: JomaFolderMeta, t: ReturnType<typeof useT>) {
  const apparel = groupName("apparel", folder.key, t);
  if (apparel !== folder.key) return apparel;
  const footwear = groupName("footwear", folder.key, t);
  if (footwear !== folder.key) return footwear;
  const kids = groupName("kids", folder.key, t);
  if (kids !== folder.key) return kids;
  const sub = subName(folder.key, t);
  if (sub !== folder.key) return sub;
  return folder.label;
}

function hrefForFolder(folder: JomaFolderMeta, basePath: string, audience?: string) {
  const params = new URLSearchParams();
  if (audience) params.set("audience", audience);
  if (folder.sub && !folder.hasChildren) {
    const parent = jomaFolderParentKey(folder.key);
    if (parent) params.set("group", parent);
    params.set("sub", folder.sub);
  } else {
    params.set("group", folder.key);
  }
  // Teamwear kits drill-down keeps its view param (/teamwear?view=kits&group=…).
  if (basePath.includes("?")) return `${basePath}&${params.toString()}`;
  return `${basePath}?${params.toString()}`;
}

/**
 * Sibling underline strip while drilling Joma folders (Teamwear peers, Outerwear peers, …).
 * Hidden on the audience root folder grid (Men / Women landing).
 */
export function FolderSubNav() {
  const pathname = usePathname();
  const params = useSearchParams();
  const t = useT();
  const group = params.get("group") || "";
  if (!group) return null;

  const audienceFromPath = AUDIENCES.find((a) => pathname === `/shop/${a.slug}`)?.slug;
  const hub = CATEGORIES.find(
    (c) => pathname === `/shop/${c.slug}` || pathname === `/category/${c.slug}`,
  )?.slug;
  const kitsDrill = pathname === "/teamwear";
  if (!audienceFromPath && !hub && !kitsDrill) return null;

  const audienceQuery = params.get("audience") || undefined;
  const kitsBase =
    kitsDrill && params.get("view") === "kits" ? "/teamwear?view=kits" : undefined;
  if (!audienceFromPath && !hub && !kitsBase) return null;
  const basePath = kitsBase ?? (audienceFromPath ? `/shop/${audienceFromPath}` : `/shop/${hub}`);
  const audienceParam =
    !audienceFromPath && audienceQuery ? audienceQuery : undefined;

  const siblings = jomaFolderSiblings(group);
  if (siblings.length < 2) return null;

  return (
    <nav className="border-b border-[var(--border)] bg-white">
      <ScrollArea className="page-shell w-full">
        <ul className="flex items-center gap-x-5 xl:gap-x-6">
          {siblings.map((folder) => {
            const active = group === folder.key;
            return (
              <li key={folder.key} className="shrink-0">
                <Link
                  href={hrefForFolder(folder, basePath, audienceParam)}
                  data-active={active ? "true" : undefined}
                  className={cn(
          "nav-link inline-flex min-h-9 items-center text-[11px] font-medium uppercase tracking-[0.08em]",
          active
            ? "text-[var(--accent)]"
            : "text-[var(--muted)] hover:text-[var(--accent)]",
        )}
                >
                  {folderLabel(folder, t)}
                </Link>
              </li>
            );
          })}
        </ul>
      </ScrollArea>
    </nav>
  );
}
