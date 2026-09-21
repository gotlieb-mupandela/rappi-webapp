"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/locale-provider";

export function StoreHeaderActions() {
  const t = useT();
  return (
    <>
      <Button asChild>
        <Link href="/teamwear">{t("home.teamwearCta")}</Link>
      </Button>
      <Button asChild variant="outline">
        <Link href="/shop/sportswear">{t("home.shopNow")}</Link>
      </Button>
    </>
  );
}
