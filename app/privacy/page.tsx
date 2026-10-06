import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { getMarket } from "@/lib/i18n/server";
import { contactEmail } from "@/lib/site-contact";
import { privacyPolicy } from "./policy";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "How RAPPI Sports Hub collects, uses and protects your personal data on the website and in the app.",
  alternates: { canonical: "/privacy" },
};

const headingClass =
  "font-[family-name:var(--font-oswald)] text-xl uppercase tracking-tight text-[var(--text-secondary)] sm:text-2xl";
const textClass = "mt-3 text-sm leading-7 text-[var(--muted)] sm:text-base";

export default async function PrivacyPage() {
  const policy = privacyPolicy(await getMarket());
  const email = contactEmail();

  return (
    <div>
      <PageHeader
        crumbs={[{ href: "/", key: "common.home" }, { label: policy.title }]}
        eyebrow={policy.eyebrow}
        title={policy.title}
        description={policy.intro}
      />
      <div className="page-shell py-10 lg:py-14">
        <article className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
            {policy.updatedLabel}: {policy.updated}
          </p>
          {policy.sections.map((section) => (
            <section key={section.heading} className="mt-10">
              <h2 className={headingClass}>{section.heading}</h2>
              {section.body?.map((p) => (
                <p key={p} className={textClass}>
                  {p}
                </p>
              ))}
              {section.items ? (
                <ul className={`${textClass} list-disc space-y-2 pl-5 marker:text-[var(--accent)]`}>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
          <section className="mt-10">
            <h2 className={headingClass}>{policy.contactHeading}</h2>
            <p className={textClass}>
              {policy.contactBody}{" "}
              <a
                href={`mailto:${email}`}
                className="font-semibold text-[var(--accent)] hover:text-[var(--accent-bright)]"
              >
                {email}
              </a>
              .
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}
