"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ProductImage } from "@/components/product-image";
import { COUPON_RATE, COUPON_VALID_LABEL, OPENING_DAY_LABEL, STORE_LINE, STORE_WHATSAPP } from "@/lib/opening-options";
import type { Product } from "@/lib/types";

type Status = "not_active" | "valid" | "used" | "expired";

const STATUS_TEXT: Record<Status, { pill: string; staff: string; staffSub: string; tone: string }> = {
  not_active: { pill: "Active 5 Jan", staff: "Not active yet", staffSub: "Valid from Tue 5 January 2027", tone: "bg-[#e08a00]" },
  valid: { pill: "Active", staff: "Valid coupon", staffSub: `Give ${COUPON_RATE}% off this sale`, tone: "bg-[#2f9a12]" },
  used: { pill: "Used", staff: "Already used", staffSub: "", tone: "bg-[#c62828]" },
  expired: { pill: "Expired", staff: "Expired", staffSub: "This coupon ended on 31 January 2027", tone: "bg-[#c62828]" },
};

export function CouponView(props: {
  code: string;
  status: Status;
  name: string;
  qrSvg: string;
  wish: Product | null;
  isNew: boolean;
  issued: string;
  redeemedAt: string | null;
  redeemedBy: string | null;
  redeemedChannel: string | null;
  staff: string | null;
  staffDetails: { whatsapp: string; email: string } | null;
}) {
  const s = STATUS_TEXT[props.status];
  return (
    <div className="min-h-[70vh] bg-[#f4f5f2] pb-12">
      <div className="mx-auto max-w-md px-4 pt-5">
        {props.staff ? <StaffPanel {...props} /> : null}

        {props.isNew && !props.staff ? (
          <p className="mb-4 rounded-xl bg-[#f4ffef] px-4 py-3 text-sm font-semibold text-[#2f6a12]">
            Done! Your coupon is below and on its way to your email.
          </p>
        ) : null}

        <div className="relative overflow-hidden rounded-[26px] bg-[#0c110b] bg-[radial-gradient(320px_200px_at_85%_0%,rgba(94,255,56,.35),transparent_65%)] p-5 text-white">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-[0.14em] text-[#5eff38]">RAPPI SPORTS HUB</span>
            <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide ${props.status === "used" || props.status === "expired" ? "bg-white/20 text-white" : "bg-[#5eff38] text-[#0c110b]"}`}>
              {s.pill}
            </span>
          </div>
          <div className="mt-4 flex items-center gap-3.5">
            {props.wish ? (
              <span className="flex h-[86px] w-[86px] flex-none items-center justify-center overflow-hidden rounded-2xl bg-white">
                <ProductImage product={props.wish} src={props.wish.imageUrl} className="h-[82%] w-[82%] object-contain" sizes="86px" width={172} height={172} />
              </span>
            ) : null}
            <div className="min-w-0">
              <p className="font-[family-name:var(--font-oswald)] text-[56px] font-bold leading-[0.9] text-[#5eff38]">
                {COUPON_RATE}% OFF
              </p>
              <p className="font-[family-name:var(--font-oswald)] text-lg font-semibold uppercase tracking-wide">Any product</p>
              <p className="mt-0.5 line-clamp-2 text-[13px] text-white/80">
                {props.wish ? `Your pick: ${props.wish.displayName || props.wish.title}` : `For ${props.name}`}
              </p>
            </div>
          </div>
          <div
            className={`mx-auto mt-5 h-[200px] w-[200px] rounded-[18px] bg-white p-3.5 [&_svg]:h-full [&_svg]:w-full ${props.status === "used" || props.status === "expired" ? "opacity-30" : ""}`}
            aria-label="Coupon QR code"
            role="img"
            dangerouslySetInnerHTML={{ __html: props.qrSvg }}
          />
          <p className="mt-2 text-center font-mono text-[19px] font-bold tracking-[0.12em]">{props.code}</p>
          <p className="mt-1 text-center text-[12.5px] text-white/75">Valid {COUPON_VALID_LABEL} · one use · store or online</p>
        </div>

        {!props.staff ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <HomeScreenTip />
            <a href={`/c/${props.code}/pdf`} className="flex min-h-12 items-center justify-center rounded-2xl border border-neutral-300 bg-white text-sm font-bold">
              Download PDF
            </a>
          </div>
        ) : null}

        <section className="mt-3 rounded-2xl bg-white p-4 text-sm">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-neutral-500">Your coupon</h2>
          <Row k="Name" v={props.name} />
          <Row k="Discount" v={<b>{COUPON_RATE}% off one order</b>} />
          <Row k="Valid" v={COUPON_VALID_LABEL} />
          <Row k="Issued" v={props.issued} />
          <Row
            k="Status"
            v={
              <span className="rounded-md bg-neutral-900 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
                {props.status === "used" ? `Used ${props.redeemedAt ?? ""}` : props.status === "valid" ? "Ready to use" : props.status === "expired" ? "Expired" : "Not used"}
              </span>
            }
          />
        </section>
        <section className="mt-3 rounded-2xl bg-white p-4 text-sm leading-relaxed">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-neutral-500">How to use it</h2>
          <ol className="list-decimal pl-5">
            <li>Visit the store from 5 January, or shop online.</li>
            <li>In store: show this QR code at the till before you pay.</li>
            <li>Online: type the code in the discount box at checkout.</li>
          </ol>
        </section>
        <section className="mt-3 rounded-2xl bg-white p-4 text-sm">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-neutral-500">Store</h2>
          <p>{STORE_LINE}</p>
          <p className="mt-0.5 text-neutral-500">Opening {OPENING_DAY_LABEL} · WhatsApp {STORE_WHATSAPP}</p>
        </section>
        <p className="mt-3 px-1 text-xs text-neutral-500">
          Personal and single-use. Not exchangeable for cash. Does not combine with other discount codes.
        </p>
        {!props.staff ? <StaffLogin code={props.code} /> : null}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <p className="flex justify-between gap-3 py-1">
      <span className="text-neutral-500">{k}</span>
      <span className="text-right">{v}</span>
    </p>
  );
}

function HomeScreenTip() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen((o) => !o)} className="min-h-12 rounded-2xl bg-neutral-900 text-sm font-bold text-white">
        Add to home screen
      </button>
      {open ? (
        <p className="col-span-2 rounded-2xl bg-white p-3.5 text-sm leading-relaxed">
          <b>iPhone:</b> tap the Share button, then &ldquo;Add to Home Screen&rdquo;.
          <br />
          <b>Android:</b> tap the ⋮ menu, then &ldquo;Add to Home screen&rdquo;.
          <br />
          Your coupon will open like a wallet card.
        </p>
      ) : null}
    </>
  );
}

function StaffPanel(props: Parameters<typeof CouponView>[0]) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const s = STATUS_TEXT[props.status];
  async function redeem() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/coupons/${props.code}/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "redeem" }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) setError((data as { error?: string }).error ?? "Could not mark as used.");
    setBusy(false);
    router.refresh();
  }
  return (
    <div className="mb-5">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">Staff: {props.staff}</p>
      <div className={`rounded-3xl px-5 py-6 text-center text-white ${s.tone}`}>
        <p className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/25 text-4xl font-extrabold">
          {props.status === "valid" ? "✓" : props.status === "not_active" ? "!" : "✕"}
        </p>
        <p className="mt-3 font-[family-name:var(--font-oswald)] text-4xl font-bold uppercase leading-none">{s.staff}</p>
        <p className="mt-2 text-[15px] opacity-95">
          {props.status === "used"
            ? `Used ${props.redeemedAt ?? ""}${props.redeemedBy ? ` by ${props.redeemedBy}` : ""}${props.redeemedChannel === "online" ? " (online)" : ""}`
            : s.staffSub}
        </p>
      </div>
      <div className="mt-3 rounded-2xl bg-white p-4 text-sm">
        <Row k="Code" v={<b>{props.code}</b>} />
        <Row k="Customer" v={props.name} />
        <Row k="WhatsApp" v={props.staffDetails?.whatsapp ?? ""} />
        <Row k="Valid" v={COUPON_VALID_LABEL} />
        {props.wish ? <Row k="Wanted" v={props.wish.displayName || props.wish.title} /> : null}
      </div>
      {props.status === "valid" ? (
        <button type="button" disabled={busy} onClick={redeem} className="mt-3 h-14 w-full rounded-2xl bg-[#5eff38] text-base font-extrabold uppercase tracking-wider text-[#0c110b] disabled:opacity-60">
          {busy ? "Saving…" : "Mark as used"}
        </button>
      ) : (
        <p className="mt-3 rounded-2xl bg-neutral-200 py-4 text-center text-sm font-extrabold uppercase tracking-wider text-neutral-500">
          Do not give the discount
        </p>
      )}
      {props.status === "valid" ? <p className="mt-2 text-center text-xs text-neutral-500">Press after the sale. The coupon can&apos;t be used again.</p> : null}
      {error ? <p role="alert" className="mt-2 text-center text-sm font-semibold text-red-700">{error}</p> : null}
      <hr className="mt-6 border-neutral-300" />
    </div>
  );
}

function StaffLogin({ code }: { code: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [staff, setStaff] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function login() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/coupons/${code}/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", staff, pin }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) {
      setError((data as { error?: string }).error ?? "Could not check the PIN.");
      return;
    }
    setPin("");
    router.refresh();
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-6 w-full py-3 text-center text-xs font-bold uppercase tracking-[0.12em] text-neutral-400">
        Staff
      </button>
    );
  }
  return (
    <div className="mt-6 rounded-2xl border border-neutral-300 bg-white p-4">
      <p className="text-sm font-bold">Store staff: enter the till PIN</p>
      <input className="mt-3 h-12 w-full rounded-xl border border-neutral-300 px-3" placeholder="Your name" value={staff} onChange={(e) => setStaff(e.target.value)} autoComplete="name" />
      <input className="mt-2 h-12 w-full rounded-xl border border-neutral-300 px-3" placeholder="Till PIN" type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} autoComplete="off" />
      {error ? <p role="alert" className="mt-2 text-sm font-semibold text-red-700">{error}</p> : null}
      <button type="button" disabled={busy || !staff || !pin} onClick={login} className="mt-3 h-12 w-full rounded-xl bg-neutral-900 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-50">
        {busy ? "Checking…" : "Open staff view"}
      </button>
    </div>
  );
}
