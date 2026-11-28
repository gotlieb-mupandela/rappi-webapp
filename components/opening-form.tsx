"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useMoney } from "@/components/locale-provider";
import { OPENING_SIGNED_UP_KEY } from "@/components/opening-popup";
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
import type { SearchNote } from "@/lib/search-engine";
import type { Product } from "@/lib/types";

const EMPTY: OpeningAnswers = {
  name: "", email: "", whatsapp: "", town: "", sports: [], buysFor: [], wants: [], spend: "", wishCode: "",
  draws: [], orgName: "", orgRole: "", orgSize: "", notes: "", marketingConsent: false, privacyConsent: false,
};
const DRAFT_KEY = "rsh-opening-draft";

type StepKey = "you" | "sports" | "pick" | "org" | "finish";
const STEP_META: Record<StepKey, { name: string; title: string; sub: string }> = {
  you: { name: "You", title: "Let's start with you", sub: "We send your coupon to this email and WhatsApp." },
  sports: { name: "Sports", title: "What do you play?", sub: "This helps us stock the right things for Walvis Bay." },
  pick: { name: "Your pick", title: "Choose your product", sub: `Pick something you'd like to use your ${COUPON_RATE}% on.` },
  org: { name: "School / club", title: "Tell us about your team", sub: "We'll get in touch about team kits and school orders." },
  finish: { name: "Finish", title: "Almost done", sub: "Check your details and get your coupon." },
};

const field =
  "mt-2 h-[52px] w-full rounded-2xl border border-neutral-300 bg-white px-4 text-[16px] text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-[#2f9a12] focus:ring-4 focus:ring-[#5eff38]/25";

function Check({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={`h-4 w-4 ${className}`}>
      <path d="M5 10.5l3.2 3.2L15 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className="h-4 w-4">
      <path d="M4 10h11m-4-4 4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Chips({ options, value, onChange, max }: { options: readonly string[]; value: string[]; onChange: (v: string[]) => void; max?: number }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
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
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-[14px] font-semibold transition active:scale-[0.97] ${
              on
                ? "border-[#0c110b] bg-[#0c110b] text-white shadow-[0_6px_16px_-8px_rgba(12,17,11,.6)]"
                : "border-neutral-300 bg-white text-neutral-800 hover:border-neutral-500"
            } ${full ? "cursor-not-allowed opacity-35" : ""}`}
          >
            {on ? <Check className="text-[#5eff38]" /> : null}
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

function Q({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="mt-7 first:mt-0" data-error={error ? "1" : undefined}>
      <p className="text-[16px] font-semibold text-neutral-900">{label}</p>
      {hint ? <p className="mt-0.5 text-[13px] text-neutral-500">{hint}</p> : null}
      {children}
      {error ? (
        <p role="alert" className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-red-600">
          <svg viewBox="0 0 20 20" aria-hidden className="h-4 w-4"><circle cx="10" cy="10" r="8" fill="currentColor" /><path d="M10 6v5M10 13.5v.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" /></svg>
          {error}
        </p>
      ) : null}
    </div>
  );
}

const QUICK = ["Boots", "Running shoes", "School shoes", "Padel", "Rugby", "Team kit", "Swimwear"];

function ProductPicker({ value, onChange, initial }: { value: string; onChange: (code: string, product: Product | null) => void; initial: Product | null }) {
  const { format } = useMoney();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [note, setNote] = useState<SearchNote | null>(null);
  const [loading, setLoading] = useState(false);
  const [chosen, setChosen] = useState<Product | null>(initial);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d) => {
          setResults((d?.listing?.products ?? []).slice(0, 8));
          setNote(d?.listing?.searchNote ?? null);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  if (value && chosen) {
    return (
      <div className="mt-3 rounded-2xl border-2 border-[#5eff38] bg-[#f6fff2] p-3.5">
        <div className="flex items-center gap-3.5">
          <span className="h-[72px] w-[72px] flex-none overflow-hidden rounded-xl bg-white">
            <ProductImage product={chosen} src={chosen.imageUrl} className="h-full w-full object-contain" sizes="72px" width={144} height={144} priority />
          </span>
          <span className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-bold uppercase tracking-wider text-[#2f9a12]"><Check className="h-3.5 w-3.5" /> Your pick</span>
            <span className="mt-0.5 line-clamp-2 block text-[15px] font-semibold leading-snug text-neutral-900">{chosen.displayName || chosen.title}</span>
            <span className="text-sm text-neutral-500">{format(chosen.price)}</span>
          </span>
        </div>
        <button type="button" onClick={() => { onChange("", null); setChosen(null); }} className="mt-3 h-10 w-full rounded-full border border-neutral-300 bg-white text-[13px] font-bold text-neutral-700 transition hover:border-neutral-500">
          Choose a different product
        </button>
      </div>
    );
  }
  const searching = q.trim().length >= 2;
  return (
    <div className="mt-3">
      <div className="relative">
        <svg viewBox="0 0 20 20" aria-hidden className="pointer-events-none absolute left-4 top-1/2 mt-1 h-5 w-5 -translate-y-1/2 text-neutral-400">
          <circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="2" /><path d="m14 14 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          className={`${field} pl-12`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search boots, school shoes, rugby…"
          aria-label="Search products"
          enterKeyHint="search"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {QUICK.map((k) => (
          <button key={k} type="button" onClick={() => setQ(k)} className={`min-h-9 rounded-full px-3.5 text-[13px] font-semibold transition ${q === k ? "bg-[#0c110b] text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"}`}>
            {k}
          </button>
        ))}
      </div>
      {searching ? (
        <div className="mt-3 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          {note && results.length ? (
            <p className="border-b border-neutral-100 bg-neutral-50 px-4 py-2.5 text-[13px] text-neutral-600" role="status">
              {note.corrected && !note.closest ? <>Showing results for <strong className="text-neutral-900">{note.corrected}</strong></> : note.message}
            </p>
          ) : null}
          {loading && !results.length ? (
            <ul aria-hidden>
              {[0, 1, 2].map((i) => (
                <li key={i} className="flex items-center gap-3 p-3">
                  <span className="h-14 w-14 animate-pulse rounded-xl bg-neutral-100" />
                  <span className="flex-1 space-y-2"><span className="block h-3 w-3/4 animate-pulse rounded bg-neutral-100" /><span className="block h-3 w-1/4 animate-pulse rounded bg-neutral-100" /></span>
                </li>
              ))}
            </ul>
          ) : results.length ? (
            <ul className={`divide-y divide-neutral-100 transition-opacity ${loading ? "opacity-60" : ""}`}>
              {results.map((p) => (
                <li key={p.code}>
                  <button type="button" onClick={() => { onChange(p.code, p); setChosen(p); }} className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-neutral-50">
                    <span className="h-14 w-14 flex-none overflow-hidden rounded-xl bg-neutral-50">
                      <ProductImage product={p} src={p.imageUrl} className="h-full w-full object-contain" sizes="56px" width={112} height={112} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-[14px] font-semibold leading-snug text-neutral-900">{p.displayName || p.title}</span>
                      <span className="text-[13px] text-neutral-500">{format(p.price)}</span>
                    </span>
                    <span className="flex-none rounded-full border border-neutral-300 px-3 py-1.5 text-[12px] font-bold text-neutral-700">Choose</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-4 text-sm text-neutral-500">No matches for &ldquo;{q.trim()}&rdquo;. Try &ldquo;boots&rdquo;, &ldquo;running&rdquo; or &ldquo;school shoes&rdquo;.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** 0811234567 -> "081 123 4567" as the user types; +264 numbers keep their prefix. */
function formatWhatsapp(raw: string) {
  const plus = raw.trim().startsWith("+");
  const d = raw.replace(/\D/g, "").slice(0, plus ? 12 : 10);
  if (plus) return `+${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8)}`.trim();
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6)].filter(Boolean).join(" ");
}

type Errors = Partial<Record<keyof OpeningAnswers, string>>;

export function OpeningForm() {
  const router = useRouter();
  const [a, setA] = useState<OpeningAnswers>(EMPTY);
  const [pick, setPick] = useState<Product | null>(null);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"existing" | null>(null);
  const [company, setCompany] = useState("");
  const titleRef = useRef<HTMLHeadingElement>(null);
  const restored = useRef(false);

  // Keep answers if the page is refreshed or the back button is used.
  useEffect(() => {
    void Promise.resolve().then(() => {
      try {
        const saved = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? "null") as { a?: OpeningAnswers; step?: number; pick?: Product } | null;
        if (saved?.a) {
          setA({ ...EMPTY, ...saved.a });
          setStep(Math.max(0, Number(saved.step) || 0));
          setPick(saved.pick ?? null);
        }
      } catch {
        // Storage blocked or corrupt: start fresh.
      }
      restored.current = true;
    });
  }, []);
  useEffect(() => {
    if (!restored.current) return;
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ a, step, pick }));
    } catch {
      // Storage blocked: nothing else breaks.
    }
  }, [a, step, pick]);

  const set = <K extends keyof OpeningAnswers>(k: K, v: OpeningAnswers[K]) => {
    setErrors((e) => ({ ...e, [k]: undefined }));
    setFormError("");
    setA((s) => ({ ...s, [k]: v }));
  };

  const keys: StepKey[] = ["you", "sports", "pick", ...(needsOrgStep(a.buysFor) ? (["org"] as StepKey[]) : []), "finish"];
  const at = Math.min(step, keys.length - 1);
  const current = keys[at]!;
  const last = at === keys.length - 1;
  const meta = STEP_META[current];

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, [current]);

  function validate(): Errors {
    const e: Errors = {};
    if (current === "you") {
      if (a.name.trim().length < 2) e.name = "Enter your full name.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email.trim())) e.email = "Enter a valid email, e.g. name@gmail.com.";
      const digits = a.whatsapp.replace(/\D/g, "");
      if (!(digits.length === 10 && digits.startsWith("0")) && !(digits.length === 12 && digits.startsWith("264"))) {
        e.whatsapp = "Enter a Namibian number, e.g. 081 234 5678.";
      }
      if (!a.town) e.town = "Choose where you live.";
    }
    if (current === "org" && a.orgName.trim().length < 2) e.orgName = "Enter the school or club name.";
    if (current === "finish") {
      if (!a.marketingConsent) e.marketingConsent = "Tick this so we can send your coupon.";
      if (!a.privacyConsent) e.privacyConsent = "Please agree to the privacy policy.";
    }
    return e;
  }

  async function next() {
    if (busy) return;
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      requestAnimationFrame(() => document.querySelector("[data-error]")?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return;
    }
    if (!last) {
      setStep(at + 1);
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
        setFormError(data.error ?? "We couldn't save your answers. Please try again.");
        return;
      }
      try {
        localStorage.setItem(OPENING_SIGNED_UP_KEY, data.code ?? "1");
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        // Storage blocked: the pop-up may show again, nothing else breaks.
      }
      if (data.code) router.push(`/c/${data.code}?new=1`);
      else setDone("existing");
    } catch {
      setFormError("No connection. Please check your internet and try again.");
    } finally {
      setBusy(false);
    }
  }

  function back() {
    setErrors({});
    setFormError("");
    setStep(Math.max(0, at - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const t = e.target as HTMLElement;
    if (e.key === "Enter" && t.tagName === "INPUT" && (t as HTMLInputElement).type !== "checkbox" && t.getAttribute("aria-label") !== "Search products") {
      e.preventDefault();
      void next();
    }
  }

  if (done === "existing") {
    return (
      <div className="rounded-3xl border border-neutral-200 bg-white p-8 text-center shadow-[0_24px_60px_-28px_rgba(0,0,0,.3)]">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#5eff38] text-[#0c110b]"><Check className="h-7 w-7" /></span>
        <p className="mt-4 text-xl font-bold">You&apos;re already signed up</p>
        <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-neutral-600">
          We&apos;ve sent your {COUPON_RATE}% coupon again to the email you used. Check your inbox, and the Promotions or Spam folder.
        </p>
      </div>
    );
  }

  const summary: [string, string][] = [
    ["Name", a.name],
    ["Email", a.email],
    ["WhatsApp", a.whatsapp],
    ["Town", a.town],
    ["Sports", a.sports.join(", ") || "Not chosen"],
    ["Your pick", pick ? pick.displayName || pick.title : "Not chosen"],
    ...(needsOrgStep(a.buysFor) ? ([["School / club", a.orgName]] as [string, string][]) : []),
  ];

  return (
    <div onKeyDown={onKey} className="rounded-3xl border border-neutral-200/80 bg-white shadow-[0_30px_80px_-40px_rgba(12,17,11,.45)]">
      <style>{`@keyframes rshStep{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}`}</style>
      <div className="px-5 pt-5 sm:px-8 sm:pt-7">
        <ol className="flex gap-1.5" aria-label={`Step ${at + 1} of ${keys.length}`}>
          {keys.map((k, i) => (
            <li key={k} className="flex-1">
              <span className="block h-1.5 overflow-hidden rounded-full bg-neutral-200">
                <span className="block h-full rounded-full bg-[#5eff38] transition-all duration-500" style={{ width: i <= at ? "100%" : "0%" }} />
              </span>
              <span className={`mt-2 hidden text-[11px] font-bold uppercase tracking-[0.12em] sm:block ${i === at ? "text-neutral-900" : "text-neutral-400"}`}>
                {STEP_META[k].name}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[12px] font-bold uppercase tracking-[0.16em] text-[#2f9a12] sm:hidden">
          Step {at + 1} of {keys.length} · {meta.name}
        </p>
      </div>

      <div key={current} style={{ animation: "rshStep .35s ease-out" }} className="px-5 pb-6 pt-4 sm:px-8 sm:pb-8">
        <h2 ref={titleRef} tabIndex={-1} style={{ outline: "none", boxShadow: "none" }}
          className="font-[family-name:var(--font-oswald)] text-[30px] font-bold uppercase leading-none text-neutral-900 outline-none focus:outline-none focus-visible:outline-none sm:text-[36px]">
          {meta.title}
        </h2>
        <p className="mt-2 text-[15px] text-neutral-500">{meta.sub}</p>

        <div className="mt-6">
          {current === "you" ? (
            <>
              <Q label="Full name" error={errors.name}>
                <input className={field} value={a.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" placeholder="e.g. Anna Shikongo" />
              </Q>
              <Q label="Email" hint="Your coupon is sent here." error={errors.email}>
                <input className={field} type="email" inputMode="email" value={a.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" placeholder="name@gmail.com" />
              </Q>
              <Q label="WhatsApp number" error={errors.whatsapp}>
                <input className={field} type="tel" inputMode="tel" value={a.whatsapp} onChange={(e) => set("whatsapp", formatWhatsapp(e.target.value))} placeholder="081 234 5678" autoComplete="tel" />
              </Q>
              <Q label="Where do you live?" error={errors.town}>
                <One options={TOWNS} value={a.town} onChange={(v) => set("town", v)} />
              </Q>
              <input tabIndex={-1} autoComplete="off" aria-hidden className="absolute left-[-9999px] h-0 w-0" value={company} onChange={(e) => setCompany(e.target.value)} name="company" />
            </>
          ) : null}
          {current === "sports" ? (
            <>
              <Q label="Which sports do you or your family play?" hint="Tick all that apply"><Chips options={SPORTS} value={a.sports} onChange={(v) => set("sports", v)} /></Q>
              <Q label="Who do you buy sportswear for?" hint="Tick all that apply"><Chips options={BUYS_FOR} value={a.buysFor} onChange={(v) => set("buysFor", v)} /></Q>
              <Q label="What do you most want to find in our store?" hint={`Pick up to ${MAX_WANTS}`}><Chips options={WANTS} value={a.wants} onChange={(v) => set("wants", v)} max={MAX_WANTS} /></Q>
              <Q label="How much do you usually spend per visit?"><One options={SPEND} value={a.spend} onChange={(v) => set("spend", v)} /></Q>
            </>
          ) : null}
          {current === "pick" ? (
            <>
              <Q label={`The product you'd like with your ${COUPON_RATE}%`} hint="Optional. Search the shop or tap a suggestion.">
                <ProductPicker value={a.wishCode} initial={pick} onChange={(code, p) => { set("wishCode", code); setPick(p); }} />
              </Q>
              <Q label="What would make you visit in January?" hint={`Pick up to ${MAX_DRAWS}`}><Chips options={DRAWS} value={a.draws} onChange={(v) => set("draws", v)} max={MAX_DRAWS} /></Q>
            </>
          ) : null}
          {current === "org" ? (
            <>
              <Q label="School or club name" error={errors.orgName}><input className={field} value={a.orgName} onChange={(e) => set("orgName", e.target.value)} placeholder="e.g. Walvis Bay Private School" /></Q>
              <Q label="Your role"><input className={field} value={a.orgRole} onChange={(e) => set("orgRole", e.target.value)} placeholder="e.g. sports teacher, coach" /></Q>
              <Q label="Roughly how many players or learners?"><One options={ORG_SIZES} value={a.orgSize} onChange={(v) => set("orgSize", v)} /></Q>
            </>
          ) : null}
          {current === "finish" ? (
            <>
              <dl className="rounded-2xl bg-neutral-50 p-4 text-[14px]">
                {summary.map(([k, v]) => (
                  <div key={k} className="flex gap-3 py-1">
                    <dt className="w-24 flex-none text-neutral-500">{k}</dt>
                    <dd className="min-w-0 break-words font-semibold text-neutral-900">{v}</dd>
                  </div>
                ))}
                <button type="button" onClick={() => setStep(0)} className="mt-2 text-[13px] font-bold text-[#2f9a12] underline-offset-2 hover:underline">
                  Edit details
                </button>
              </dl>
              <Q label="Anything else you'd like us to stock?" hint="Optional">
                <textarea className={`${field} h-28 py-3`} value={a.notes} onChange={(e) => set("notes", e.target.value)} maxLength={500} />
              </Q>
              <div className="mt-6 space-y-3" data-error={errors.marketingConsent || errors.privacyConsent ? "1" : undefined}>
                <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 text-[14px] leading-relaxed transition ${a.marketingConsent ? "border-[#5eff38] bg-[#f6fff2]" : errors.marketingConsent ? "border-red-300 bg-red-50" : "border-neutral-200"}`}>
                  <input type="checkbox" className="mt-0.5 h-5 w-5 flex-none accent-[#2f9a12]" checked={a.marketingConsent} onChange={(e) => set("marketingConsent", e.target.checked)} />
                  <span><strong>Send me my coupon and offers from RAPPI Sports Hub</strong> by email and WhatsApp. I can unsubscribe at any time.</span>
                </label>
                <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 text-[14px] leading-relaxed transition ${a.privacyConsent ? "border-[#5eff38] bg-[#f6fff2]" : errors.privacyConsent ? "border-red-300 bg-red-50" : "border-neutral-200"}`}>
                  <input type="checkbox" className="mt-0.5 h-5 w-5 flex-none accent-[#2f9a12]" checked={a.privacyConsent} onChange={(e) => set("privacyConsent", e.target.checked)} />
                  <span>I agree to the <Link href="/privacy" className="font-semibold underline" target="_blank">privacy policy</Link>.</span>
                </label>
                {errors.marketingConsent || errors.privacyConsent ? (
                  <p role="alert" className="text-[13px] font-semibold text-red-600">{errors.marketingConsent ?? errors.privacyConsent}</p>
                ) : null}
              </div>
            </>
          ) : null}
        </div>

        {formError ? <p role="alert" className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{formError}</p> : null}
      </div>

      <div className="sticky bottom-0 z-10 rounded-b-3xl border-t border-neutral-100 bg-white/95 px-5 py-4 backdrop-blur sm:static sm:px-8 sm:py-6">
        <div className="flex gap-3">
          {at > 0 ? (
            <button type="button" onClick={back} className="h-[52px] rounded-full border border-neutral-300 px-6 text-[14px] font-bold text-neutral-800 transition hover:bg-neutral-50">
              Back
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => void next()}
            className="inline-flex h-[52px] flex-1 items-center justify-center gap-2 rounded-full bg-[#5eff38] px-6 text-[15px] font-extrabold uppercase tracking-[0.06em] text-[#0c110b] shadow-[0_12px_30px_-12px_rgba(94,255,56,.9)] transition hover:brightness-95 active:scale-[0.99] disabled:opacity-70"
          >
            {busy ? (
              <>
                <svg viewBox="0 0 24 24" className="h-5 w-5 animate-spin" aria-hidden><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" opacity=".25" /><path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
                Creating your coupon
              </>
            ) : last ? (
              <>Get my {COUPON_RATE}% coupon</>
            ) : (
              <>
                Continue <Arrow />
              </>
            )}
          </button>
        </div>
        <p className="mt-3 text-center text-[12px] text-neutral-500">
          {COUPON_RATE}% off one order · valid {COUPON_VALID_LABEL} · in store or online · one coupon per person
        </p>
      </div>
    </div>
  );
}
