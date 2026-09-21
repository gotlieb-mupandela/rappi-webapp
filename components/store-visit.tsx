"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/locale-provider";
import {
  contactEmail,
  facebookUrl,
  instagramUrl,
  mailtoUrl,
  whatsappUrl,
} from "@/lib/site-contact";

export function StoreVisit() {
  const t = useT();
  const email = contactEmail();
  const ig = instagramUrl();
  const fb = facebookUrl();
  const wa = whatsappUrl(t("store.whatsappPrefill"));

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
          {t("store.pickupEyebrow")}
        </p>
        <h2 className="mt-3 font-[family-name:var(--font-oswald)] text-2xl uppercase">
          {t("store.pickupTitle")}
        </h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{t("store.pickupBody")}</p>
        <Button asChild className="mt-6" variant="outline">
          <Link href="/checkout">{t("store.pickupCta")}</Link>
        </Button>
      </section>
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
          {t("footer.visit")}
        </p>
        <h2 className="mt-3 font-[family-name:var(--font-oswald)] text-2xl uppercase">
          {t("store.contactTitle")}
        </h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{t("store.contactBody")}</p>
        <a
          href={mailtoUrl(t("store.emailSubject"))}
          className="mt-4 block text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-bright)]"
        >
          {email}
        </a>
        {wa ? (
          <Button asChild className="mt-6">
            <a href={wa} target="_blank" rel="noreferrer">
              {t("store.whatsapp")}
            </a>
          </Button>
        ) : null}
      </section>
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
          {t("store.socialEyebrow")}
        </p>
        <h2 className="mt-3 font-[family-name:var(--font-oswald)] text-2xl uppercase">
          {t("store.socialTitle")}
        </h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{t("store.socialBody")}</p>
        <ul className="mt-4 space-y-2 text-sm">
          {ig ? (
            <li>
              <a href={ig} target="_blank" rel="noreferrer" className="hover:text-[var(--accent)]">
                Instagram
              </a>
            </li>
          ) : null}
          {fb ? (
            <li>
              <a href={fb} target="_blank" rel="noreferrer" className="hover:text-[var(--accent)]">
                Facebook
              </a>
            </li>
          ) : null}
          {!ig && !fb ? <li className="text-[var(--muted)]">{t("store.socialSoon")}</li> : null}
        </ul>
      </section>
    </div>
  );
}
