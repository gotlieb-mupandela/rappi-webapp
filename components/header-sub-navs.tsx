"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { CategorySubNav } from "@/components/category-sub-nav";
import type { StorefrontTaxonomy } from "@/lib/listing-types";

/**
 * Folder drill-downs (?group=) need data/joma-folder-meta.json (~160 KB) to
 * pick the strip. Load that code only on those URLs; every other page gets
 * the plain category strip without the folder data.
 */
const GroupSubNavs = dynamic(() =>
  import("@/components/group-sub-navs").then((mod) => mod.GroupSubNavs),
);

export function HeaderSubNavs({ taxonomy }: { taxonomy: StorefrontTaxonomy }) {
  const group = useSearchParams().get("group");
  if (group && group !== "all") return <GroupSubNavs taxonomy={taxonomy} group={group} />;
  return <CategorySubNav taxonomy={taxonomy} />;
}
