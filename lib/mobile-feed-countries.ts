import { VAT_COUNTRIES, type VatCountry } from "@/lib/vat";

/** Plain-text country name length. Longer names fail the check. They are not cut. */
export const COUNTRY_NAME_MAX = 80;

/** Checkout country list cap. A longer list fails the check. */
export const COUNTRY_LIST_CAP = 300;

export type FeedCheckoutCountry = {
  code: string;
  name: string;
  vatRate: number;
};

/**
 * One fixed name to ISO 3166-1 alpha-2 table.
 * Keys are the exact VAT_COUNTRIES name strings.
 * Kosovo has no official ISO 3166-1 alpha-2 assignment. XK is the user-assigned
 * code used by the EU. The drift check still fails if that row is removed.
 */
const VAT_ISO_PAIRS: readonly (readonly [string, string])[] = [
  ["Albania", "AL"],
  ["Angola", "AO"],
  ["Argentina", "AR"],
  ["Armenia", "AM"],
  ["Australia", "AU"],
  ["Austria", "AT"],
  ["Azerbaijan", "AZ"],
  ["Bahamas", "BS"],
  ["Bahrain", "BH"],
  ["Bangladesh", "BD"],
  ["Belgium", "BE"],
  ["Bermuda", "BM"],
  ["Bolivia", "BO"],
  ["Bosnia and Herzegovina", "BA"],
  ["Botswana", "BW"],
  ["Brazil", "BR"],
  ["Brunei Darussalam", "BN"],
  ["Bulgaria", "BG"],
  ["Cambodia", "KH"],
  ["Cameroon", "CM"],
  ["Canada", "CA"],
  ["Cayman Islands", "KY"],
  ["Chile", "CL"],
  ["China", "CN"],
  ["Colombia", "CO"],
  ["Costa Rica", "CR"],
  ["C\u00f4te d\u2019Ivoire", "CI"],
  ["Croatia", "HR"],
  ["Cyprus", "CY"],
  ["Czechia", "CZ"],
  ["Democratic Republic of the Congo", "CD"],
  ["Denmark", "DK"],
  ["Dominican Republic", "DO"],
  ["Ecuador", "EC"],
  ["Egypt", "EG"],
  ["El Salvador", "SV"],
  ["Equatorial Guinea", "GQ"],
  ["Estonia", "EE"],
  ["Eswatini", "SZ"],
  ["Ethiopia", "ET"],
  ["Finland", "FI"],
  ["France", "FR"],
  ["Gabon", "GA"],
  ["Georgia", "GE"],
  ["Germany", "DE"],
  ["Ghana", "GH"],
  ["Gibraltar", "GI"],
  ["Greece", "GR"],
  ["Guatemala", "GT"],
  ["Guernsey", "GG"],
  ["Honduras", "HN"],
  ["Hong Kong SAR", "HK"],
  ["Hungary", "HU"],
  ["Iceland", "IS"],
  ["India", "IN"],
  ["Indonesia", "ID"],
  ["Ireland", "IE"],
  ["Isle of Man", "IM"],
  ["Israel", "IL"],
  ["Italy", "IT"],
  ["Jamaica", "JM"],
  ["Japan", "JP"],
  ["Jersey", "JE"],
  ["Jordan", "JO"],
  ["Kazakhstan", "KZ"],
  ["Kenya", "KE"],
  ["Kosovo", "XK"],
  ["Kuwait", "KW"],
  ["Lao PDR", "LA"],
  ["Latvia", "LV"],
  ["Lebanon", "LB"],
  ["Libya", "LY"],
  ["Liechtenstein", "LI"],
  ["Lithuania", "LT"],
  ["Luxembourg", "LU"],
  ["Macau SAR", "MO"],
  ["Malaysia", "MY"],
  ["Malta", "MT"],
  ["Mauritania", "MR"],
  ["Mauritius", "MU"],
  ["Mexico", "MX"],
  ["Moldova", "MD"],
  ["Mongolia", "MN"],
  ["Montenegro", "ME"],
  ["Mozambique", "MZ"],
  ["Myanmar", "MM"],
  ["Namibia", "NA"],
  ["Netherlands", "NL"],
  ["New Caledonia", "NC"],
  ["New Zealand", "NZ"],
  ["Nicaragua", "NI"],
  ["Nigeria", "NG"],
  ["North Macedonia", "MK"],
  ["Norway", "NO"],
  ["Oman", "OM"],
  ["Pakistan", "PK"],
  ["Palestinian territories", "PS"],
  ["Panama", "PA"],
  ["Papua New Guinea", "PG"],
  ["Paraguay", "PY"],
  ["Peru", "PE"],
  ["Philippines", "PH"],
  ["Poland", "PL"],
  ["Portugal", "PT"],
  ["Qatar", "QA"],
  ["Republic of the Congo", "CG"],
  ["Romania", "RO"],
  ["Russia", "RU"],
  ["Rwanda", "RW"],
  ["Saudi Arabia", "SA"],
  ["Senegal", "SN"],
  ["Serbia", "RS"],
  ["Singapore", "SG"],
  ["Slovakia", "SK"],
  ["Slovenia", "SI"],
  ["South Africa", "ZA"],
  ["South Korea", "KR"],
  ["Spain", "ES"],
  ["Sweden", "SE"],
  ["Switzerland", "CH"],
  ["Taiwan", "TW"],
  ["Tanzania", "TZ"],
  ["Thailand", "TH"],
  ["Trinidad and Tobago", "TT"],
  ["Turkey", "TR"],
  ["Uganda", "UG"],
  ["Ukraine", "UA"],
  ["United Arab Emirates", "AE"],
  ["United Kingdom", "GB"],
  ["United States", "US"],
  ["Uruguay", "UY"],
  ["Uzbekistan", "UZ"],
  ["Venezuela", "VE"],
  ["Vietnam", "VN"],
  ["Zambia", "ZM"],
];

function buildIsoTable(pairs: readonly (readonly [string, string])[]): ReadonlyMap<string, string> {
  const names = new Map<string, string>();
  const codes = new Set<string>();
  for (const [name, code] of pairs) {
    if (names.has(name)) throw new Error(`ISO table repeats the name ${name}`);
    if (!/^[A-Z]{2}$/.test(code)) throw new Error(`ISO table code for ${name} is not two uppercase letters`);
    if (codes.has(code)) throw new Error(`ISO table repeats the code ${code}`);
    codes.add(code);
    names.set(name, code);
  }
  return names;
}

export const VAT_ISO_BY_NAME: ReadonlyMap<string, string> = buildIsoTable(VAT_ISO_PAIRS);

const CODE_PATTERN = /^[A-Z]{2}$/;
const CONTROL_PATTERN = /[\u0000-\u001f\u007f<>]/;

/**
 * Countries for display. Built from VAT_COUNTRIES at call time.
 * The result is an array. Country codes are never used as object keys.
 * Throws when a row has no code, two rows share a code, the rate is not a
 * finite fraction from 0 to 1, the name is empty, too long, or has control
 * characters, or the list is over the cap.
 */
export function checkoutCountries(
  rows: readonly Pick<VatCountry, "name" | "rate">[] = VAT_COUNTRIES,
  isoByName: ReadonlyMap<string, string> = VAT_ISO_BY_NAME,
): FeedCheckoutCountry[] {
  if (rows.length > COUNTRY_LIST_CAP) {
    throw new Error(`Checkout country list is over the cap of ${COUNTRY_LIST_CAP}`);
  }
  const countries: FeedCheckoutCountry[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const name = typeof row.name === "string" ? row.name : "";
    if (!name.trim()) throw new Error("Checkout country name is empty");
    if (name.length > COUNTRY_NAME_MAX) {
      throw new Error(`Checkout country name is over ${COUNTRY_NAME_MAX} characters`);
    }
    if (CONTROL_PATTERN.test(name)) {
      throw new Error(`Checkout country name has control characters: ${name}`);
    }
    const code = isoByName.get(name);
    if (!code || !CODE_PATTERN.test(code)) {
      throw new Error(`Checkout country has no ISO code: ${name}`);
    }
    if (seen.has(code)) throw new Error(`Checkout country code is duplicated: ${code}`);
    seen.add(code);
    if (typeof row.rate !== "number" || !Number.isFinite(row.rate)) {
      throw new Error(`Checkout VAT rate is not finite: ${name}`);
    }
    const vatRate = row.rate / 100;
    if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 1) {
      throw new Error(`Checkout VAT rate is out of range: ${name}`);
    }
    countries.push({ code, name, vatRate });
  }
  return countries;
}

/** ISO codes in VAT_COUNTRIES order. Names are not copied into the feed. */
export function checkoutVatCountryCodes(
  rows: readonly Pick<VatCountry, "name" | "rate">[] = VAT_COUNTRIES,
  isoByName: ReadonlyMap<string, string> = VAT_ISO_BY_NAME,
): string[] {
  return checkoutCountries(rows, isoByName).map((row) => row.code);
}

/**
 * Store VAT as a fraction. Namibia is the default market (15% is 0.15).
 * Throws when that row is missing or the fraction is not finite in 0..1.
 */
export function checkoutVatRate(
  rows: readonly Pick<VatCountry, "name" | "rate">[] = VAT_COUNTRIES,
): number {
  const row = rows.find((item) => item.name === "Namibia");
  if (!row) throw new Error("Checkout VAT rate is missing");
  if (typeof row.rate !== "number" || !Number.isFinite(row.rate)) {
    throw new Error("Checkout VAT rate is not finite");
  }
  const vatRate = row.rate / 100;
  if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 1) {
    throw new Error("Checkout VAT rate is out of range");
  }
  return vatRate;
}
