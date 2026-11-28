"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { LaybyStatePill } from "@/components/admin/layby-state";
import type { Database } from "@/lib/database.types";
import { formatPrice } from "@/lib/format";
import { laybyBalance, laybyCancellableForNonPayment, laybyCancellation, laybyPlan, laybyState } from "@/lib/layby";
import { createClient } from "@/lib/supabase/client";

type Layby = Database["public"]["Tables"]["laybys"]["Row"];
type Pay = Database["public"]["Tables"]["layby_payments"]["Row"];
type Note = Database["public"]["Tables"]["layby_notifications"]["Row"];
type Item = { code: string; name: string; size: string; qty: number; unit_price: number };

const when = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Windhoek" }).format(new Date(iso))
    : "—";
const day = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Windhoek" }).format(new Date(iso)) : "—";

export default function AdminLaybyPage() {
  const { id } = useParams<{ id: string }>();
  const [layby, setLayby] = useState<Layby | null | undefined>(undefined);
  const [payments, setPayments] = useState<Pay[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [order, setOrder] = useState<{ shipping_method: string; address: string; city: string; status: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "eft">("cash");
  const [reason, setReason] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);

  const load = useCallback(async () => {
    const sb = createClient();
    const { data: l } = await sb.from("laybys").select("*").eq("id", String(id).toUpperCase()).maybeSingle();
    setLayby(l ?? null);
    if (!l) return;
    const [{ data: p }, { data: it }, { data: n }, { data: o }] = await Promise.all([
      sb.from("layby_payments").select("*").eq("layby_id", l.id).order("created_at"),
      sb.from("order_items").select("code, name, size, qty, unit_price").eq("order_id", l.order_id),
      sb.from("layby_notifications").select("*").eq("layby_id", l.id).order("created_at"),
      sb.from("orders").select("shipping_method, address, city, status").eq("id", l.order_id).maybeSingle(),
    ]);
    setPayments(p ?? []);
    setItems((it ?? []).map((i) => ({ ...i, unit_price: Number(i.unit_price) })));
    setNotes(n ?? []);
    setOrder(o ?? null);
  }, [id]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function act(body: Record<string, unknown>, ok: string) {
    if (!layby) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/laybys/${layby.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Action failed.");
        return;
      }
      toast.success(ok);
      setAmount("");
      setReason("");
      setConfirmCancel(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (layby === undefined) return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  if (layby === null) return <p className="text-sm">Layby not found. <Link href="/admin/laybys" className="underline">Back</Link></p>;

  const balance = laybyBalance(layby);
  const plan = laybyPlan(Number(layby.total), new Date(layby.opened_at));
  const cancel = laybyCancellation(layby);
  const state = laybyState(layby);
  const nonPayment = laybyCancellableForNonPayment(layby);
  const box = "rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5";

  return (
    <div className="max-w-5xl">
      <Link href="/admin/laybys" className="text-sm text-[var(--muted)] hover:underline">
        ← Laybys
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-[family-name:var(--font-oswald)] text-3xl uppercase">{layby.id}</h1>
        <LaybyStatePill layby={layby} />
        <Link href={`/admin/orders/${layby.order_id}`} className="text-sm underline">
          Order {layby.order_id}
        </Link>
        <a href={`/api/layby/${layby.id}/pdf`} target="_blank" rel="noreferrer" className="text-sm underline">
          Agreement / statement PDF
        </a>
      </div>

      {state === "paid" ? (
        <p className="mt-4 rounded-lg bg-[rgba(94,255,56,0.18)] p-3 text-sm">
          <strong>Paid in full {day(layby.completed_at)}.</strong> It is now a normal order: pack and send once the last payment has cleared.
        </p>
      ) : state === "cancelled" ? (
        <p className="mt-4 rounded-lg bg-neutral-100 p-3 text-sm">
          Cancelled {day(layby.cancelled_at)} by {layby.cancelled_by ?? "staff"}: {layby.cancel_reason}. Fee {formatPrice(Number(layby.cancel_fee ?? 0))},
          refund {formatPrice(Number(layby.refund_amount ?? 0))}
          {layby.refund_done_at ? ` — refunded ${day(layby.refund_done_at)} by ${layby.refund_done_by}.` : " — not refunded yet."}
        </p>
      ) : (
        <p className="mt-4 rounded-lg bg-[#fff7e0] p-3 text-sm">
          <strong>Do not pack or send.</strong> Stock is reserved for this customer until the layby is paid in full or cancelled.
        </p>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <section className={`${box} lg:col-span-2`}>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            {[
              ["Total (fixed)", formatPrice(Number(layby.total))],
              ["Paid", formatPrice(Number(layby.paid))],
              ["Balance", formatPrice(balance)],
              ["Opened", day(layby.opened_at)],
              ["Last payment", day(layby.last_payment_at)],
              ["Pay in full by", day(layby.final_due_at)],
              ["Deposit (20%)", formatPrice(plan.deposit)],
              ["Monthly plan", `${formatPrice(plan.monthly)} × 3`],
              ["Agreement accepted", when(layby.accepted_at)],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="text-xs uppercase tracking-wider text-[var(--muted)]">{k}</div>
                <div className="font-semibold tabular-nums">{v}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-neutral-200">
            <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.min(100, (Number(layby.paid) / Number(layby.total)) * 100)}%` }} />
          </div>

          <h2 className="mt-6 text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Reserved items</h2>
          <ul className="mt-2 divide-y divide-[var(--border)] text-sm">
            {items.map((i) => (
              <li key={`${i.code}-${i.size}`} className="flex justify-between gap-4 py-2">
                <span>
                  {i.name.replace(/\s*·\s*[\w.-]+$/, "")}
                  <span className="block text-xs text-[var(--muted)]">
                    {i.code} · size {i.size} · ×{i.qty}
                  </span>
                </span>
                <span className="tabular-nums">{formatPrice(i.unit_price * i.qty)}</span>
              </li>
            ))}
          </ul>
          {order ? (
            <p className="mt-2 text-xs text-[var(--muted)]">
              Delivery: {order.shipping_method}
              {order.address && order.address !== "Hub pickup" ? ` to ${order.address}, ${order.city}` : ""}
            </p>
          ) : null}

          <h2 className="mt-6 text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Payments</h2>
          <ul className="mt-2 divide-y divide-[var(--border)] text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex justify-between gap-4 py-2">
                <span>
                  {when(p.created_at)} · {p.kind === "deposit" ? "Deposit" : "Payment"} · {p.method.toUpperCase()}
                  {p.recorded_by ? ` · by ${p.recorded_by}` : ""}
                </span>
                <span className="font-semibold tabular-nums">{formatPrice(Number(p.amount))}</span>
              </li>
            ))}
          </ul>

          <h2 className="mt-6 text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Emails sent</h2>
          <ul className="mt-2 text-xs text-[var(--muted)]">
            {notes.map((n) => (
              <li key={n.id}>
                {when(n.created_at)} · {n.kind} · {n.sent_at ? "sent" : n.error ? `failed: ${n.error}` : "waiting"}
              </li>
            ))}
          </ul>
        </section>

        <aside className="flex flex-col gap-4">
          <section className={box}>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Customer</h2>
            <p className="mt-2 font-semibold">{layby.name}</p>
            <p className="text-sm">
              <a href={`mailto:${layby.email}`} className="underline">
                {layby.email}
              </a>
            </p>
            {layby.phone ? (
              <p className="mt-1 flex gap-3 text-sm">
                <a href={`tel:${layby.phone}`} className="underline">
                  {layby.phone}
                </a>
                <a href={`https://wa.me/${layby.phone.replace(/\D/g, "").replace(/^0/, "264")}`} target="_blank" rel="noreferrer" className="underline">
                  WhatsApp
                </a>
              </p>
            ) : null}
          </section>

          {layby.status === "active" ? (
            <>
              <section className={box}>
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Record a payment taken in store</h2>
                <div className="mt-3 flex gap-2">
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                    inputMode="decimal"
                    placeholder={`Up to ${balance.toFixed(2)}`}
                    className="h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm"
                  />
                  <select value={method} onChange={(e) => setMethod(e.target.value as "cash" | "eft")} className="h-10 rounded-lg border border-[var(--border)] bg-white px-2 text-sm">
                    <option value="cash">Cash</option>
                    <option value="eft">EFT</option>
                  </select>
                </div>
                <button
                  type="button"
                  disabled={busy || !(Number(amount) > 0)}
                  onClick={() => void act({ action: "payment", amount: Number(amount), method }, "Payment recorded and receipt emailed.")}
                  className="mt-2 h-10 w-full rounded-full bg-[var(--accent)] text-sm font-semibold text-[#0c110b] disabled:opacity-40"
                >
                  Record payment
                </button>
                <p className="mt-2 text-xs text-[var(--muted)]">EFT: only once the money shows in the bank.</p>
              </section>

              <section className={box}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act({ action: "remind" }, "Reminder emailed.")}
                  className="h-10 w-full rounded-full border border-[var(--border)] text-sm font-semibold disabled:opacity-40"
                >
                  Send payment reminder
                </button>
              </section>

              <section className={box}>
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--danger)]">Cancel layby</h2>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Fee 30% of total, capped at amount paid: <strong>{formatPrice(cancel.fee)}</strong>. Refund due: <strong>{formatPrice(cancel.refund)}</strong>. Stock goes back on the shelf.
                  {nonPayment ? " This layby qualifies for cancellation for non-payment." : " Only cancel early if the customer asked (in writing) or after the warning email."}
                </p>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason (e.g. customer asked by WhatsApp)"
                  className="mt-3 h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm"
                />
                {confirmCancel ? (
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={busy || !reason.trim()}
                      onClick={() => void act({ action: "cancel", reason }, "Layby cancelled; customer emailed.")}
                      className="h-10 flex-1 rounded-full bg-[var(--danger)] text-sm font-semibold text-white disabled:opacity-40"
                    >
                      Yes, cancel
                    </button>
                    <button type="button" onClick={() => setConfirmCancel(false)} className="h-10 flex-1 rounded-full border border-[var(--border)] text-sm">
                      Keep it
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={busy || !reason.trim()}
                    onClick={() => setConfirmCancel(true)}
                    className="mt-2 h-10 w-full rounded-full border border-[var(--danger)] text-sm font-semibold text-[var(--danger)] disabled:opacity-40"
                  >
                    Cancel layby…
                  </button>
                )}
              </section>
            </>
          ) : null}

          {layby.status === "cancelled" && !layby.refund_done_at && Number(layby.refund_amount) > 0 ? (
            <section className={box}>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Refund</h2>
              <p className="mt-2 text-sm">
                Refund <strong>{formatPrice(Number(layby.refund_amount))}</strong> the way they paid (card refunds in the DPO dashboard), then mark it done.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void act({ action: "refund_done" }, "Refund marked as done.")}
                className="mt-3 h-10 w-full rounded-full bg-[var(--accent)] text-sm font-semibold text-[#0c110b] disabled:opacity-40"
              >
                Refund done
              </button>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
