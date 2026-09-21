import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { TeamwearIntro } from "@/components/teamwear-intro";
import { TeamwearQuoteForm } from "@/components/teamwear-quote-form";

export const metadata: Metadata = {
  title: "Teamwear quote",
  description: "Request custom teamwear for schools, clubs and teams across Namibia.",
};

export default function TeamwearPage() {
  return (
    <div>
      <PageHeader
        crumbs={[{ href: "/", key: "common.home" }, { key: "quote.crumb" }]}
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
