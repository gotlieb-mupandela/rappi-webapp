"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/page-header";

function SearchHeaderInner({ catalogCount }: { catalogCount: number }) {
  const params = useSearchParams();
  const q = (params.get("q") ?? "").trim();

  return (
    <PageHeader
      crumbs={[{ href: "/", key: "common.home" }, { key: "search.crumb" }]}
      eyebrowPlural="count.pieces"
      eyebrowCount={catalogCount}
      titleKey="search.title"
      descriptionKey={q ? "search.descriptionQuery" : "search.descriptionEmpty"}
      descriptionVars={q ? { q } : undefined}
    />
  );
}

export function SearchHeader({ catalogCount }: { catalogCount: number }) {
  return (
    <Suspense
      fallback={
        <PageHeader
          crumbs={[{ href: "/", key: "common.home" }, { key: "search.crumb" }]}
          eyebrowPlural="count.pieces"
          eyebrowCount={catalogCount}
          titleKey="search.title"
          descriptionKey="search.descriptionEmpty"
        />
      }
    >
      <SearchHeaderInner catalogCount={catalogCount} />
    </Suspense>
  );
}
