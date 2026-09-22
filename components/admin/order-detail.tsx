"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatDate, formatPrice } from "@/lib/format";
import { ORDER_STATUSES, orderStatusClass } from "@/lib/order-status";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";

type Order = Database["public"]["Tables"]["orders"]["Row"];
type OrderItem = Database["public"]["Tables"]["order_items"]["Row"] & {
  products?: {
    id: string;
    item: string | null;
    image_url: string | null;
  } | null;
};
type Status = Database["public"]["Enums"]["order_status"];

const STEPS: Status[] = [...ORDER_STATUSES];

export function OrderDetail({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [emailing, setEmailing] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      const [{ data: o }, { data: lines }] = await Promise.all([
        supabase.from("orders").select("*").eq("id", orderId).single(),
        supabase
          .from("order_items")
          .select("*, products(id, item, image_url)")
          .eq("order_id", orderId),
      ]);
      if (!o) {
        toast.error("Order not found");
        router.push("/admin/orders");
        return;
      }
      setOrder(o);
      setNotes(o.notes ?? "");
      setItems(lines ?? []);
      setLoading(false);
    })();
  }, [orderId, router]);

  async function setStatus(status: Status) {
    if (!order) return;
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("set_order_status", {
      p_order_id: order.id,
      p_status: status,
    });
    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }
    setOrder(data as Order);
    toast.success(`Status → ${status}`);
    setSaving(false);
    router.refresh();
  }

  async function saveNotes() {
    if (!order) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("orders")
      .update({ notes })
      .eq("id", order.id);
    if (error) toast.error(error.message);
    else toast.success("Notes saved");
    setSaving(false);
  }

  async function emailInvoice() {
    if (!order) return;
    setEmailing(true);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(order.id)}/invoice`, {
        method: "POST",
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(body.error || "Could not email the invoice.");
        return;
      }
      setOrder({ ...order, invoice_sent_at: new Date().toISOString(), invoice_last_error: null });
      toast.success("Invoice emailed");
    } catch {
      toast.error("Could not email the invoice.");
    } finally {
      setEmailing(false);
    }
  }

  if (loading || !order) {
    return <p className="text-[var(--muted)]">Loading…</p>;
  }

  return (
    <div>
      <Link
        href="/admin/orders"
        className="text-xs uppercase tracking-wider text-[var(--muted)] hover:text-[var(--accent)]"
      >
        ← Orders
      </Link>
      <h1 className="mt-2 break-all font-mono text-2xl font-bold text-[var(--accent)] sm:text-3xl">{order.id}</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">{formatDate(order.created_at)}</p>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {order.invoice_sent_at
          ? `Invoice emailed ${formatDate(order.invoice_sent_at)}`
          : "Invoice not emailed yet"}
        {order.invoice_last_error ? ` — ${order.invoice_last_error}` : ""}
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {STEPS.map((s) => (
          <Button
            key={s}
            type="button"
            size="sm"
            variant="outline"
            disabled={saving}
            onClick={() => void setStatus(s)}
            className={`uppercase tracking-wider ${
              order.status === s
                ? `border-current ${orderStatusClass(s)}`
                : "text-[var(--muted)]"
            }`}
          >
            {s}
          </Button>
        ))}
        <Button size="sm" variant="outline" asChild>
          <a href={`/api/orders/${encodeURIComponent(order.id)}/invoice`}>Download invoice</a>
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={saving || emailing}
          onClick={() => void emailInvoice()}
        >
          {emailing ? "Emailing…" : "Email invoice"}
        </Button>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider">Ship to</h2>
          <p className="mt-3 text-sm leading-6">
            {order.full_name}
            <br />
            {order.address}
            <br />
            {order.city}, {order.country}
            <br />
            {order.email}
          </p>
          <p className="mt-3 text-sm text-[var(--muted)]">{order.shipping_method}</p>
        </section>
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider">Totals</h2>
          <p className="mt-3 flex justify-between text-sm">
            <span>Merchandise</span>
            <span>{formatPrice(Number(order.subtotal))}</span>
          </p>
          <p className="flex justify-between text-sm">
            <span>Shipping</span>
            <span>{formatPrice(Number(order.shipping_cost))}</span>
          </p>
          <p className="flex justify-between text-sm">
            <span>VAT {Number(order.vat_rate) || 0}%</span>
            <span>{formatPrice(Number(order.vat_amount) || 0)}</span>
          </p>
          <p className="mt-2 flex justify-between text-lg font-semibold">
            <span>Total</span>
            <span>{formatPrice(Number(order.total))}</span>
          </p>
        </section>
      </div>

      <section className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider">Items</h2>
        <ul className="mt-3 divide-y divide-[var(--border)]">
          {items.map((item) => {
            const product = item.products;
            const row = (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product?.image_url || "/brand/rappi-logo-v2.png"}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-lg bg-[var(--bg-elevated)] object-cover"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-sm font-bold">{item.code}</span>
                  <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">
                    {product?.item || item.name}
                  </span>
                  <span className="mt-1 block text-xs text-[var(--muted)]">
                    {item.size} × {item.qty}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold">
                  {formatPrice(Number(item.unit_price) * item.qty)}
                </span>
              </>
            );
            return (
              <li key={item.id} className="py-3">
                {product?.id ? (
                  <Link
                    href={`/admin/products/${product.id}`}
                    className="flex items-center gap-3 hover:text-[var(--accent)]"
                  >
                    {row}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3">{row}</div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider">Notes</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-3 h-24 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 text-sm"
        />
        <Button type="button" className="mt-3" disabled={saving} onClick={() => void saveNotes()}>
          Save notes
        </Button>
      </section>
    </div>
  );
}
