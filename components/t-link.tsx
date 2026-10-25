"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/locale-provider";
import type { MessageVars } from "@/lib/i18n/translate";

export function TLink({
  href,
  k,
  vars,
  variant,
  size,
  className,
}: {
  href: string;
  k: string;
  vars?: MessageVars;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
}) {
  const t = useT();
  return (
    <Button asChild variant={variant} size={size} className={className}>
      <Link href={href}>{t(k, vars)}</Link>
    </Button>
  );
}
