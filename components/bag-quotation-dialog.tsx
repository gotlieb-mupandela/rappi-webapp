"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useLocale } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { surtidoSizeLabel } from "@/lib/assortment";
import { sizeDisplayLabel } from "@/lib/product-stock";
import { useAuth } from "@/lib/stores/auth";
import { cartCount, cartLineAsProduct } from "@/lib/stores/cart";
import type { CartLine } from "@/lib/types";

type QuoteSession = { id: string; token: string };

type QuotationResponse = {
  ok?: boolean;
  error?: string;
  code?: string;
  id?: string;
  token?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function filenameFromDisposition(header: string | null) {
  const match = header?.match(/filename="([^"]+)"/);
  return match?.[1] || "quotation.pdf";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function BagQuotationDialog({
  open,
  onClose,
  lines,
}: {
  open: boolean;
  onClose: () => void;
  lines: CartLine[];
}) {
  const { t, format } = useLocale();
  const userEmail = useAuth((s) => s.user?.email ?? "");
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [session, setSession] = useState<QuoteSession | null>(null);
  const [pending, setPending] = useState<"download" | "email" | null>(null);
  const [notice, setNotice] = useState("");
  const count = cartCount(lines);
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.qty, 0);
  const signature = lines
    .map((line) => `${line.code}\u0000${line.size}\u0000${line.qty}\u0000${line.price}`)
    .join("\n");

  const rows = useMemo(
    () =>
      lines.map((line) => ({
        key: `${line.code}-${line.size}`,
        code: line.code,
        name: line.name,
        size: surtidoSizeLabel(cartLineAsProduct(line), line.size, t) ?? sizeDisplayLabel(line.size, t),
        qty: line.qty,
        total: format(line.price * line.qty),
      })),
    [format, lines, t],
  );

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) {
      setSession(null);
      setNotice("");
      setPending(null);
      return;
    }
    setEmail((prev) => prev || userEmail);
  }, [open, userEmail]);

  useEffect(() => {
    setSession(null);
    setNotice("");
  }, [signature]);

  useEffect(() => {
    if (!open) return;
    const previously = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = [
        ...panelRef.current.querySelectorAll<HTMLElement>("button, input, [href], [tabindex]"),
      ].filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previously?.focus();
    };
  }, [open]);

  function messageFor(json: QuotationResponse) {
    switch (json.code) {
      case "rate_limit":
        return t("cart.quotationRateLimit");
      case "invalid_email":
        return t("cart.quotationEmailInvalid");
      case "email_unavailable":
        return t("cart.quotationEmailUnavailable");
      case "email_failed":
        return t("cart.quotationEmailFailed");
      case "not_found":
        return t("cart.quotationNotFound");
      case "cart":
        return json.error || t("cart.quotationFailed");
      default:
        return json.error || t("cart.quotationFailed");
    }
  }

  function remember(json: QuotationResponse) {
    if (json.id && json.token) setSession({ id: json.id, token: json.token });
  }

  async function request(delivery: "download" | "email") {
    if (!lines.length || pending) return;
    if (delivery === "email" && !EMAIL_RE.test(email.trim())) {
      toast.error(t("cart.quotationEmailInvalid"));
      return;
    }
    setPending(delivery);
    setNotice("");
    try {
      const res = await fetch("/api/cart/quotation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: lines.map((line) => ({ code: line.code, size: line.size, qty: line.qty })),
          delivery,
          email: delivery === "email" ? email.trim() : undefined,
          quoteId: session?.id,
          token: session?.token,
        }),
      });
      const type = res.headers.get("content-type") || "";
      if (type.includes("application/pdf")) {
        const id = res.headers.get("X-Quote-Id");
        const token = res.headers.get("X-Quote-Token");
        if (id && token) setSession({ id, token });
        const blob = await res.blob();
        downloadBlob(blob, filenameFromDisposition(res.headers.get("Content-Disposition")));
        const downloaded = t("cart.quotationDownloaded");
        setNotice(downloaded);
        toast.success(downloaded);
        return;
      }
      const json = (await res.json().catch(() => ({}))) as QuotationResponse;
      remember(json);
      if (!res.ok) {
        toast.error(messageFor(json));
        return;
      }
      const sent = t("cart.quotationSent", { email: email.trim() });
      setNotice(sent);
      toast.success(sent);
    } catch {
      toast.error(t("cart.quotationFailed"));
    } finally {
      setPending(null);
    }
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/45 p-3 sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bag-quotation-title"
        tabIndex={-1}
        className="max-h-[min(100dvh-1.5rem,44rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)] outline-none sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="bag-quotation-title"
              className="font-[family-name:var(--font-oswald)] text-3xl font-bold uppercase tracking-wide text-[var(--text-secondary)]"
            >
              {t("cart.quotationTitle")}
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {count ? t.plural("count.pieces", count) : t("cart.empty")}
              <span className="mx-2 text-[var(--border-strong)]">·</span>
              {t("cart.subtotal", { amount: format(subtotal) })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 items-center rounded-full px-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)] hover:bg-[var(--hover)] hover:text-ink"
          >
            {t("cart.quotationClose")}
          </button>
        </div>

        <p className="mt-4 text-sm leading-6 text-ink">{t("cart.quotationIntro")}</p>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t("cart.quotationNote")}</p>

        {session ? (
          <p className="mt-4 font-mono text-sm font-semibold text-ink">
            {t("cart.quotationNumber", { id: session.id })}
          </p>
        ) : null}

        <ul className="mt-4 max-h-40 space-y-2 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
          {rows.map((row) => (
            <li key={row.key} className="flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="font-mono font-semibold">{row.code}</p>
                <p className="truncate text-xs uppercase tracking-wider text-[var(--muted)]">{row.name}</p>
                <p className="text-xs text-[var(--muted)]">
                  {t("cart.size")} {row.size}
                  <span className="mx-1.5 text-[var(--border-strong)]">·</span>
                  {t("cart.qty")} {row.qty}
                </p>
              </div>
              <p className="shrink-0 font-semibold">{row.total}</p>
            </li>
          ))}
        </ul>

        {notice ? (
          <p className="mt-4 text-sm font-medium text-ink" aria-live="polite">
            {notice}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-3">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            disabled={!lines.length || pending !== null}
            onClick={() => void request("download")}
          >
            {pending === "download" ? t("cart.quotationPreparing") : t("cart.downloadQuotation")}
          </Button>

          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void request("email");
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="quotation-email">{t("cart.quotationEmail")}</Label>
              <Input
                id="quotation-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                placeholder={t("cart.quotationEmailPlaceholder")}
                onChange={(event) => setEmail(event.target.value)}
                disabled={pending !== null}
                required
              />
              <p className="text-xs leading-5 text-[var(--muted)]">{t("cart.quotationEmailHint")}</p>
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={!lines.length || pending !== null}>
              {pending === "email" ? t("cart.quotationSending") : t("cart.emailQuotation")}
            </Button>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}
