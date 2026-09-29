import type { Metadata } from "next";
import { AudienceLandingGrid } from "@/components/audience-landing";
import { PageHeader } from "@/components/page-header";
import { ProductGrid } from "@/components/product-grid";
import { TeamwearIntro } from "@/components/teamwear-intro";
import { TeamwearQuoteForm } from "@/components/teamwear-quote-form";
import { officialKitsLandingTiles, teamsLandingTiles } from "@/lib/hubs";
import {
  isJomaBrowseFolder,
  jomaFolderAncestorKeys,
  jomaFolderByKey,
  productsInJomaFolder,
} from "@/lib/joma-tree";
import { buildListing, parseListingQuery } from "@/lib/listing-core";
import { getCatalog } from "@/lib/supabase/catalog";

export const metadata: Metadata = {
  title: "Teams",
  description:
    "Teamwear by material and sport — polyester, cotton, soccer, basketball, rugby, and more.",
};

function firstSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function TeamwearPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const view = firstSearchParam(sp.view);

  if (view === "quote") {
    return (
      <div>
        <PageHeader
          crumbs={[
            { href: "/", key: "common.home" },
            { href: "/teamwear", key: "nav.teams" },
            { key: "quote.crumb" },
          ]}
          eyebrowKey="home.teamwearEyebrow"
          titleKey="quote.title"
          descriptionKey="quote.intro"
        />
        <div className="page-shell grid gap-10 py-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:py-14">
          <TeamwearIntro />
          <TeamwearQuoteForm />
        </div>
      </div>
    );
  }

  if (view === "kits") {
    const group = firstSearchParam(sp.group);
    const catalog = await getCatalog();
    // Official Kits drill-down: mid node → club/federation tiles,
    // leaf node → product listing (hub-agnostic, kits span hubs).
    if (group && isJomaBrowseFolder(group)) {
      const node = jomaFolderByKey(group);
      const ancestors = jomaFolderAncestorKeys(group);
      const crumbs = [
        { href: "/", key: "common.home" as const },
        { href: "/teamwear?view=kits", key: "nav.officialKits" as const },
        ...ancestors.map((key) => ({
          href: `/teamwear?view=kits&group=${encodeURIComponent(key)}`,
          sub: key,
        })),
        { sub: group },
      ];
      if (node?.children?.length) {
        const tiles = node.children.map((child) => {
          const sample = productsInJomaFolder(child.key)[0];
          return {
            label: child.label,
            href: `/teamwear?view=kits&group=${encodeURIComponent(child.key)}`,
            imageSrc: sample?.imageUrl ?? "",
          };
        });
        return (
          <div className="bg-white">
            <PageHeader
              crumbs={crumbs}
              titleKey="nav.officialKits"
              titleSub={group}
            />
            <div className="page-shell pb-10 pt-1 sm:pb-12 sm:pt-3">
              <AudienceLandingGrid tiles={tiles} variant="kits" />
            </div>
          </div>
        );
      }
      const listing = buildListing(catalog, parseListingQuery({ group }));
      return (
        <div className="bg-white">
          <PageHeader
            crumbs={crumbs}
            titleKey="nav.officialKits"
            titleSub={group}
            titleCount={listing.total}
          />
          <div className="page-shell pb-10 pt-1 sm:pb-12 sm:pt-3">
            <ProductGrid products={listing.products} grouped />
          </div>
        </div>
      );
    }
    const tiles = officialKitsLandingTiles();
    return (
      <div className="bg-white">
        <PageHeader
          crumbs={[
            { href: "/", key: "common.home" },
            { key: "nav.officialKits" },
          ]}
          titleKey="nav.officialKits"
        />
        <div className="page-shell pb-10 pt-2 sm:pb-12 sm:pt-3">
          <AudienceLandingGrid tiles={tiles} variant="kits" />
        </div>
      </div>
    );
  }

  const catalog = await getCatalog();
  const tiles = teamsLandingTiles(catalog);

  return (
    <div className="bg-white">
      <PageHeader
        crumbs={[
          { href: "/", key: "common.home" },
          { key: "nav.teams" },
        ]}
        titleKey="nav.teams"
      />
      <div className="page-shell pb-10 pt-2 sm:pb-12 sm:pt-3">
        <AudienceLandingGrid tiles={tiles} />
      </div>
    </div>
  );
}
