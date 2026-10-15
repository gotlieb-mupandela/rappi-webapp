/**
 * About page facts and owner-fillable copy.
 *
 * Company facts below are verified and always shown.
 * Anything under `owner` is hidden on the public page while it is blank or
 * still starts with PLACEHOLDER. Replace those strings to publish them.
 */
export const about = {
  company: {
    tradingName: "Rappi Sports Hub",
    legalName: "Rappi Investments CC",
    companyNumber: "CC/2025/02866",
    city: "Windhoek",
    country: "Namibia",
    email: "sales@rappisportshub.com",
    phoneDisplay: "+264 81 814 1646",
    phoneTel: "+264818141646",
  },
  owner: {
    mission: {
      en: "PLACEHOLDER: mission statement",
      fr: "PLACEHOLDER: énoncé de mission",
    },
    foundingYear: "PLACEHOLDER",
    team: [
      {
        name: "PLACEHOLDER: name",
        role: {
          en: "PLACEHOLDER: role",
          fr: "PLACEHOLDER: rôle",
        },
      },
    ],
  },
} as const;

export type AboutLocale = keyof typeof about.owner.mission;

/** Public copy only. Blank and PLACEHOLDER values stay off the page. */
export function publishedAboutText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || /^placeholder\b/i.test(trimmed)) return null;
  return trimmed;
}

export function publishedAboutTeam(locale: AboutLocale) {
  return about.owner.team.flatMap((person) => {
    const name = publishedAboutText(person.name);
    if (!name) return [];
    return [{ name, role: publishedAboutText(person.role[locale]) }];
  });
}
