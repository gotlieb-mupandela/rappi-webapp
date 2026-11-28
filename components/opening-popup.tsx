"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { dealImage } from "@/lib/black-friday";
import { COUPON_RATE, OPENING_DAY_LABEL } from "@/lib/opening-options";

const ENDS_AT = Date.parse("2027-02-01T00:00:00+02:00");
const DELAY_MS = 2500;
/** Holds the visitor's coupon code once they have signed up ("1" on older sign-ups). */
export const OPENING_SIGNED_UP_KEY = "rsh-opening-signed-up";

// Module state survives moving between pages but resets on a full page load,
// so the pop-up shows once per refresh and not on every click.
let shownThisLoad = false;

/** Pages where a pop-up would get in the way of buying or of the form itself. */
const SKIP = /^\/(cart|checkout|login|admin|account|opening|c\/|auth|verify)/;

const read = (store: () => Storage, key: string) => {
  try {
    return store().getItem(key);
  } catch {
    return null;
  }
};

/**
 * Store-opening coupon pop-up. Shows on every page load (refresh), 2.5 seconds in.
 * Visitors who already have a coupon see a "your coupon is ready" version instead.
 */
export function OpeningPopup() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const cta = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (shownThisLoad || SKIP.test(pathname) || Date.now() >= ENDS_AT) return;
    const t = setTimeout(() => {
      shownThisLoad = true;
      const saved = read(() => localStorage, OPENING_SIGNED_UP_KEY);
      setCode(saved ? (saved.startsWith("RSH-OPEN-") ? saved : "") : null);
      setOpen(true);
    }, DELAY_MS);
    return () => clearTimeout(t);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    cta.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    setOpen(false);
  }
  const signedUp = code !== null;

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/55 p-3 backdrop-blur-[2px] sm:items-center" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="opening-popup-title"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[420px] overflow-hidden rounded-[28px] bg-[#0c110b] bg-[radial-gradient(360px_220px_at_85%_0%,rgba(94,255,56,.32),transparent_65%)] p-6 pb-5 text-white shadow-2xl"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl leading-none text-white hover:bg-white/20"
        >
          ×
        </button>
        <p className="pr-10 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#5eff38]">
          New store · Walvis Bay
        </p>
        <h2 id="opening-popup-title" className="mt-2 font-[family-name:var(--font-oswald)] text-[44px] font-bold uppercase leading-[0.92]">
          {signedUp ? (
            <>
              Your <span className="text-[#5eff38]">{COUPON_RATE}% coupon</span>
              <br />
              is ready
            </>
          ) : (
            <>
              Get <span className="text-[#5eff38]">{COUPON_RATE}% off</span>
              <br />
              at our opening
            </>
          )}
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-white/80">
          {signedUp ? (
            <>
              See you on <strong className="text-white">{OPENING_DAY_LABEL}</strong>. Show your coupon at the till or use the
              code online. Valid 5–31 January.
            </>
          ) : (
            <>
              We open on <strong className="text-white">{OPENING_DAY_LABEL}</strong>. Answer a 2-minute questionnaire and get
              your personal {COUPON_RATE}% coupon straight away, in store or online.
            </>
          )}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2" aria-hidden>
          {["ECUW2511FG", "RR200W2672", "902268.600"].map((code) => (
            <span key={code} className="flex aspect-square items-center justify-center rounded-2xl bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={dealImage(code)} alt="" className="max-h-[80%] max-w-[80%] object-contain" />
            </span>
          ))}
        </div>
        <Link
          ref={cta}
          href={signedUp && code ? `/c/${code}` : "/opening"}
          onClick={() => setOpen(false)}
          className="mt-5 flex h-14 items-center justify-center rounded-full bg-[#5eff38] text-base font-extrabold uppercase tracking-wider text-[#0c110b]"
        >
          {signedUp ? (code ? "View my coupon" : "Find my coupon") : `Get my ${COUPON_RATE}% off`}
        </Link>
        <button type="button" onClick={close} className="mt-2 w-full py-2.5 text-center text-sm text-white/60 underline-offset-2 hover:underline">
          No thanks
        </button>
      </div>
    </div>
  );
}
