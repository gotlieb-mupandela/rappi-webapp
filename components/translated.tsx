"use client";

import { useT } from "@/components/locale-provider";
import type { MessageVars } from "@/lib/i18n/translate";

export function Translated({
  k,
  vars,
  plural,
  count,
}: {
  k: string;
  vars?: MessageVars;
  plural?: boolean;
  count?: number;
}) {
  const t = useT();
  return <>{plural && typeof count === "number" ? t.plural(k, count, vars) : t(k, vars)}</>;
}
