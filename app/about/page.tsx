import type { Metadata } from "next";
import { AboutView } from "@/app/about/about-view";

export const metadata: Metadata = {
  title: "About us",
  description:
    "Rappi Sports Hub is run by Rappi Investments CC in Windhoek, Namibia. Sportswear, footwear and equipment priced in Namibian Dollars.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return <AboutView />;
}
