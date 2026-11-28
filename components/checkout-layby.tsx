"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { formatPrice } from "@/lib/format";
import { LAYBY } from "@/lib/layby";
import { cn } from "@/lib/utils";

export type LaybyPlanView = {
  eligible: boolean;
  subtotal: number;
  shipping: number;
  vat: { rate: number; amount: number };
  total: number;
  deposit: number;
  balance: number;
  monthly: number;
  finalDue: string;
};

type Line = { code: string; size: string; qty: number };

/**
 * "How do you want to pay?": pay in full, or layby (20% deposit today, the rest within 3 months).
 * Asks the server for the layby plan, which uses normal prices (no promotions).
 */
export function CheckoutLaybyChoice(props: {
  lines: Line[];
  method: string;
  country: string;
  merchandise: number;
  mode: "full" | "layby";
  onMode: (mode: "full" | "layby") => void;
  accepted: boolean;
  onAccepted: (v: boolean) => void;
  onPlan: (plan: LaybyPlanView | null) => void;
}) {
  const { t } = useLocale();
  const [plan, setPlan] = useState<LaybyPlanView | null>(null);
  const { lines, method, country, onPlan, onMode, mode } = props;
  const key = `${method}|${country}|${lines.map((l) => `${l.code}:${l.size}:${l.qty}`).join(",")}`;
  const maybe = props.merchandise >= LAYBY.MIN_ORDER * 0.8;

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (!maybe || !lines.length || !country) {
        setPlan(null);
        onPlan(null);
        return;
      }
      try {
        const res = await fetch("/api/checkout/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shippingMethod: method, country, lines }),
        });
        const data = (await res.json()) as { layby?: LaybyPlanView };
        if (cancelled) return;
        const next = res.ok && data.layby ? data.layby : null;
        setPlan(next);
        onPlan(next?.eligible ? next : null);
        if (!next?.eligible && mode === "layby") onMode("full");
      } catch {
        if (!cancelled) {
          setPlan(null);
          onPlan(null);
        }
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // `key` covers lines, method and country.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, maybe]);

  if (!plan?.eligible) {
    if (props.merchandise > 0 && props.merchandise < LAYBY.MIN_ORDER) {
      return (
        <section className="rounded-xl border border-dashed border-[var(--border)] p-4 text-xs text-[var(--muted)]">
          {t("layby.notEligible", { min: formatPrice(LAYBY.MIN_ORDER) })}
        </section>
      );
    }
    return null;
  }

  const due = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(plan.finalDue),
  );
  const option = (value: "full" | "layby", title: string, sub: string) => (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] px-3 py-3 transition-colors",
        mode === value && "border-[var(--accent)]",
      )}
    >
      <input type="radio" name="paymode" checked={mode === value} onChange={() => onMode(value)} className="mt-1 accent-[var(--accent)]" />
      <span className="min-w-0 text-sm">
        <span className="block font-semibold">{title}</span>
        <span className="block text-xs text-[var(--muted)]">{sub}</span>
      </span>
    </label>
  );

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="text-sm font-bold uppercase tracking-wider">{t("layby.howPay")}</h2>
      <div className="mt-4 space-y-2">
        {option("full", t("layby.payFull"), t("layby.payFullSub"))}
        {option("layby", t("layby.option", { deposit: formatPrice(plan.deposit) }), t("layby.optionSub", { date: due }))}
      </div>
      {mode === "layby" ? (
        <div className="mt-4 rounded-xl bg-[var(--surface-2)] p-4 text-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <span className="text-[var(--muted)]">{t("layby.total")}</span>
            <span className="text-right font-semibold">{formatPrice(plan.total)}</span>
            <span className="text-[var(--muted)]">{t("layby.today")}</span>
            <span className="text-right font-bold text-[var(--accent)]">{formatPrice(plan.deposit)}</span>
            <span className="text-[var(--muted)]">{t("layby.balance")}</span>
            <span className="text-right">{formatPrice(plan.balance)}</span>
            <span className="text-[var(--muted)]">{t("layby.monthly")}</span>
            <span className="text-right">{formatPrice(plan.monthly)} × {LAYBY.TERM_MONTHS}</span>
            <span className="text-[var(--muted)]">{t("layby.payBy")}</span>
            <span className="text-right">{due}</span>
          </div>
          <ul className="mt-3 list-disc space-y-1 pl-4 text-xs leading-relaxed text-[var(--muted)]">
            <li>{t("layby.point1", { min: formatPrice(LAYBY.MIN_PAYMENT) })}</li>
            <li>{t("layby.point2")}</li>
            <li>{t("layby.point3")}</li>
            <li>{t("layby.point4")}</li>
          </ul>
          <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs leading-relaxed">
            <input
              type="checkbox"
              checked={props.accepted}
              onChange={(e) => props.onAccepted(e.target.checked)}
              className="mt-0.5 accent-[var(--accent)]"
            />
            <span>
              {t("layby.accept")}{" "}
              <Link href="/terms#clause-7" className="underline" target="_blank">
                {t("layby.agreementLink")}
              </Link>
            </span>
          </label>
        </div>
      ) : null}
    </section>
  );
}
