import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { getMarket } from "@/lib/i18n/server";
import {
  RETURNS_ADDRESS,
  RETURNS_CLAUSES,
  RETURNS_COMPANY,
  RETURNS_INTRO,
  RETURNS_SUMMARY,
  RETURNS_VERSION,
} from "./policy";

export const metadata: Metadata = {
  title: "Returns, exchanges and refunds",
  description:
    "Returns, Exchanges and Refunds Policy for RAPPI Investments CC, trading as RAPPI Sports Hub.",
  alternates: { canonical: "/returns" },
};

const headingClass =
  "font-[family-name:var(--font-oswald)] text-xl uppercase tracking-tight text-[var(--text-secondary)] sm:text-2xl";
const textClass = "text-sm leading-7 text-[var(--muted)] sm:text-base";
const listClass = `${textClass} mt-3 list-disc space-y-2 pl-5 marker:text-[var(--accent)]`;
const linkClass = "font-semibold text-[var(--accent)] hover:text-[var(--accent-bright)]";

export default async function ReturnsPage() {
  const french = (await getMarket()) === "eu";

  return (
    <div>
      <PageHeader
        crumbs={[{ href: "/", key: "common.home" }, { key: "footer.returns" }]}
        eyebrow="Legal"
        title="Returns, exchanges and refunds"
        description={RETURNS_INTRO}
      />
      <div className="page-shell py-10 lg:py-14">
        <article className="max-w-3xl">
          {french ? (
            <p className={`${textClass} mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4`}>
              Cette politique de retour est disponible en anglais uniquement. La version anglaise fait
              foi.
            </p>
          ) : null}
          <p className={textClass}>{RETURNS_COMPANY}</p>
          <p className={textClass}>{RETURNS_ADDRESS}</p>
          <p className="mt-3 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
            Version: {RETURNS_VERSION}
          </p>

          <section className="mt-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className={headingClass}>{RETURNS_SUMMARY.heading}</h2>
            <ul className={listClass}>
              {RETURNS_SUMMARY.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className={`${textClass} mt-3`}>
              This policy forms part of our{" "}
              <Link href="/terms" className={linkClass}>
                terms and conditions
              </Link>
              .
            </p>
          </section>

          {RETURNS_CLAUSES.map((clause) => (
            <section key={clause.number} id={`clause-${clause.number}`} className="mt-10 scroll-mt-24">
              <h2 className={headingClass}>
                {clause.number}. {clause.title}
              </h2>
              {clause.body?.map((p) => (
                <p key={p} className={`${textClass} mt-3`}>
                  {p}
                </p>
              ))}
              {clause.items ? (
                <ul className={listClass}>
                  {clause.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
              {clause.after?.map((p) => (
                <p key={p} className={`${textClass} mt-3`}>
                  {p}
                </p>
              ))}
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
