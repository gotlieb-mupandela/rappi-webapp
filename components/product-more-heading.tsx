"use client";

import { SectionHeading } from "@/components/section-heading";
import { useT } from "@/components/locale-provider";
import { hubName } from "@/lib/i18n/labels";

export function ProductMoreHeading({ hubSlug }: { hubSlug: string }) {
  const t = useT();
  return (
    <SectionHeading
      title={t("product.moreIn", { name: hubName(hubSlug, t) })}
      href={`/shop/${hubSlug}`}
      linkLabelKey="common.shopAll"
    />
  );
}
