"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { trackMeta } from "@/lib/meta/pixel";

function MetaSearchInner() {
  const params = useSearchParams();
  const q = (params.get("q") ?? "").trim();
  const last = useRef("");

  useEffect(() => {
    if (!q || q === last.current) return;
    last.current = q;
    trackMeta("Search", { search_string: q });
  }, [q]);

  return null;
}

export function MetaSearch() {
  return (
    <Suspense fallback={null}>
      <MetaSearchInner />
    </Suspense>
  );
}
