"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { dealImage } from "@/lib/black-friday";
import { COUPON_RATE, OPENING_DAY_LABEL } from "@/lib/opening-options";

const ENDS_AT = Date.parse("2027-02-01T00:00:00+02:00");
const DELAY_MS = 5000;
const SNOOZE_MS = 24 * 3600_000;
const SNOOZED_KEY = "rsh-opening-popup-closed-at";
const SESSION_KEY = "rsh-opening-popup-seen";
export const OPENING_SIGNED_UP_KEY = "rsh-opening-signed-up";

/** Pages where a pop-up would get in the way of buying or of the form itself. */
const SKIP = /^\/(cart|checkout|login|admin|account|opening|c\/|auth|verify)/;

const read = (store: () => Storage, key: string) => {
  try {
    return store().getItem(key);
  } catch {
    return null;
  }
};
const write = (store: () => Storage, key: string, value: string) => {
  try {
    store().setItem(key, value);
  } catch {
    // Private mode or blocked storage: the pop-up just shows again next visit.
  }
};

/**
 * Store-opening coupon pop-up. Shows once per visit, 5 seconds in, never after
 * someone signs up, and stays away for 24 hours once closed.
 */
export function OpeningPopup() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const cta = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (SKIP.test(pathname) || Date.now() >= ENDS_AT) return;
    if (read(() => localStorage, OPENING_SIGNED_UP_KEY)) return;
    if (read(() => sessionStorage, SESSION_KEY)) return;
    const closedAt = Number(read(() => localStorage, SNOOZED_KEY) ?? 0);
    if (closedAt && Date.now() - closedAt < SNOOZE_MS) return;
    const t = setTimeout(() => {
      write(() => sessionStorage, SESSION_KEY, "1");
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
    write(() => localStorage, SNOOZED_KEY, String(Date.now()));
    setOpen(false);
  }

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
          Get <span className="text-[#5eff38]">{COUPON_RATE}% off</span>
          <br />
          at our opening
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-white/80">
          We open on <strong className="text-white">{OPENING_DAY_LABEL}</strong>. Answer a 2-minute questionnaire and get
          your personal {COUPON_RATE}% coupon straight away, in store or online.
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
          href="/opening"
          onClick={() => setOpen(false)}
          className="mt-5 flex h-14 items-center justify-center rounded-full bg-[#5eff38] text-base font-extrabold uppercase tracking-wider text-[#0c110b]"
        >
          Get my {COUPON_RATE}% →
        </Link>
        <button type="button" onClick={close} className="mt-2 w-full py-2.5 text-center text-sm text-white/60 underline-offset-2 hover:underline">
          No thanks
        </button>
      </div>
    </div>
  );
}
