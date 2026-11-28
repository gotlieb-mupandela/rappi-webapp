"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { AccountFrame } from "@/components/account-frame";
import { LaybyStatusPill, LaybyProgress } from "@/components/layby-bits";
import { useT } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import type { Database } from "@/lib/database.types";
import { formatPrice } from "@/lib/format";
import { LAYBY, laybyBalance } from "@/lib/layby";
import { useAuth } from "@/lib/stores/auth";
import { createClient } from "@/lib/supabase/client";

type Layby = Database["public"]["Tables"]["laybys"]["Row"];

export default function AccountLaybysPage() {
  const user = useAuth((s) => s.user);
  const t = useT();
  const [rows, setRows] = useState<Layby[] | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void createClient()
      .from("laybys")
      .select("*")
      .order("opened_at", { ascending: false })
      .then(({ data }) => {
        if (!cancelled) setRows(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) {
    return (
      <div className="page-shell py-10">
        <p className="text-sm text-neutral-600">{t("account.signInHint")}</p>
        <Button asChild className="mt-6">
          <Link href="/login?next=/account/laybys">{t("nav.signIn")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <AccountFrame
      section="laybys"
      crumbs={[
        { href: "/", label: t("common.home") },
        { href: "/account", label: t("account.myAccount") },
        { label: t("layby.pageTitle") },
      ]}
    >
      <h1 className="font-[family-name:var(--font-oswald)] text-3xl uppercase">{t("layby.pageTitle")}</h1>
      {rows === null ? (
        <p className="mt-6 text-sm text-neutral-500">…</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 max-w-lg text-sm leading-6 text-neutral-600">{t("layby.none", { min: formatPrice(LAYBY.MIN_ORDER) })}</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {rows.map((l) => (
            <li key={l.id}>
              <Link
                href={`/account/laybys/${l.id}`}
                className="group flex items-center gap-4 border border-black/10 bg-white px-4 py-4 transition-colors hover:bg-neutral-50"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-black">{l.id}</span>
                    <LaybyStatusPill layby={l} />
                  </span>
                  <span className="mt-2 block">
                    <LaybyProgress paid={Number(l.paid)} total={Number(l.total)} />
                  </span>
                  {l.status === "active" ? (
                    <span className="mt-1 block text-xs text-neutral-500">
                      {t("layby.left", { amount: formatPrice(laybyBalance(l)) })} ·{" "}
                      {t("layby.payByDate", { date: new Date(l.final_due_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) })}
                    </span>
                  ) : null}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400 group-hover:text-black" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AccountFrame>
  );
}
