import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { getMarket } from "@/lib/i18n/server";
import {
  TERMS_ADDRESS,
  TERMS_CLAUSES,
  TERMS_COMPANY,
  TERMS_SUMMARY,
  TERMS_VERSION,
} from "./terms";

export const metadata: Metadata = {
  title: "Terms and conditions",
  description:
    "Standard Terms and Conditions of Trade for RAPPI Investments CC, trading as RAPPI Sports Hub.",
  alternates: { canonical: "/terms" },
};

const headingClass =
  "font-[family-name:var(--font-oswald)] text-xl uppercase tracking-tight text-[var(--text-secondary)] sm:text-2xl";
const textClass = "text-sm leading-7 text-[var(--muted)] sm:text-base";

export default async function TermsPage() {
  const french = (await getMarket()) === "eu";

  return (
    <div>
      <PageHeader
        crumbs={[{ href: "/", key: "common.home" }, { key: "footer.terms" }]}
        eyebrow="Legal"
        title="Terms and conditions"
        description="Standard Terms and Conditions of Trade"
      />
      <div className="page-shell py-10 lg:py-14">
        <article className="max-w-3xl">
          {french ? (
            <p className={`${textClass} mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4`}>
              Ces conditions générales sont disponibles en anglais uniquement. La version anglaise fait
              foi.
            </p>
          ) : null}
          <p className={textClass}>{TERMS_COMPANY}</p>
          <p className={textClass}>{TERMS_ADDRESS}</p>
          <p className="mt-3 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
            Version: {TERMS_VERSION}
          </p>

          <section className="mt-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className={headingClass}>{TERMS_SUMMARY.heading}</h2>
            <p className={`${textClass} mt-3`}>{TERMS_SUMMARY.body}</p>
            <ul className={`${textClass} mt-3 list-disc space-y-1 pl-5 marker:text-[var(--accent)]`}>
              {TERMS_SUMMARY.keyTerms.map((term) => (
                <li key={term}>{term}</li>
              ))}
            </ul>
            <p className={`${textClass} mt-3`}>
              Read the full{" "}
              <Link
                href="/returns"
                className="font-semibold text-[var(--accent)] hover:text-[var(--accent-bright)]"
              >
                Returns, Exchanges and Refunds Policy
              </Link>
              . How we handle your personal data online is set out in our{" "}
              <Link
                href="/privacy"
                className="font-semibold text-[var(--accent)] hover:text-[var(--accent-bright)]"
              >
                privacy policy
              </Link>
              .
            </p>
          </section>

          {TERMS_CLAUSES.map((clause) => (
            <section key={clause.number} id={`clause-${clause.number}`} className="mt-10 scroll-mt-24">
              <h2 className={headingClass}>
                {clause.number}. {clause.title}
              </h2>
              <ol className="mt-3 space-y-3">
                {clause.items.map((item, i) => (
                  <li key={item} className={`${textClass} grid grid-cols-[3rem_minmax(0,1fr)]`}>
                    <span className="font-semibold text-[var(--text-secondary)]">
                      {clause.number}.{i + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
