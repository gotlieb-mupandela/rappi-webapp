import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { getMarket } from "@/lib/i18n/server";
import { contactEmail } from "@/lib/site-contact";
import { deleteAccountContent } from "./content";
import { DeleteAccountForm } from "./delete-account-form";

export const metadata: Metadata = {
  title: "Delete your account",
  description:
    "How to delete your RAPPI Sports Hub account and personal data, what we delete and what we keep.",
  alternates: { canonical: "/account/delete" },
};

const headingClass =
  "font-[family-name:var(--font-oswald)] text-xl uppercase tracking-tight text-[var(--text-secondary)] sm:text-2xl";
const textClass = "mt-3 text-sm leading-7 text-[var(--muted)] sm:text-base";
const listClass = `${textClass} list-disc space-y-2 pl-5 marker:text-[var(--accent)]`;

export default async function DeleteAccountPage() {
  const c = deleteAccountContent(await getMarket());
  const email = contactEmail();
  const mailto = `mailto:${email}?${new URLSearchParams({ subject: c.emailSubject })}`;

  return (
    <div>
      <PageHeader
        crumbs={[{ href: "/", key: "common.home" }, { href: "/account", key: "account.myAccount" }, { label: c.title }]}
        eyebrow={c.eyebrow}
        title={c.title}
        description={c.intro}
      />
      <div className="page-shell py-10 lg:py-14">
        <article className="max-w-3xl">
          <section>
            <h2 className={headingClass}>{c.stepsHeading}</h2>
            <h3 className="mt-6 text-sm font-semibold uppercase tracking-wider">{c.appLabel}</h3>
            <ol className={`${textClass} list-decimal space-y-2 pl-5 marker:text-[var(--accent)]`}>
              {c.appSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <h3 className="mt-6 text-sm font-semibold uppercase tracking-wider">{c.webLabel}</h3>
            <ol className={`${textClass} list-decimal space-y-2 pl-5 marker:text-[var(--accent)]`}>
              {c.webSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>

          <DeleteAccountForm copy={c.form} />

          <section className="mt-10">
            <h2 className={headingClass}>{c.emailHeading}</h2>
            <p className={textClass}>
              {c.emailBody}{" "}
              <a
                href={mailto}
                className="font-semibold text-[var(--accent)] hover:text-[var(--accent-bright)]"
              >
                {email}
              </a>
            </p>
          </section>

          <section className="mt-10">
            <h2 className={headingClass}>{c.deletedHeading}</h2>
            <ul className={listClass}>
              {c.deleted.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="mt-10">
            <h2 className={headingClass}>{c.keptHeading}</h2>
            <ul className={listClass}>
              {c.kept.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="mt-10">
            <h2 className={headingClass}>{c.timingHeading}</h2>
            <p className={textClass}>{c.timing}</p>
          </section>
        </article>
      </div>
    </div>
  );
}
