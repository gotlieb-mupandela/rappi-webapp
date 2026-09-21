import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { StoreHeaderActions } from "@/components/store-header-actions";
import { StoreVisit } from "@/components/store-visit";

export const metadata: Metadata = {
  title: "Find our store",
  description: "RAPPI Sports Hub — sportswear, equipment and teamwear for Namibia.",
};

export default function StorePage() {
  return (
    <div>
      <PageHeader
        crumbs={[{ href: "/", key: "common.home" }, { key: "store.crumb" }]}
        eyebrowKey="footer.visit"
        titleKey="store.title"
        descriptionKey="store.intro"
        actions={<StoreHeaderActions />}
      />
      <div className="page-shell py-10 lg:py-14">
        <StoreVisit />
      </div>
    </div>
  );
}
