"use client";

import { PageHeader } from "@/components/page-header";
import { useLocale } from "@/components/locale-provider";
import { about, publishedAboutTeam, publishedAboutText, type AboutLocale } from "@/lib/about";

const headingClass =
  "font-[family-name:var(--font-oswald)] text-xl uppercase tracking-tight text-[var(--text-secondary)] sm:text-2xl";
const textClass = "mt-3 text-sm leading-7 text-[var(--muted)] sm:text-base";

const offers = [
  "about.offerTeamwear",
  "about.offerSportswear",
  "about.offerFootwear",
  "about.offerBalls",
  "about.offerKits",
  "about.offerPacks",
] as const;

export function AboutView() {
  const { t, market } = useLocale();
  const locale: AboutLocale = market === "eu" ? "fr" : "en";
  const mission = publishedAboutText(about.owner.mission[locale]);
  const foundingYear = publishedAboutText(about.owner.foundingYear);
  const team = publishedAboutTeam(locale);
  const { company } = about;

  return (
    <div>
      <PageHeader
        crumbs={[{ href: "/", key: "common.home" }, { key: "about.crumb" }]}
        eyebrowKey="about.eyebrow"
        titleKey="about.title"
        descriptionKey="about.intro"
      />
      <div className="page-shell py-10 lg:py-14">
        <article className="max-w-3xl">
          <section>
            <h2 className={headingClass}>{t("about.whoTitle")}</h2>
            <p className={textClass}>
              {t("about.whoBody", {
                name: company.tradingName,
                legal: company.legalName,
                number: company.companyNumber,
                city: company.city,
                country: company.country,
              })}
            </p>
            {foundingYear ? (
              <p className={textClass}>{t("about.founded", { year: foundingYear })}</p>
            ) : null}
            {mission ? (
              <>
                <h3 className="mt-8 font-[family-name:var(--font-oswald)] text-lg uppercase tracking-tight text-[var(--text-secondary)]">
                  {t("about.missionTitle")}
                </h3>
                <p className={textClass}>{mission}</p>
              </>
            ) : null}
          </section>

          <section className="mt-10">
            <h2 className={headingClass}>{t("about.offerTitle")}</h2>
            <ul className={`${textClass} list-disc space-y-2 pl-5 marker:text-[var(--accent)]`}>
              {offers.map((key) => (
                <li key={key}>{t(key)}</li>
              ))}
            </ul>
          </section>

          <section className="mt-10">
            <h2 className={headingClass}>{t("about.serveTitle")}</h2>
            <p className={textClass}>{t("about.serveBody")}</p>
          </section>

          {team.length > 0 ? (
            <section className="mt-10">
              <h2 className={headingClass}>{t("about.teamTitle")}</h2>
              <ul className={`${textClass} space-y-2`}>
                {team.map((person) => (
                  <li key={person.name}>
                    <span className="font-semibold text-[var(--text-secondary)]">{person.name}</span>
                    {person.role ? <span>, {person.role}</span> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="mt-10">
            <h2 className={headingClass}>{t("about.contactTitle")}</h2>
            <p className={textClass}>{t("about.contactBody")}</p>
            <dl className="mt-4 space-y-3 text-sm sm:text-base">
              <div>
                <dt className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                  {t("about.emailLabel")}
                </dt>
                <dd className="mt-1">
                  <a
                    href={`mailto:${company.email}`}
                    className="font-semibold text-[var(--accent)] hover:text-[var(--accent-bright)]"
                  >
                    {company.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                  {t("about.phoneLabel")}
                </dt>
                <dd className="mt-1">
                  <a
                    href={`tel:${company.phoneTel}`}
                    className="font-semibold text-[var(--accent)] hover:text-[var(--accent-bright)]"
                  >
                    {company.phoneDisplay}
                  </a>
                </dd>
              </div>
            </dl>
          </section>
        </article>
      </div>
    </div>
  );
}
