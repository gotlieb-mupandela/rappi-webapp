import type { Metadata } from "next";
import { AudienceLandingGrid } from "@/components/audience-landing";
import { PageHeader } from "@/components/page-header";
import { TeamwearIntro } from "@/components/teamwear-intro";
import { TeamwearQuoteForm } from "@/components/teamwear-quote-form";
import { officialKitsLandingTiles } from "@/lib/hubs";

export const metadata: Metadata = {
  title: "Official Kits",
  description:
    "Official team collections, committees and federations, and special editions from Joma.",
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
            { href: "/teamwear", key: "nav.officialKits" },
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
