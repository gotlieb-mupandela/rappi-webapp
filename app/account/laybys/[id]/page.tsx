"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AccountFrame } from "@/components/account-frame";
import { LaybyProgress, LaybyStatusPill } from "@/components/layby-bits";
import { useT } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Database } from "@/lib/database.types";
import { formatPrice } from "@/lib/format";
import { laybyBalance, laybyPaymentLimits, laybySuggested } from "@/lib/layby";
import { useAuth } from "@/lib/stores/auth";
import { createClient } from "@/lib/supabase/client";

type Layby = Database["public"]["Tables"]["laybys"]["Row"];
type Pay = Database["public"]["Tables"]["layby_payments"]["Row"];
type Item = { code: string; name: string; size: string; qty: number; unit_price: number };

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function AccountLaybyPage() {
  const { id } = useParams<{ id: string }>();
  const user = useAuth((s) => s.user);
  const t = useT();
  const [layby, setLayby] = useState<Layby | null | undefined>(undefined);
  const [payments, setPayments] = useState<Pay[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [amount, setAmount] = useState("");
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!user || !id) return;
    let cancelled = false;
    const sb = createClient();
    void (async () => {
      const { data: l } = await sb.from("laybys").select("*").eq("id", String(id).toUpperCase()).maybeSingle();
      if (cancelled) return;
      setLayby(l ?? null);
      if (!l) return;
      const [{ data: p }, { data: it }] = await Promise.all([
        sb.from("layby_payments").select("*").eq("layby_id", l.id).order("created_at"),
        sb.from("order_items").select("code, name, size, qty, unit_price").eq("order_id", l.order_id),
      ]);
      if (cancelled) return;
      setPayments(p ?? []);
      setItems((it ?? []).map((i) => ({ ...i, unit_price: Number(i.unit_price) })));
      if (l.status === "active") setAmount(laybySuggested(l).toFixed(2));
    })();
    return () => {
      cancelled = true;
    };
  }, [user, id]);

  async function pay() {
    if (!layby) return;
    setPaying(true);
    try {
      const res = await fetch(`/api/layby/${layby.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount) }),
      });
      const data = (await res.json()) as { paymentUrl?: string; error?: string };
      if (!res.ok || !data.paymentUrl) {
        toast.error(data.error ?? "Could not start the payment.");
        return;
      }
      window.location.href = data.paymentUrl;
    } catch {
      toast.error("Could not start the payment.");
    } finally {
      setPaying(false);
    }
  }

  if (!user) {
    return (
      <div className="page-shell py-10">
        <Button asChild>
          <Link href={`/login?next=/account/laybys/${id}`}>{t("nav.signIn")}</Link>
        </Button>
      </div>
    );
  }

  const crumbs = [
    { href: "/", label: t("common.home") },
    { href: "/account/laybys", label: t("layby.pageTitle") },
    { label: String(id).toUpperCase() },
  ];
  if (layby === undefined) return <AccountFrame section="laybys" crumbs={crumbs}><p className="text-sm text-neutral-500">…</p></AccountFrame>;
  if (layby === null) return <AccountFrame section="laybys" crumbs={crumbs}><p className="text-sm text-neutral-600">Layby not found.</p></AccountFrame>;

  const balance = laybyBalance(layby);
  const limits = laybyPaymentLimits(layby);
  const value = Number(amount);
  const valid = Number.isFinite(value) && value >= limits.min && value <= limits.max;

  return (
    <AccountFrame section="laybys" crumbs={crumbs}>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-[family-name:var(--font-oswald)] text-3xl uppercase">{layby.id}</h1>
        <LaybyStatusPill layby={layby} />
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        {t("layby.openedOn", { date: day(layby.opened_at) })} · {t("layby.payByDate", { date: day(layby.final_due_at) })}
      </p>

      <div className="mt-5 max-w-xl">
        <LaybyProgress paid={Number(layby.paid)} total={Number(layby.total)} />
        {layby.status === "active" ? (
          <p className="mt-2 text-2xl font-semibold">{t("layby.left", { amount: formatPrice(balance) })}</p>
        ) : null}
      </div>

      {layby.status === "active" ? (
        <section className="mt-6 max-w-xl border border-black/10 bg-white p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider">{t("layby.payNow")}</h2>
          <p className="mt-1 text-xs text-neutral-500">
            {t("layby.suggested", { amount: formatPrice(laybySuggested(layby)) })} ·{" "}
            {t("layby.minMax", { min: formatPrice(limits.min), max: formatPrice(limits.max) })}
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Input
              inputMode="decimal"
              aria-label={t("layby.amount")}
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              className="sm:max-w-[12rem]"
            />
            <Button type="button" onClick={() => void pay()} disabled={!valid || paying} className="h-11">
              {paying ? t("layby.paying") : t("layby.pay", { amount: valid ? formatPrice(value) : "" })}
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {[limits.min, laybySuggested(layby), balance]
              .filter((v, i, a) => v > 0 && a.indexOf(v) === i)
              .map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAmount(v.toFixed(2))}
                  className="rounded-full border border-black/15 px-3 py-1 text-xs hover:bg-neutral-50"
                >
                  {formatPrice(v)}
                </button>
              ))}
          </div>
        </section>
      ) : layby.status === "paid" ? (
        <p className="mt-6 max-w-xl rounded-lg bg-[rgba(94,255,56,0.15)] p-4 text-sm">{t("layby.paidDone")}</p>
      ) : (
        <p className="mt-6 max-w-xl rounded-lg bg-neutral-100 p-4 text-sm">
          {t("layby.cancelledInfo", { fee: formatPrice(Number(layby.cancel_fee ?? 0)), refund: formatPrice(Number(layby.refund_amount ?? 0)) })}
        </p>
      )}

      <section className="mt-8 max-w-xl">
        <h2 className="text-sm font-bold uppercase tracking-wider">{t("layby.items")}</h2>
        <ul className="mt-3 divide-y divide-black/10 border-y border-black/10">
          {items.map((i) => (
            <li key={`${i.code}-${i.size}`} className="flex justify-between gap-4 py-3 text-sm">
              <span className="min-w-0">
                <span className="block font-medium">{i.name.replace(/\s*·\s*[\w.-]+$/, "")}</span>
                <span className="block text-xs text-neutral-500">
                  {i.code} · {i.size} · ×{i.qty}
                </span>
              </span>
              <span className="shrink-0">{formatPrice(i.unit_price * i.qty)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 max-w-xl">
        <h2 className="text-sm font-bold uppercase tracking-wider">{t("layby.history")}</h2>
        <ul className="mt-3 divide-y divide-black/10 border-y border-black/10">
          {payments.map((p) => (
            <li key={p.id} className="flex justify-between py-2.5 text-sm">
              <span>
                {day(p.created_at)} · {p.kind === "deposit" ? t("layby.deposit") : t("layby.payment")} ({p.method})
              </span>
              <span className="font-medium">{formatPrice(Number(p.amount))}</span>
            </li>
          ))}
        </ul>
        <a href={`/api/layby/${layby.id}/pdf`} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm underline">
          {t("layby.agreement")}
        </a>
        <p className="mt-4 text-xs text-neutral-500">{t("layby.help")}</p>
      </section>
    </AccountFrame>
  );
}
