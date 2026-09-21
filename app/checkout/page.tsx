"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocale } from "@/components/locale-provider";
import { shippingMethodsSnapshot } from "@/lib/shipping";
import { shippingName } from "@/lib/i18n/labels";
import { sizeDisplayLabel } from "@/lib/product-stock";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { feedVariantId } from "@/lib/meta/ids";
import { trackMeta } from "@/lib/meta/pixel";
import { useAuth } from "@/lib/stores/auth";
import { cartCount, useCart } from "@/lib/stores/cart";
import type { Order } from "@/lib/types";

type ShippingRow = { id: string; name: string; cost: number };

const FALLBACK_SHIPPING: ShippingRow[] = shippingMethodsSnapshot();

export default function CheckoutPage() {
  const router = useRouter();
  const lines = useCart((s) => s.lines);
  const user = useAuth((s) => s.user);
  const { t, format, market } = useLocale();
  const [shippingOptions, setShippingOptions] = useState<ShippingRow[]>(FALLBACK_SHIPPING);
  const [submitting, setSubmitting] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [method, setMethod] = useState(FALLBACK_SHIPPING[0].id);
  const [notes, setNotes] = useState("");
  const checkoutTracked = useRef(false);

  useEffect(() => {
    setAuthReady(true);
  }, []);

  useEffect(() => {
    if (checkoutTracked.current || !lines.length) return;
    checkoutTracked.current = true;
    const contents = lines.map((line) => ({
      id: feedVariantId(line.code, line.size),
      quantity: line.qty,
      item_price: line.price,
    }));
    trackMeta("InitiateCheckout", {
      currency: "NAD",
      value: lines.reduce((sum, line) => sum + line.price * line.qty, 0),
      content_type: "product",
      content_ids: contents.map((item) => item.id),
      contents,
      num_items: cartCount(lines),
    });
  }, [lines]);

  useEffect(() => {
    if (!user) return;
    setName((prev) => prev || user.name || "");
    setEmail((prev) => prev || user.email || "");
  }, [user]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    void supabase
      .from("shipping_methods")
      .select("id, name, cost")
      .order("sort_order")
      .then(({ data }) => {
        if (data?.length) {
          const byId = new Map(FALLBACK_SHIPPING.map((m) => [m.id, m.cost]));
          setShippingOptions(
            data.map((d) => ({
              ...d,
              cost: byId.has(d.id) ? byId.get(d.id)! : Number(d.cost),
            })),
          );
        }
      });
  }, []);

  const rows = useMemo(
    () =>
      lines.map((line) => ({
        code: line.code,
        name: line.name,
        size: line.size,
        qty: line.qty,
        price: line.price,
      })) as Order["items"],
    [lines],
  );

  const subtotal = rows.reduce((s, r) => s + r.price * r.qty, 0);
  const shipping = shippingOptions.find((s) => s.id === method) ?? shippingOptions[0];
  const total = subtotal + (shipping?.cost ?? 0);
  const pickup = method === "pickup";
  const addressRequired = !pickup;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!rows.length) {
      toast.error(t("checkout.cartEmpty"));
      return;
    }
    if (!user) {
      toast.error(t("checkout.signInRequired"));
      router.push("/login?next=/checkout");
      return;
    }
    if (!name || !email) {
      toast.error(t("checkout.completeNameEmail"));
      return;
    }
    if (addressRequired && (!address || !city || !country)) {
      toast.error(t("checkout.completeDetails"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/payments/dpo/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          address,
          city,
          country,
          notes,
          shippingMethod: shipping.id,
          lines: lines.map((line) => ({
            code: line.code,
            size: line.size,
            qty: line.qty,
          })),
        }),
      });
      const raw = await res.text();
      let data: { paymentUrl?: string; error?: string } = {};
      try {
        data = raw ? (JSON.parse(raw) as { paymentUrl?: string; error?: string }) : {};
      } catch {
        toast.error(t("checkout.failed"));
        return;
      }
      if (res.status === 401) {
        toast.error(t("checkout.signInRequired"));
        router.push("/login?next=/checkout");
        return;
      }
      if (!res.ok || !data.paymentUrl) {
        toast.error(friendlyCheckoutError(data.error, t("checkout.failed")));
        return;
      }
      window.location.href = data.paymentUrl;
    } catch {
      toast.error(t("checkout.failed"));
    } finally {
      setSubmitting(false);
    }
  }

  if (!rows.length) {
    return (
      <div className="page-shell py-8">
        <Breadcrumbs
          items={[
            { href: "/", label: t("common.home") },
            { href: "/cart", label: t("cart.crumb") },
            { label: t("checkout.crumb") },
          ]}
        />
        <h1 className="mt-4 font-[family-name:var(--font-oswald)] text-3xl uppercase sm:text-4xl">
          {t("checkout.title")}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">
          {t("checkout.emptyHint", {
            standard: format(100),
            express: format(150),
          })}
        </p>
        <section className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider">{t("checkout.shippingOptions")}</h2>
          <ul className="mt-4 space-y-2">
            {shippingOptions.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-xl border border-[var(--border)] px-3 py-3 text-sm"
              >
                <span>{shippingName(s.id, s.name, t)}</span>
                <span className="font-semibold">{s.cost ? format(s.cost) : t("common.free")}</span>
              </li>
            ))}
          </ul>
        </section>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/cart">{t("checkout.backToCart")}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">{t("common.continueShopping")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (authReady && !user) {
    return (
      <div className="page-shell py-8">
        <Breadcrumbs
          items={[
            { href: "/", label: t("common.home") },
            { href: "/cart", label: t("cart.crumb") },
            { label: t("checkout.crumb") },
          ]}
        />
        <h1 className="mt-4 font-[family-name:var(--font-oswald)] text-3xl uppercase sm:text-4xl">
          {t("checkout.title")}
        </h1>
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8">
            <h2 className="font-[family-name:var(--font-oswald)] text-2xl uppercase">
              {t("checkout.signInTitle")}
            </h2>
            <p className="mt-3 max-w-xl text-sm text-[var(--muted)]">
              {t("checkout.signInBody")}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/login?next=/checkout">{t("checkout.signInCta")}</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/login?next=/checkout">{t("checkout.createAccountCta")}</Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-[var(--muted-2)]">{t("checkout.browseOk")}</p>
          </section>
          <aside className="h-fit rounded-xl border border-[var(--accent)]/25 bg-[var(--surface)] p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider">{t("checkout.summary")}</h2>
            <ul className="mt-4 divide-y divide-[var(--border)] text-sm">
              {rows.map((r) => (
                <li key={`${r.code}-${r.size}`} className="flex flex-col gap-1 py-2 sm:flex-row sm:justify-between">
                  <span className="break-all">
                    {r.code} · {sizeDisplayLabel(r.size, t)} × {r.qty}
                  </span>
                  <span className="shrink-0">{format(r.price * r.qty)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 flex justify-between text-lg font-semibold">
              <span>{t("checkout.total")}</span>
              <span>{format(total)}</span>
            </p>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell py-8">
      <Breadcrumbs
        items={[
          { href: "/", label: t("common.home") },
          { href: "/cart", label: t("cart.crumb") },
          { label: t("checkout.crumb") },
        ]}
      />
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-oswald)] text-3xl uppercase sm:text-4xl">
            {t("checkout.title")}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">
            {market === "eu" ? t("checkout.introEur") : t("checkout.introNad")}
          </p>
        </div>
      </div>

      <form id="checkout-form" onSubmit={onSubmit} className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-4">
          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider">{t("checkout.address")}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label={t("checkout.fullName")}>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </Field>
              <Field label={t("checkout.email")}>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </Field>
              <div className="sm:col-span-2">
                <Field label={t("checkout.street")}>
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required={addressRequired}
                  />
                </Field>
              </div>
              <Field label={t("checkout.city")}>
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required={addressRequired}
                />
              </Field>
              <Field label={t("checkout.country")}>
                <Input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  required={addressRequired}
                />
              </Field>
            </div>
          </section>
          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider">{t("checkout.method")}</h2>
            <div className="mt-4 space-y-2">
              {shippingOptions.map((s) => (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-center justify-between rounded-xl border border-[var(--border)] px-3 py-3 transition-colors has-[:checked]:border-[var(--accent)]"
                >
                  <span className="flex items-center gap-3 text-sm">
                    <input
                      type="radio"
                      name="ship"
                      checked={method === s.id}
                      onChange={() => setMethod(s.id)}
                    />
                    {shippingName(s.id, s.name, t)}
                  </span>
                  <span className="text-sm font-semibold">
                    {s.cost ? format(s.cost) : t("common.free")}
                  </span>
                </label>
              ))}
            </div>
          </section>
          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <Label>{t("checkout.notes")}</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-2 h-24 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 text-sm"
              placeholder={t("common.optional")}
            />
          </section>
        </div>

        <aside className="h-fit rounded-xl border border-[var(--accent)]/25 bg-[var(--surface)] p-5 lg:sticky lg:top-28">
          <h2 className="text-sm font-bold uppercase tracking-wider">{t("checkout.summary")}</h2>
          <ul className="mt-4 divide-y divide-[var(--border)] text-sm">
            {rows.map((r) => (
              <li key={`${r.code}-${r.size}`} className="flex flex-col gap-1 py-2 sm:flex-row sm:justify-between">
                <span className="break-all">
                    {r.code} · {sizeDisplayLabel(r.size, t)} × {r.qty}
                </span>
                <span className="shrink-0">{format(r.price * r.qty)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-1 text-sm">
            <p className="flex justify-between text-[var(--muted)]">
              <span>{t("checkout.merchandise")}</span>
              <span>{format(subtotal)}</span>
            </p>
            <p className="flex justify-between text-[var(--muted)]">
              <span>{t("checkout.shipping")}</span>
              <span>{shipping.cost ? format(shipping.cost) : t("common.free")}</span>
            </p>
            <p className="flex justify-between pt-2 text-lg font-semibold">
              <span>{t("checkout.total")}</span>
              <span>{format(total)}</span>
            </p>
          </div>
          <Button
            type="submit"
            size="lg"
            className="mt-6 hidden w-full md:inline-flex"
            disabled={submitting || !user}
          >
            {submitting ? t("checkout.payingDpo") : t("checkout.payDpo")}
          </Button>
          <p className="mt-3 hidden text-center text-xs text-[var(--muted-2)] md:block">
            {market === "eu" ? t("checkout.totalsEur") : t("checkout.totalsNad")}
          </p>
        </aside>
      </form>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[var(--header-bg-scrolled)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-[1440px] items-center gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-[var(--muted)]">{t("checkout.total")}</p>
            <p className="price text-lg font-semibold">{format(total)}</p>
          </div>
          <Button
            type="submit"
            form="checkout-form"
            size="lg"
            className="min-w-0 flex-1"
            disabled={submitting || !user}
          >
            {submitting ? t("checkout.payingDpo") : t("checkout.payDpo")}
          </Button>
        </div>
      </div>
      <div className="h-24 md:hidden" />
    </div>
  );
}

function friendlyCheckoutError(error: string | undefined, fallback: string) {
  const text = (error ?? "").trim();
  if (!text || /^fetch failed$/i.test(text) || /failed to fetch/i.test(text)) {
    return fallback;
  }
  return text;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <Label>{label}</Label>
      {children}
    </label>
  );
}
