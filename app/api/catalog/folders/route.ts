import { NextResponse } from "next/server";
import {
  SUBCATEGORY_LABELS,
  TYPE_FOLDER_ORDER,
  typeFolderForSubcategory,
} from "@/lib/catalog";
import { filterListing } from "@/lib/listing-core";
import { jomaFolderByKey } from "@/lib/joma-tree";
import { getCatalog } from "@/lib/supabase/catalog";

export const runtime = "nodejs";

const GROUP_LABELS: Record<string, string> = {
  shirts: "Shirts & tops",
  jackets: "Jackets & hoodies",
  swimwear: "Swimwear",
  shorts: "Shorts",
  pants: "Pants & tracksuits",
  dresses: "Dresses",
  skirts: "Skirts",
  bras: "Sports bras",
  shoes: "Footwear",
  accessories: "Accessories",
  equipment: "Equipment",
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cat = (url.searchParams.get("cat") ?? "").trim();
  const group = (url.searchParams.get("group") ?? "").trim();
  if (!cat) {
    return NextResponse.json({ error: "Missing category." }, { status: 400 });
  }

  const catalog = await getCatalog();
  let folders: { key: string; name: string; count: number; hasChildren: boolean }[];

  if (group) {
    const node = jomaFolderByKey(group);
    folders = (node?.children ?? [])
      .map((child) => ({
        key: child.key,
        name: child.label,
        count: filterListing(catalog, { cat, group: child.key }).length,
        hasChildren: Boolean(child.children?.length),
      }))
      .filter((folder) => folder.count > 0);
  } else {
    const products = filterListing(catalog, { cat });
    const counts = new Map<string, number>();
    for (const product of products) {
      const key = typeFolderForSubcategory(product.subcategory);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const rank = new Map<string, number>(
      TYPE_FOLDER_ORDER.map((key, index): [string, number] => [key, index]),
    );
    folders = [...counts.entries()]
      .map(([key, count]) => ({
        key,
        name: GROUP_LABELS[key] ?? SUBCATEGORY_LABELS[key] ?? key,
        count,
        hasChildren: false,
      }))
      .sort(
        (a, b) =>
          (rank.get(a.key) ?? TYPE_FOLDER_ORDER.length) -
            (rank.get(b.key) ?? TYPE_FOLDER_ORDER.length) ||
          a.name.localeCompare(b.name),
      );
  }

  return NextResponse.json(
    { folders },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
