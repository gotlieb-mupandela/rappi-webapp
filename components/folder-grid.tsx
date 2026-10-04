import { HubTile } from "@/components/hub-tile";
import type { HubFolderTile } from "@/lib/hubs";

/** Joma B2B folder matrix — near-flush gutters, up to 7 columns. */
export function FolderGrid({
  folders,
  slug,
}: {
  folders: HubFolderTile[];
  slug: string;
}) {
  return (
    <div className="joma-folder-grid grid grid-cols-2 gap-0.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
      {folders.map((g, i) => (
        <HubTile
          key={g.key}
          slug={slug}
          name={g.name}
          nameSubcategory={g.nameGroup ? undefined : g.key}
          nameGroup={g.nameGroup}
          href={g.href}
          product={g.sample ?? undefined}
          imageSrc={g.cover}
          imageFit="cover"
          bannerKey={g.banner ? "group.shoes.offersBanner" : undefined}
          shape="portrait"
          variant="folder"
          priority={i < 2}
        />
      ))}
    </div>
  );
}
