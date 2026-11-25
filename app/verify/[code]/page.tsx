import type { Metadata } from "next";
import Link from "next/link";
import { readQuotationItems } from "@/lib/bag-quotation";
import { parseDocumentVerifyCode } from "@/lib/document-verify";
import { formatChargeNad } from "@/lib/format";
import { formatInvoiceDate } from "@/lib/invoice-pdf";
import { quotationValidUntil } from "@/lib/quotation-pdf";
import { contactEmail } from "@/lib/site-contact";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verify a document",
  robots: { index: false, follow: false },
};

type Line = { label: string; detail: string; amount: number };
type Fact = { label: string; value: string };
type Verified = {
  title: string;
  facts: Fact[];
  status: { text: string; tone: "ok" | "warn" | "danger" };
  lines: Line[];
  extras: { label: string; amount: number }[];
  total: { label: string; amount: number };
};

const ORDER_STATUS_TEXT: Record<string, string> = {
  reserved: "Order received",
  preparing: "Being prepared",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

function shortName(full: string) {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "-";
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
}

async function loadOrder(id: string): Promise<Verified | null> {
  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("*").ilike("id", id).maybeSingle();
  if (!order) return null;
  const [{ data: items }, { data: paid }] = await Promise.all([
    admin.from("order_items").select("code, name, size, qty, unit_price").eq("order_id", order.id).order("code"),
    admin.from("payments").select("id").eq("order_id", order.id).eq("status", "paid").limit(1),
  ]);
  const isPaid = Boolean(paid?.length);
  const stage = ORDER_STATUS_TEXT[order.status] ?? order.status;
  const cancelled = order.status === "cancelled";
  const discount = Number(order.discount_amount) || 0;
  return {
    title: isPaid ? "Receipt / Tax invoice" : "Order",
    facts: [
      { label: "Number", value: order.id.toUpperCase() },
      { label: "Date", value: formatInvoiceDate(order.created_at) },
      { label: "Customer", value: shortName(order.full_name) },
      { label: "Shipping", value: order.shipping_method },
    ],
    status: {
      text: cancelled ? "Cancelled" : isPaid ? `Paid · ${stage}` : `Not paid · ${stage}`,
      tone: cancelled ? "danger" : isPaid ? "ok" : "warn",
    },
    lines: (items ?? []).map((item) => ({
      label: item.name,
      detail: `${item.size} × ${item.qty}`,
      amount: Number(item.unit_price) * item.qty,
    })),
    extras: [
      ...(discount > 0 ? [{ label: `Discount${order.discount_code ? ` ${order.discount_code}` : ""}`, amount: -discount }] : []),
      { label: "Shipping", amount: Number(order.shipping_cost) },
      { label: `VAT (${Number(order.vat_rate) || 0}%)`, amount: Number(order.vat_amount) || 0 },
    ],
    total: { label: isPaid ? "Total paid" : "Total", amount: Number(order.total) },
  };
}

async function loadQuote(id: string): Promise<Verified | null> {
  const admin = createAdminClient();
  const { data: quote } = await admin
    .from("bag_quotations")
    .select("id, created_at, subtotal, items")
    .eq("id", id)
    .maybeSingle();
  if (!quote) return null;
  const items = readQuotationItems(quote.items) ?? [];
  const validUntil = quotationValidUntil(quote.created_at);
  const expired = Date.now() > new Date(validUntil).getTime();
  return {
    title: "Quotation",
    facts: [
      { label: "Number", value: quote.id },
      { label: "Date", value: formatInvoiceDate(quote.created_at) },
      { label: "Valid until", value: formatInvoiceDate(validUntil) },
    ],
    status: expired
      ? { text: "Expired · prices may have changed", tone: "warn" }
      : { text: "Valid quotation", tone: "ok" },
    lines: items.map((item) => ({
      label: item.name,
      detail: `${item.sizeLabel} × ${item.qty}`,
      amount: item.lineTotal,
    })),
    extras: [],
    total: { label: "Subtotal (excl. VAT and delivery)", amount: Number(quote.subtotal) },
  };
}

const TONE: Record<Verified["status"]["tone"], string> = {
  ok: "bg-[var(--ok-muted)] text-[var(--accent-bright)]",
  warn: "bg-[rgba(232,163,23,0.16)] text-[var(--warn)]",
  danger: "bg-[rgba(226,59,74,0.14)] text-[var(--danger)]",
};

export default async function VerifyDocumentPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const parsed = parseDocumentVerifyCode(decodeURIComponent(code));
  const doc = parsed ? await (parsed.kind === "order" ? loadOrder(parsed.id) : loadQuote(parsed.id)) : null;
  const email = contactEmail();

  if (!doc) {
    return (
      <div className="page-shell max-w-xl py-10">
        <div className="rounded-[var(--radius-lg)] bg-[var(--danger)] p-5 text-white">
          <p className="text-lg font-bold">No document found</p>
          <p className="mt-1 text-sm opacity-95">
            This code does not match any receipt, invoice or quotation from RAPPI Sports Hub. The document may not be
            genuine.
          </p>
        </div>
        <p className="mt-5 text-sm text-[var(--muted)]">
          Check that the code was typed exactly as printed, or{" "}
          <Link href="/verify" className="underline">
            try another code
          </Link>
          . If you think this is a mistake, contact{" "}
          <a href={`mailto:${email}`} className="underline">
            {email}
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="page-shell max-w-xl py-10">
      <div className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--accent)] p-5 text-white">
        <span className="flex size-10 flex-none items-center justify-center rounded-full bg-white text-xl font-bold text-[var(--accent)]">
          ✓
        </span>
        <div>
          <p className="text-lg font-bold leading-tight">Genuine RAPPI Sports Hub document</p>
          <p className="text-sm opacity-95">These are the official details from our records.</p>
        </div>
      </div>

      <dl className="mt-6 text-sm">
        <div className="flex justify-between gap-4 border-b border-[var(--border)] py-2.5">
          <dt className="text-[var(--muted)]">Document</dt>
          <dd className="font-semibold">{doc.title}</dd>
        </div>
        {doc.facts.map((fact) => (
          <div key={fact.label} className="flex justify-between gap-4 border-b border-[var(--border)] py-2.5">
            <dt className="text-[var(--muted)]">{fact.label}</dt>
            <dd className="text-right font-semibold">{fact.value}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] py-2.5">
          <dt className="text-[var(--muted)]">Status</dt>
          <dd className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${TONE[doc.status.tone]}`}>{doc.status.text}</dd>
        </div>
      </dl>

      <h2 className="mt-7 text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Items</h2>
      <ul className="mt-2 text-sm">
        {doc.lines.map((line, i) => (
          <li key={i} className="flex justify-between gap-4 border-b border-[var(--border)] py-2">
            <span>
              {line.label}
              <span className="text-[var(--muted)]"> · {line.detail}</span>
            </span>
            <span className="whitespace-nowrap">{formatChargeNad(line.amount)}</span>
          </li>
        ))}
        {doc.extras.map((extra) => (
          <li key={extra.label} className="flex justify-between gap-4 border-b border-[var(--border)] py-2">
            <span className="text-[var(--muted)]">{extra.label}</span>
            <span className="whitespace-nowrap">
              {extra.amount < 0 ? "-" : ""}{formatChargeNad(Math.abs(extra.amount))}
            </span>
          </li>
        ))}
        <li className="flex justify-between gap-4 border-t-2 border-[var(--text)] pt-2.5 font-bold">
          <span>{doc.total.label}</span>
          <span className="whitespace-nowrap">{formatChargeNad(doc.total.amount)}</span>
        </li>
      </ul>

      <p className="mt-6 text-xs leading-relaxed text-[var(--muted)]">
        If anything on your copy is different from this page, the copy has been changed. Contact{" "}
        <a href={`mailto:${email}`} className="underline">
          {email}
        </a>
        .
      </p>
    </div>
  );
}
