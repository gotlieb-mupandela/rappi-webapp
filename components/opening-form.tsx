"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useMoney } from "@/components/locale-provider";
import { ProductImage } from "@/components/product-image";
import {
  BUYS_FOR,
  COUPON_RATE,
  COUPON_VALID_LABEL,
  DRAWS,
  MAX_DRAWS,
  MAX_WANTS,
  ORG_SIZES,
  SPEND,
  SPORTS,
  TOWNS,
  WANTS,
  needsOrgStep,
  type OpeningAnswers,
} from "@/lib/opening-options";
import type { Product } from "@/lib/types";

const EMPTY: OpeningAnswers = {
  name: "", email: "", whatsapp: "", town: "", sports: [], buysFor: [], wants: [], spend: "", wishCode: "",
  draws: [], orgName: "", orgRole: "", orgSize: "", notes: "", marketingConsent: false, privacyConsent: false,
};

const field = "mt-1.5 h-12 w-full rounded-xl border border-neutral-300 bg-white px-4 text-base outline-none focus:border-neutral-900";

function Chips({ options, value, onChange, max }: { options: readonly string[]; value: string[]; onChange: (v: string[]) => void; max?: number }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o);
        const full = !on && max !== undefined && value.length >= max;
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            disabled={full}
            onClick={() => onChange(on ? value.filter((v) => v !== o) : [...value, o])}
            className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition ${
              on ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white text-neutral-900"
            } ${full ? "opacity-40" : ""}`}
          >
            {on ? "✓ " : ""}
            {o}
          </button>
        );
      })}
    </div>
  );
}

function One({ options, value, onChange }: { options: readonly string[]; value: string; onChange: (v: string) => void }) {
  return <Chips options={options} value={value ? [value] : []} onChange={(v) => onChange(v.filter((x) => x !== value)[0] ?? "")} />;
}

function Q({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="mt-6 first:mt-0">
      <p className="text-[15px] font-bold">{label}</p>
      {hint ? <p className="text-xs text-neutral-500">{hint}</p> : null}
      {children}
    </div>
  );
}

function ProductPicker({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const { format } = useMoney();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [chosen, setChosen] = useState<Product | null>(null);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d) => setResults((d?.listing?.products ?? []).slice(0, 6)))
        .catch(() => {});
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  if (value && chosen) {
    return (
      <div className="mt-2 flex items-center gap-3 rounded-xl border-2 border-[#5eff38] bg-[#f4ffef] p-3">
        <span className="h-16 w-16 flex-none overflow-hidden rounded-lg bg-white">
          <ProductImage product={chosen} src={chosen.imageUrl} className="h-full w-full object-contain" sizes="64px" width={128} height={128} />
        </span>
        <span className="min-w-0 flex-1 text-sm">
          <span className="block font-semibold">{chosen.displayName || chosen.title}</span>
          <span className="text-neutral-500">{format(chosen.price)}</span>
        </span>
        <button type="button" onClick={() => { onChange(""); setChosen(null); }} className="min-h-11 px-2 text-xs font-bold uppercase text-neutral-500">
          Change
        </button>
      </div>
    );
  }
  return (
    <div className="mt-2">
      <input className={field} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search, e.g. boots, padel, school shoes" aria-label="Search products" />
      {q.trim().length >= 2 ? (
        <ul className="mt-2 divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
          {results.map((p) => (
            <li key={p.code}>
              <button type="button" onClick={() => { onChange(p.code); setChosen(p); }} className="flex w-full items-center gap-3 p-2.5 text-left">
                <span className="h-12 w-12 flex-none overflow-hidden rounded-lg bg-neutral-100">
                  <ProductImage product={p} src={p.imageUrl} className="h-full w-full object-contain" sizes="48px" width={96} height={96} />
                </span>
                <span className="min-w-0 flex-1 text-sm">
                  <span className="line-clamp-1 font-semibold">{p.displayName || p.title}</span>
                  <span className="text-neutral-500">{format(p.price)}</span>
                </span>
              </button>
            </li>
          ))}
          {!results.length ? <li className="p-3 text-sm text-neutral-500">No matches yet. Keep typing.</li> : null}
        </ul>
      ) : null}
    </div>
  );
}

export function OpeningForm() {
  const router = useRouter();
  const [a, setA] = useState<OpeningAnswers>(EMPTY);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"existing" | null>(null);
  const [company, setCompany] = useState("");
  const set = <K extends keyof OpeningAnswers>(k: K, v: OpeningAnswers[K]) => {
    setError("");
    setA((s) => ({ ...s, [k]: v }));
  };

  const steps = ["You", "Your sports", "Your pick", ...(needsOrgStep(a.buysFor) ? ["School / club"] : []), "Finish"];
  const last = step === steps.length - 1;
  const current = steps[step];

  function check() {
    if (current === "You") {
      if (a.name.trim().length < 2) return "Enter your full name.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email.trim())) return "Enter a valid email.";
      if (a.whatsapp.replace(/\D/g, "").length < 7) return "Enter your WhatsApp number.";
      if (!a.town) return "Choose where you live.";
    }
    if (current === "Finish") {
      if (!a.marketingConsent) return "Tick the box to receive your coupon and offers.";
      if (!a.privacyConsent) return "Please agree to the privacy policy.";
    }
    return "";
  }

  async function next() {
    const problem = check();
    setError(problem);
    if (problem) return;
    if (!last) {
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/opening", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...a, company }),
      });
      const data = (await res.json().catch(() => ({}))) as { code?: string; existing?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save your answers. Please try again.");
        return;
      }
      if (data.code) router.push(`/c/${data.code}?new=1`);
      else setDone("existing");
    } catch {
      setError("No connection. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done === "existing") {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-center">
        <p className="text-lg font-bold">You&apos;ve already signed up</p>
        <p className="mt-2 text-sm text-neutral-600">We&apos;ve sent your {COUPON_RATE}% coupon again to the email you used. Check your inbox (and spam folder).</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-7">
      <div className="flex items-center gap-1.5" aria-hidden>
        {steps.map((s, i) => (
          <span key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-[#5eff38]" : "bg-neutral-200"}`} />
        ))}
      </div>
      <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">
        Step {step + 1} of {steps.length} · {current}
      </p>

      <div className="mt-5">
        {current === "You" ? (
          <>
            <Q label="Full name"><input className={field} value={a.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" /></Q>
            <Q label="Email" hint="Your coupon is sent here."><input className={field} type="email" inputMode="email" value={a.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" /></Q>
            <Q label="WhatsApp number"><input className={field} type="tel" inputMode="tel" value={a.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="081 234 5678" autoComplete="tel" /></Q>
            <Q label="Where do you live?"><One options={TOWNS} value={a.town} onChange={(v) => set("town", v)} /></Q>
            <input tabIndex={-1} autoComplete="off" aria-hidden className="absolute left-[-9999px] h-0 w-0" value={company} onChange={(e) => setCompany(e.target.value)} name="company" />
          </>
        ) : null}
        {current === "Your sports" ? (
          <>
            <Q label="Which sports do you or your family play?" hint="Tick all that apply"><Chips options={SPORTS} value={a.sports} onChange={(v) => set("sports", v)} /></Q>
            <Q label="Who do you buy sportswear for?" hint="Tick all that apply"><Chips options={BUYS_FOR} value={a.buysFor} onChange={(v) => set("buysFor", v)} /></Q>
            <Q label="What do you most want to find in our store?" hint={`Pick up to ${MAX_WANTS}`}><Chips options={WANTS} value={a.wants} onChange={(v) => set("wants", v)} max={MAX_WANTS} /></Q>
            <Q label="How much do you usually spend per visit?"><One options={SPEND} value={a.spend} onChange={(v) => set("spend", v)} /></Q>
          </>
        ) : null}
        {current === "Your pick" ? (
          <>
            <Q label={`Pick the product you want with your ${COUPON_RATE}%`} hint="Optional. Search our shop and choose one."><ProductPicker value={a.wishCode} onChange={(v) => set("wishCode", v)} /></Q>
            <Q label="What would make you come in January?" hint={`Pick up to ${MAX_DRAWS}`}><Chips options={DRAWS} value={a.draws} onChange={(v) => set("draws", v)} max={MAX_DRAWS} /></Q>
          </>
        ) : null}
        {current === "School / club" ? (
          <>
            <Q label="School or club name"><input className={field} value={a.orgName} onChange={(e) => set("orgName", e.target.value)} placeholder="e.g. Walvis Bay Private School" /></Q>
            <Q label="Your role"><input className={field} value={a.orgRole} onChange={(e) => set("orgRole", e.target.value)} placeholder="e.g. sports teacher, coach" /></Q>
            <Q label="Roughly how many players or learners?"><One options={ORG_SIZES} value={a.orgSize} onChange={(v) => set("orgSize", v)} /></Q>
          </>
        ) : null}
        {current === "Finish" ? (
          <>
            <Q label="Anything else you'd like us to stock?" hint="Optional">
              <textarea className={`${field} h-24 py-3`} value={a.notes} onChange={(e) => set("notes", e.target.value)} maxLength={500} />
            </Q>
            <label className="mt-6 flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-0.5 h-5 w-5 flex-none accent-[#2f9a12]" checked={a.marketingConsent} onChange={(e) => set("marketingConsent", e.target.checked)} />
              <span><strong>Yes, send me my coupon and offers from RAPPI Sports Hub</strong> by email and WhatsApp. I can unsubscribe at any time.</span>
            </label>
            <label className="mt-3 flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-0.5 h-5 w-5 flex-none accent-[#2f9a12]" checked={a.privacyConsent} onChange={(e) => set("privacyConsent", e.target.checked)} />
              <span>I agree to the <Link href="/privacy" className="underline" target="_blank">privacy policy</Link>.</span>
            </label>
          </>
        ) : null}
      </div>

      {error ? <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}

      <div className="mt-7 flex gap-3">
        {step > 0 ? (
          <button type="button" onClick={() => { setError(""); setStep(step - 1); }} className="h-12 rounded-full border border-neutral-300 px-6 text-sm font-bold uppercase tracking-wider">
            Back
          </button>
        ) : null}
        <button type="button" disabled={busy} onClick={next} className="h-12 flex-1 rounded-full bg-[#5eff38] px-6 text-sm font-extrabold uppercase tracking-wider text-[#0c110b] disabled:opacity-60">
          {busy ? "Saving…" : last ? `Get my ${COUPON_RATE}% coupon` : "Next →"}
        </button>
      </div>
      <p className="mt-4 text-center text-xs text-neutral-500">
        {COUPON_RATE}% off one order, valid {COUPON_VALID_LABEL}, in store or online. One coupon per person.
      </p>
    </div>
  );
}
