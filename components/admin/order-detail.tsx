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
type Notification = Pick<
  Database["public"]["Tables"]["order_notifications"]["Row"],
  "id" | "kind" | "recipient" | "sent_at" | "error" | "created_at"
>;

const NOTIFICATION_LABEL: Record<string, string> = {
  paid: "Payment received + receipt",
  preparing: "Preparing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  staff_new_order: "Staff: new order alert",
};

function dueLabel(order: Order) {
  if (!order.due_at) return null;
  const due = new Date(order.due_at);
  const open = order.status === "reserved" || order.status === "preparing";
  const late = open && due.getTime() < Date.now();
  const text = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Africa/Windhoek",
  }).format(due);
  return { text, late };
}

const STEPS: Status[] = [...ORDER_STATUSES];

export function OrderDetail({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [shipping, setShipping] = useState(false);
  const [courier, setCourier] = useState("");
  const [tracking, setTracking] = useState("");

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      const [{ data: o }, { data: lines }, { data: sent }] = await Promise.all([
        supabase.from("orders").select("*").eq("id", orderId).single(),
        supabase
          .from("order_items")
          .select("*, products(id, item, image_url)")
          .eq("order_id", orderId),
        supabase
          .from("order_notifications")
          .select("id, kind, recipient, sent_at, error, created_at")
          .eq("order_id", orderId)
          .order("created_at", { ascending: true }),
      ]);
      if (!o) {
        toast.error("Order not found");
        router.push("/admin/orders");
        return;
      }
      setOrder(o);
      setNotes(o.notes ?? "");
      setItems(lines ?? []);
      setNotifications(sent ?? []);
      setCourier(o.courier ?? "");
      setTracking(o.tracking_number ?? "");
      setLoading(false);
    })();
  }, [orderId, router]);

  async function reloadNotifications() {
    const supabase = createClient();
    const { data } = await supabase
      .from("order_notifications")
      .select("id, kind, recipient, sent_at, error, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });
    setNotifications(data ?? []);
  }

  async function setStatus(status: Status, extra?: { courier?: string; tracking?: string }) {
    if (!order) return;
    if (status === order.status && !extra) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(order.id)}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...extra }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        order?: Order;
        email?: { sent: boolean; skipped?: string; error?: string };
      };
      if (!res.ok || !body.order) {
        toast.error(body.error || "Could not update the order.");
        return;
      }
      setOrder(body.order);
      setShipping(false);
      const email = body.email;
      if (email?.sent) toast.success(`Status → ${status}. Customer emailed.`);
      else if (email?.error) toast.error(`Status → ${status}, but the email failed: ${email.error}`);
      else if (email?.skipped === "already_sent") toast.success(`Status → ${status}. Email was already sent before.`);
      else toast.success(`Status → ${status}`);
      await reloadNotifications();
      router.refresh();
    } catch {
      toast.error("Could not update the order.");
    } finally {
      setSaving(false);
    }
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

  const due = dueLabel(order);

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
        {order.invoice_last_error ? `: ${order.invoice_last_error}` : ""}
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {STEPS.map((s) => (
          <Button
            key={s}
            type="button"
            size="sm"
            variant="outline"
            disabled={saving}
            onClick={() => (s === "shipped" ? setShipping(true) : void setStatus(s))}
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

      {shipping ? (
        <form
          className="mt-4 grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void setStatus("shipped", { courier, tracking });
          }}
        >
          <label className="text-xs uppercase tracking-wider text-[var(--muted)]">
            Courier (optional)
            <input
              value={courier}
              onChange={(e) => setCourier(e.target.value)}
              maxLength={80}
              placeholder="e.g. Nampost Courier"
              className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm normal-case tracking-normal text-[var(--text)]"
            />
          </label>
          <label className="text-xs uppercase tracking-wider text-[var(--muted)]">
            Tracking number (optional)
            <input
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              maxLength={80}
              className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm normal-case tracking-normal text-[var(--text)]"
            />
          </label>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Saving…" : "Mark shipped & email"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setShipping(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      <p className="mt-4 text-xs text-[var(--muted)]">
        Changing the status emails the customer once per status (Preparing, Shipped, Delivered, Cancelled).
      </p>

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
            {order.phone ? (
              <>
                <br />
                {order.phone}
              </>
            ) : null}
          </p>
          <p className="mt-3 text-sm text-[var(--muted)]">{order.shipping_method}</p>
          {due ? (
            <p className={`mt-1 text-sm font-semibold ${due.late ? "text-[var(--danger)]" : ""}`}>
              {due.late ? "LATE: was due " : "Due by "}
              {due.text}
            </p>
          ) : null}
          {order.courier || order.tracking_number ? (
            <p className="mt-1 text-sm text-[var(--muted)]">
              {[order.courier, order.tracking_number].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </section>
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider">Totals</h2>
          <p className="mt-3 flex justify-between text-sm">
            <span>Merchandise</span>
            <span>{formatPrice(Number(order.subtotal))}</span>
          </p>
          {Number(order.discount_amount) > 0 ? (
            <p className="flex justify-between text-sm">
              <span>Discount{order.discount_code ? ` (${order.discount_code})` : ""}</span>
              <span>-{formatPrice(Number(order.discount_amount))}</span>
            </p>
          ) : null}
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
        <h2 className="text-sm font-bold uppercase tracking-wider">Emails sent</h2>
        {notifications.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">No emails logged for this order yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--border)] text-sm">
            {notifications.map((n) => (
              <li key={n.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  <span className="font-semibold">{NOTIFICATION_LABEL[n.kind] ?? n.kind}</span>
                  <span className="block text-xs text-[var(--muted)]">{n.recipient}</span>
                </span>
                <span className={`text-xs ${n.error ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}>
                  {n.sent_at ? `Sent ${formatDate(n.sent_at)}` : n.error ? `Failed: ${n.error}` : "Sending…"}
                </span>
              </li>
            ))}
          </ul>
        )}
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
