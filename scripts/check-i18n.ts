import { DEFAULT_EUR_PER_NAD } from "../lib/i18n/config";
import { nadToEur, eurToNad, formatMoney } from "../lib/i18n/currency";
import { detectMarketFromSignals, prefersFrench } from "../lib/i18n/detect";
import { audienceName, hubName, subName } from "../lib/i18n/labels";
import { en, fr } from "../lib/i18n/messages";
import { makeT } from "../lib/i18n/translate";
import { SHIPPING_METHODS } from "../lib/shipping";
import { quoteVat, resolveVatCountry } from "../lib/vat";
import { SUBCATEGORY_LABELS, CATEGORIES, AUDIENCES } from "../lib/catalog";

function fail(msg: string) {
  console.error(`FAIL ${msg}`);
  process.exitCode = 1;
}

function keysOf(obj: unknown, prefix = ""): string[] {
  if (!obj || typeof obj !== "object") return [];
  const rec = obj as Record<string, unknown>;
  const out: string[] = [];
  for (const [k, v] of Object.entries(rec)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !("one" in (v as object) && "other" in (v as object))) {
      out.push(...keysOf(v, path));
    } else {
      out.push(path);
    }
  }
  return out;
}

if (DEFAULT_EUR_PER_NAD !== 0.05) fail("default rate is not 0.05");
if (nadToEur(100) !== 5) fail(`N$100 → ${nadToEur(100)} EUR, expected 5`);
if (nadToEur(150) !== 7.5) fail(`N$150 → ${nadToEur(150)} EUR, expected 7.5`);
if (eurToNad(5) !== 100) fail(`€5 → ${eurToNad(5)} NAD, expected 100`);
if (!formatMoney(2555, "na").includes("N$")) fail("NAD format missing N$");
if (!formatMoney(2555, "eu").includes("€") && !formatMoney(2555, "eu").includes("EUR")) {
  fail(`EUR format unexpected: ${formatMoney(2555, "eu")}`);
}

if (detectMarketFromSignals({}) !== "na") fail("default market is not Namibia");
if (detectMarketFromSignals({ country: "NA", acceptLanguage: "fr" }) !== "na") {
  fail("Namibia geo must win over French language (Namibia-first)");
}
if (detectMarketFromSignals({ country: "FR" }) !== "eu") fail("FR geo should be EU market");
if (detectMarketFromSignals({ acceptLanguage: "fr-FR,fr;q=0.9,en;q=0.8" }) !== "eu") {
  fail("French Accept-Language should be EU market");
}
if (detectMarketFromSignals({ acceptLanguage: "en-US,en;q=0.9" }) !== "na") {
  fail("English Accept-Language should stay Namibia");
}
if (detectMarketFromSignals({ cookie: "eu", country: "NA" }) !== "eu") {
  fail("manual cookie must override geo");
}
if (!prefersFrench("fr")) fail("prefersFrench('fr')");
if (prefersFrench("en-US,fr;q=0.4")) fail("English-first should not prefer French");

const costs = Object.fromEntries(SHIPPING_METHODS.map((m) => [m.id, m.cost]));
if (costs.standard !== 100 || costs.express !== 150 || costs.pickup !== 0) {
  fail("shipping NAD rates drifted from 100/150/0");
}
if (resolveVatCountry("NA")?.rate !== 15) fail("Namibia VAT is not 15%");
if (resolveVatCountry("France")?.rate !== 20) fail("France VAT is not 20%");
if (quoteVat("Namibia", 100).amount !== 15 || quoteVat("Namibia", 100).total !== 115) {
  fail("Namibia VAT quote drifted");
}
if (quoteVat("United States", 200).amount !== 0) fail("US VAT should be 0");

const tFr = makeT("eu");
const tEn = makeT("na");
if (tEn("nav.cart") === tFr("nav.cart")) fail("FR cart label matches EN");
if (tFr("shipping.pickup") === tEn("shipping.pickup")) fail("FR pickup label matches EN");
if (!tFr("checkout.emptyHint").includes("{standard}")) fail("FR empty checkout hint missing rate slots");

const enKeys = keysOf(en).sort();
const frKeys = keysOf(fr).sort();
for (const key of enKeys) {
  if (!frKeys.includes(key)) fail(`FR missing key ${key}`);
}
for (const key of frKeys) {
  if (!enKeys.includes(key)) fail(`EN missing key ${key}`);
}

const mustDiffer = [
  "nav.cart",
  "nav.search",
  "common.home",
  "common.addToBag",
  "search.title",
  "filters.filters",
  "cart.empty",
  "checkout.placeOrder",
  "account.orders",
  "login.title",
  "product.soldOut",
  "hub.swimming.name",
  "hub.shoes.name",
  "hub.hiking.name",
  "audience.men.name",
  "audience.women.name",
  "audience.kids.name",
  "sub.tees",
  "sub.jackets",
  "theme.toDark",
  "common.loadingStorefront",
];
for (const key of mustDiffer) {
  if (tFr(key) === tEn(key)) fail(`FR ${key} still equals EN`);
  if (tFr(key) === key) fail(`FR ${key} missing`);
}

for (const cat of CATEGORIES) {
  if (hubName(cat.slug, tFr).startsWith("hub.")) fail(`FR hub name missing for ${cat.slug}`);
}
for (const a of AUDIENCES) {
  if (audienceName(a.slug, tFr).startsWith("audience.")) fail(`FR audience missing for ${a.slug}`);
}
for (const slug of Object.keys(SUBCATEGORY_LABELS)) {
  if (subName(slug, tFr) === `sub.${slug}`) fail(`FR subcategory missing for ${slug}`);
}

if (audienceName("men", tFr) !== "Hommes") fail("FR men label");
if (audienceName("women", tFr) !== "Femmes") fail("FR women label");
if (audienceName("kids", tFr) !== "Enfants") fail("FR kids label");
if (hubName("shoes", tFr) !== "Chaussures") fail("FR shoes hub");
if (hubName("swimming", tFr) !== "Natation") fail("FR swimming hub");

if (!process.exitCode) console.log("i18n checks ok");
