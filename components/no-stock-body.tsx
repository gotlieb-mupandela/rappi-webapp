"use client";

import { useT } from "@/components/locale-provider";
import { hubName } from "@/lib/i18n/labels";

export function NoStockBody({ hubSlug }: { hubSlug: string }) {
  const t = useT();
  return <>{t("shop.noStockBody", { name: hubName(hubSlug, t) })}</>;
}
