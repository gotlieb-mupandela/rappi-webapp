"use client";

import { CategorySubNav } from "@/components/category-sub-nav";
import { FolderSubNav } from "@/components/folder-sub-nav";
import { isJomaBrowseFolder } from "@/lib/joma-folder-meta";
import type { StorefrontTaxonomy } from "@/lib/listing-types";

/** Loaded on demand by HeaderSubNavs for ?group= URLs. */
export function GroupSubNavs({ taxonomy, group }: { taxonomy: StorefrontTaxonomy; group: string }) {
  return (
    <>
      {/* Joma folder drill-downs show the folder sibling strip instead. */}
      {isJomaBrowseFolder(group) ? null : <CategorySubNav taxonomy={taxonomy} />}
      <FolderSubNav />
    </>
  );
}
