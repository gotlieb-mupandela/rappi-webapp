/**
 * Mobile feed checks: version query handling, fixed target keys, public copy,
 * absolute card photos, checkout countries, and the navigation tree.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { clientAssortment, renderAssortmentLabel } from "../lib/assortment";
import { AUDIENCES, CATEGORIES } from "../lib/catalog";
import { catalogVersion } from "../lib/catalog-version";
import { formatPrice } from "../lib/format";
import { productInHub } from "../lib/hub-membership";
import {
  audienceTiles,
  footwearLandingTiles,
  sportSeriesFolders,
  subcategoryHubGroups,
} from "../lib/hubs";
import { allowedImageHosts, imageHostAllows } from "../lib/image-hosts";
import { eurPerNad } from "../lib/i18n/config";
import { audienceName, shippingName, subName } from "../lib/i18n/labels";
import { makeT } from "../lib/i18n/translate";
import { isLiveFolder } from "../lib/joma-live";
import { FOOTWEAR_FOLDERS, jomaFolderMetaSnapshot } from "../lib/joma-tree";
import { filterListing, toClientProduct, type ListingItem } from "../lib/listing-core";
import { listingCardCandidates } from "../lib/media";
import { CANONICAL_SITE_ORIGIN } from "../lib/meta/site";
import {
  checkoutCountries,
  checkoutVatCountryCodes,
  checkoutVatRate,
  COUNTRY_LIST_CAP,
  COUNTRY_NAME_MAX,
} from "../lib/mobile-feed-countries";
import { jomaTeamsLandingTiles } from "../lib/joma-nav";
import { jomaLandingTileImage } from "../lib/joma-tile-images";
import {
  assertFiniteInteger,
  assertFiniteNumber,
  buildMobileStorefront,
  FEED_PRODUCT_KEYS,
  feedImageUrl,
  feedProductCard,
  memoizedMobileStorefront,
  mobileStorefrontBuildCount,
  STOREFRONT_CACHE,
  storefrontFromFeed,
  type FeedNode,
  type FeedProduct,
  type MobileStorefront,
} from "../lib/mobile-feed";
import { LEGACY_FOLDER_SLUGS, publicCopy, publicFolderKey } from "../lib/mobile-feed-slugs";
import {
  FEED_EXCLUDED_FOLDER_KEY,
  FLOW_TILE,
  HOME_TILES,
  KIDS_FOOTWEAR_TILE,
  KIDS_TILES,
  NAMESPACED_FEED_KEY,
  PROMO_TILES,
  SHOE_TILES,
  SUB_LINK_TARGETS,
  TEAM_TILES,
  feedAllowedTargets,
  feedMenuKey,
  feedTargetFor,
  feedTargetKeys,
  feedTargetSet,
  feedTargetTable,
  folderHref,
  headerMenuKeys,
  kidsAgeChildren,
  namespacedFeedTargets,
  sponsorReplicaTiles,
} from "../lib/mobile-feed-targets";
import { products as siteCatalog } from "../lib/products";
import { feedVersionParamStatus, mobileFeedVersion } from "../lib/mobile-feed-version";
import { SHIPPING_METHODS } from "../lib/shipping";
import type { Product } from "../lib/types";
import { productLineLabel } from "../lib/joma-item";
import { VAT_COUNTRIES } from "../lib/vat";
import { loadFixtureProducts } from "./feed-fixture";
import { renderStorefrontSubLinks, storefrontSubLinks, subLinkTargetId } from "./gen-sub-links";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const tFr = makeT("eu");

function asFeedPlain(value: string): string {
  return publicCopy(value)
    .replace(/[<>\u0000-\u001f\u007f]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** French card badge, then the same plain-text pass the feed uses. Null when label is null. */
function expectedLabelFr(product: Product): string | null {
  const view = clientAssortment(product);
  if (!view.label || !asFeedPlain(view.label)) return null;
  const rendered = renderAssortmentLabel(view.labelKey, view.labelParams, tFr, view.label);
  if (!rendered) return null;
  return asFeedPlain(rendered) || null;
}

function fail(message: string): never {
  throw new Error(message);
}

function read(relative: string) {
  return readFileSync(join(root, relative), "utf8");
}

function walkFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walkFiles(path, out);
    else if (/\.(ts|tsx|js|mjs)$/.test(name)) out.push(path);
  }
  return out;
}

const HOST_LIST_KEYS = new Set(["allowedHosts", "allowedImageHosts", "imageHosts", "hosts"]);
const BANNED_KEYS = new Set(["href", "vatRates", "vatCountries", "targetId"]);
const PREFIX = /^(menu|group|sub|search|category|team|audience):/;

function throws(run: () => unknown, pattern: RegExp) {
  assert.throws(run, (error: unknown) => {
    assert.match(error instanceof Error ? error.message : String(error), pattern);
    return true;
  });
}

const iso = new Map<string, string>([
  ["One", "AA"],
  ["Two", "BB"],
]);
throws(() => checkoutCountries([{ name: "Narnia", rate: 15 }], iso), /no ISO code/);
throws(
  () => checkoutCountries([{ name: "One", rate: 10 }, { name: "Two", rate: 10 }], new Map([["One", "AA"], ["Two", "AA"]])),
  /duplicated/,
);
throws(() => checkoutCountries([{ name: "One", rate: Number.NaN }], iso), /not finite/);
throws(() => checkoutCountries([{ name: "One", rate: Number.POSITIVE_INFINITY }], iso), /not finite/);
throws(() => checkoutCountries([{ name: "One", rate: 150 }], iso), /out of range/);
throws(() => checkoutCountries([{ name: "One", rate: -1 }], iso), /out of range/);
throws(() => checkoutCountries([{ name: "   ", rate: 0 }], new Map([["   ", "AA"]])), /empty/);
throws(
  () => checkoutCountries([{ name: "A".repeat(COUNTRY_NAME_MAX + 1), rate: 0 }], new Map([["A".repeat(COUNTRY_NAME_MAX + 1), "AA"]])),
  /over 80/,
);
throws(() => checkoutCountries([{ name: "A\nB", rate: 0 }], new Map([["A\nB", "AA"]])), /control/);
throws(() => checkoutCountries([{ name: "Bad", rate: 0 }], new Map([["Bad", "__proto__"]])), /no ISO code/);
throws(
  () => checkoutCountries(Array.from({ length: COUNTRY_LIST_CAP + 1 }, () => ({ name: "One", rate: 0 }))),
  /cap/,
);
assert.equal(checkoutCountries([{ name: "One", rate: 0 }], iso)[0]?.vatRate, 0);
assert.equal(checkoutCountries([{ name: "One", rate: 100 }], iso)[0]?.vatRate, 1);
assert.equal(checkoutVatRate(), 0.15);
assert.deepEqual(checkoutVatCountryCodes(), checkoutCountries().map((row) => row.code));
throws(() => checkoutVatRate([]), /missing/);
throws(() => checkoutVatRate([{ name: "Namibia", rate: Number.NaN }]), /not finite/);
throws(() => checkoutVatRate([{ name: "Namibia", rate: Number.POSITIVE_INFINITY }]), /not finite/);
throws(() => checkoutVatRate([{ name: "Namibia", rate: 150 }]), /out of range/);
throws(() => assertFiniteNumber(Number.NaN, "amountNad"), /not a finite number/);
throws(() => assertFiniteNumber(Number.POSITIVE_INFINITY, "vatRate"), /not a finite number/);
throws(() => assertFiniteInteger(1.5, "order"), /not an integer/);
assert.equal(({} as { polluted?: boolean }).polluted, undefined);

const countries = checkoutCountries();
assert.equal(countries.length, VAT_COUNTRIES.length);
assert.equal(countries.length <= COUNTRY_LIST_CAP, true);
const countryCodes = new Set<string>();
for (const row of VAT_COUNTRIES) {
  const found = countries.find((country) => country.name === row.name);
  assert.ok(found, row.name);
  assert.match(found.code, /^[A-Z]{2}$/);
  assert.equal(countryCodes.has(found.code), false, found.code);
  countryCodes.add(found.code);
  assert.equal(found.vatRate, row.rate / 100, row.name);
  assert.equal(found.name.length > 0 && found.name.length <= COUNTRY_NAME_MAX, true, row.name);
  assert.equal(/[\u0000-\u001f\u007f<>]/.test(found.name), false, row.name);
}
assert.equal(countries.find((country) => country.name === "Kosovo")?.code, "XK");
assert.equal(Array.isArray(countries), true);

const probe = "zz-cache-key-probe";
assert.equal(feedVersionParamStatus([]), "ok");
assert.equal(feedVersionParamStatus(["abc.DEF_01-2"]), "ok");
assert.equal(feedVersionParamStatus([""]), "invalid");
assert.equal(feedVersionParamStatus(["bad value"]), "invalid");
assert.equal(feedVersionParamStatus(["%%%"]), "invalid");
assert.equal(feedVersionParamStatus([probe, probe]), "invalid");
assert.equal(feedVersionParamStatus([probe]), "ok");
const invalidBody = JSON.stringify({ error: "Invalid version." });
assert.equal(invalidBody.includes(probe), false);
assert.equal(invalidBody.includes("bad value"), false);

assert.deepEqual(Object.keys(LEGACY_FOLDER_SLUGS).sort(), ["joma-flow", "joma-kids"]);
assert.equal(publicFolderKey("joma-flow"), "flow");
assert.equal(publicFolderKey("joma-kids"), "kids");
assert.equal(publicFolderKey("wf-joma-flow"), "wf-flow");
assert.equal(folderHref(FEED_EXCLUDED_FOLDER_KEY), null);
assert.equal(feedTargetTable().has(FLOW_TILE.id), false);
assert.equal(feedTargetTable().has(publicFolderKey(FEED_EXCLUDED_FOLDER_KEY)), false);
assert.equal(feedTargetTable().get("jackets"), "/shop/sportswear?group=jackets");
assert.equal(feedTargetTable().get("pants"), "/shop/sportswear?group=pants");
assert.equal(feedTargetTable().get("shoes"), "/category/shoes");
assert.equal(feedTargetTable().get("accessories"), "/shop/balls-bags");
assert.equal(folderHref("tw-football"), "/shop/football?group=tw-football");
assert.equal(folderHref("tw-football-tshirts"), "/shop/football?group=tw-football-tshirts");
assert.equal(feedTargetTable().get("tw-football-tshirts"), "/shop/football?group=tw-football-tshirts");

const products = loadFixtureProducts();
assert.equal(products.length, 20);
const version = catalogVersion(products);
const feed = buildMobileStorefront(products, version);
assert.equal(feed.version, mobileFeedVersion(version));
assert.equal(feed.version.endsWith(".8"), true);
const buildsBefore = mobileStorefrontBuildCount();
const memoFirst = memoizedMobileStorefront(products, version);
assert.equal(mobileStorefrontBuildCount(), buildsBefore + 1);
const memoAgain = memoizedMobileStorefront(products, version);
assert.equal(memoAgain, memoFirst);
assert.equal(mobileStorefrontBuildCount(), buildsBefore + 1);
assert.equal(memoFirst.version, feed.version);
const matchedVersion = storefrontFromFeed([memoFirst.version], memoFirst);
assert.equal(matchedVersion.status, 200);
assert.equal(matchedVersion.cacheControl, STOREFRONT_CACHE);
assert.equal(matchedVersion.cacheControl.includes("s-maxage=300"), true);
assert.equal(matchedVersion.body, memoFirst);
const staleVersion = "zzzzzzzz.8";
const stale = storefrontFromFeed([staleVersion], memoFirst);
assert.equal(stale.status, 200);
assert.equal(stale.cacheControl, "no-store");
assert.equal(stale.body, memoFirst);
assert.equal(JSON.stringify(stale.body).includes(staleVersion), false);
assert.equal(mobileStorefrontBuildCount(), buildsBefore + 1);
const invalidVersion = storefrontFromFeed(["bad value"], memoFirst);
assert.equal(invalidVersion.status, 400);
assert.equal(invalidVersion.cacheControl, "no-store");
assert.deepEqual(invalidVersion.body, { error: "Invalid version." });
assert.equal(JSON.stringify(invalidVersion.body).includes("bad value"), false);
assert.equal(mobileStorefrontBuildCount(), buildsBefore + 1);
assert.equal(feedBodyHas(feed, probe), false);
assert.deepEqual(feed.menus, headerMenuKeys());
assert.deepEqual(feed.categoryOrder, CATEGORIES.map((category) => category.slug));
assert.deepEqual(Object.keys(feed.checkout), ["countries", "eurPerNad", "shipping"]);
assert.deepEqual(feed.checkout.countries, checkoutCountries());
assert.equal(feed.checkout.countries.find((row) => row.code === "NA")?.vatRate, 0.15);
assert.equal(feed.checkout.countries.find((row) => row.name === "Kosovo")?.code, "XK");
assert.equal("vatRate" in feed.checkout, false);
assert.equal("vatCountries" in feed.checkout, false);
assert.equal(feed.checkout.eurPerNad, eurPerNad());
assert.equal(typeof feed.checkout.eurPerNad, "number");
assert.equal(Number.isFinite(feed.checkout.eurPerNad) && feed.checkout.eurPerNad > 0, true);
assert.deepEqual(
  feed.checkout.shipping.map((method) => method.key),
  SHIPPING_METHODS.map((method) => method.id),
);
for (const method of SHIPPING_METHODS) {
  const row = feed.checkout.shipping.find((item) => item.key === method.id);
  assert.ok(row);
  assert.equal(typeof row.amountNad, "number");
  assert.equal(Number.isFinite(row.amountNad) && row.amountNad >= 0, true, method.id);
  assert.equal(row.amountNad, method.cost);
  assert.equal(row.title.en, method.name);
  const french = shippingName(method.id, method.name, tFr);
  assert.equal(row.title.fr, french || method.name);
  assert.equal(row.title.fr.length > 0, true, method.id);
  assert.equal(/[<>\u0000-\u001f\u007f]/.test(row.title.en), false, method.id);
  assert.equal(/[<>\u0000-\u001f\u007f]/.test(row.title.fr), false, method.id);
}
assert.equal("vatRates" in feed.checkout, false);
assert.equal("vatCountries" in feed.checkout, false);
assert.equal("vatRate" in feed.checkout, false);

const byKey = indexNodes(feed);
assert.equal(byKey.size, feed.nodes.length);
for (const key of feedTargetKeys()) assert.equal(byKey.has(key), true, key);
assertFeedShape(feed);

for (const value of copyValues(feed)) {
  if (value.toLowerCase().includes("joma")) fail(`public copy contains the brand word: ${value}`);
}

for (const card of feed.products) {
  const source = products.find((product) => product.code === card.code);
  assert.ok(source);
  assert.equal(card.cardImage, card.images[0] ?? null, card.code);
  const siteFirst = feedImageUrl(listingCardCandidates(source)[0] ?? null);
  if (siteFirst) assert.equal(card.cardImage, siteFirst, card.code);
  if (card.cardImage === null) {
    assert.equal(card.code === "HTTP-DROP", true, card.code);
    assert.equal(card.images.length, 0);
  } else {
    assert.equal(card.cardImage.startsWith("https://"), true, card.code);
    assert.equal(card.cardImage.startsWith("/"), false, card.code);
    assert.equal(feedImageUrl(card.cardImage), card.cardImage, card.code);
  }
  const expectedLabel = clientAssortment(source).label;
  assert.equal(card.packLabel, card.label);
  assert.equal(card.labelFr, expectedLabelFr(source), card.code);
  if (expectedLabel) {
    assert.equal(typeof card.label, "string", card.code);
    assert.equal(card.label!.toLowerCase().includes("joma"), false, card.code);
    assert.equal(card.label!.includes("<"), false, card.code);
    assert.equal(typeof card.labelFr, "string", card.code);
    assert.equal(/[<>\u0000-\u001f\u007f]/.test(card.labelFr!), false, card.code);
  } else {
    assert.equal(card.label, null, card.code);
    assert.equal(card.labelFr, null, card.code);
  }
  assert.ok(card.line === null || typeof card.line === "string", card.code);
  assert.deepEqual(Object.keys(card), [...FEED_PRODUCT_KEYS]);
  for (const banned of ["item", "sheetCategory", "hay", "folders"]) {
    assert.equal(Object.hasOwn(card, banned), false, card.code);
  }
  assert.equal("title" in card, false, card.code);
  assert.equal("description" in card, false, card.code);
  assert.equal(/[<>\u0000-\u001f\u007f]/.test(card.name), false, card.code);
  assert.equal("imageUrl" in card, false);
  assert.equal(typeof card.price, "number");
}
for (const image of everyImage(feed)) {
  if (image === null) continue;
  assert.equal(image.startsWith("https://"), true, image);
  assert.equal(feedImageUrl(image), image, image);
}
const home = byKey.get(feedMenuKey("home"));
assert.ok(home);
for (const key of home.tiles) {
  const image = byKey.get(key)?.image ?? null;
  if (image) assertAllowedFeedImage(image, key);
}
assertNoHostList(feed);
assert.equal(JSON.stringify(feed).toLowerCase().includes("access-control"), false);
assert.equal(JSON.stringify(feed).includes("example.com"), false);
assert.equal(JSON.stringify(feed).includes("http://"), false);
assert.equal(JSON.stringify(feed).includes("joma-flow"), false);
assert.equal(JSON.stringify(feed).includes("joma-kids"), false);
assert.equal(JSON.stringify(feed).includes("vatRates"), false);

const poisoned = buildMobileStorefront(
  [
    {
      ...products.find((product) => product.code === "PLAIN-01")!,
      id: "POISON",
      code: "POISON",
      name: "Plain name",
      displayName: "Plain name",
      item: "Plain name",
      title: "Plain name",
      folders: ["/shop/evil-not-listed", "https://evil.example/phish"],
    },
  ],
  version,
);
assert.equal(JSON.stringify(poisoned).includes("/shop/evil-not-listed"), false);
assert.equal(JSON.stringify(poisoned).includes("evil.example"), false);
assertFeedShape(poisoned);

const markedSource = {
  ...products.find((product) => product.code === "PLAIN-01")!,
  id: "MARKUP",
  code: "MARKUP",
  name: "Court <b>trainer</b>\u0007",
  displayName: "Court <b>trainer</b>\u0007",
  item: "Court <b>trainer</b>\u0007",
  title: "Court <b>trainer</b>\u0007",
  description: "Soft <i>upper</i>\nline",
  line: "<script>nope</script>",
};
const marked = buildMobileStorefront([markedSource], version);
const markedCard = marked.products.find((card) => card.code === "MARKUP");
assert.ok(markedCard);
assert.equal(markedCard.name, "Court btrainer/b");
assert.equal(/[<>\u0000-\u001f\u007f]/.test(markedCard.name), false);
// MARKUP: the line is the exact sanitized label, with no angle brackets left.
assert.equal(markedCard.line, "Court BTrainer/B");
assert.equal(/[<>]/.test(markedCard.line ?? ""), false);
assert.equal(JSON.stringify(markedCard).includes("script"), false);
assert.equal(JSON.stringify(markedCard).includes("Supplier heading"), false);
assert.equal("title" in markedCard, false);
assert.equal("description" in markedCard, false);
const itemOnly = feedProductCard({
  ...products.find((product) => product.code === "PLAIN-01")!,
  id: "ITEM-ONLY",
  code: "ITEM-ONLY",
  name: "",
  displayName: "",
  item: "Supplier heading",
  title: "Supplier heading",
});
assert.ok(itemOnly);
assert.equal(itemOnly.name, "ITEM-ONLY");
assert.ok(itemOnly.line === null || typeof itemOnly.line === "string");
// ITEM-ONLY: the supplier heading never reaches the serialized product.
assert.equal(JSON.stringify(itemOnly).includes("Supplier heading"), false);
assert.deepEqual(Object.keys(itemOnly), [...FEED_PRODUCT_KEYS]);
// Price-bracket heading: the line is hidden (null) so clients show their own "More".
const priceBracket = feedProductCard({
  ...products.find((product) => product.code === "PLAIN-01")!,
  id: "PRICE-BRACKET",
  code: "PRICE-BRACKET",
  item: "12.5 Kids Tee [60]",
});
assert.ok(priceBracket);
assert.equal(priceBracket.line, null);
assert.equal(JSON.stringify(markedCard).includes("<"), false);
assert.equal(JSON.stringify(markedCard).includes("<script"), false);

const footwearMenu = byKey.get(feedMenuKey("shoes"));
assert.ok(footwearMenu);
assert.equal(footwearMenu.tiles.includes("flow"), false);
assert.deepEqual(footwearMenu.tiles, SHOE_TILES.map((tile) => tile.id));
assert.equal(byKey.has("flow"), false);
const shoesCategory = byKey.get("shoes");
assert.ok(shoesCategory);
assert.equal(shoesCategory.tiles.includes("flow"), false);
assert.equal(shoesCategory.tiles.includes("footwear-outlet"), true);
assert.deepEqual(shoesCategory.tiles, expectedHubTileIds("shoes", products));

const children = byKey.get(feedMenuKey("kids"));
assert.ok(children);
assert.deepEqual(children.tiles, [...KIDS_TILES.map((tile) => tile.id), KIDS_FOOTWEAR_TILE.id]);
assert.equal((byKey.get("kids-1-4")?.count ?? 0) > 0, true);
assert.equal(byKey.get("kids-6-10")?.count, 0);
const ageChildren = kidsAgeChildren();
assert.equal(ageChildren.length, 41);
for (const row of ageChildren) {
  assert.equal(byKey.get(row.key)?.parent, row.parent, row.key);
}

const woman = byKey.get(feedMenuKey("women"));
assert.ok(woman);
assert.equal(woman.tiles.some((key) => key.startsWith("w-")), true);
assert.equal([...byKey.values()].some((node) => node.kind === "folder" && node.key.startsWith("w-")), true);

const man = byKey.get(feedMenuKey("men"));
assert.ok(man);
for (const key of ["hiking-outdoor", "underwear-brama", "racket-sports", "resort", "beachwear"]) {
  assert.equal(man.tiles.includes(key), true, key);
}
const accessories = byKey.get("accessories");
assert.ok(accessories);
assert.equal(accessories.tiles.includes("acc-socks"), true);
assert.equal(accessories.tiles.length, 14);
const teams = byKey.get(feedMenuKey("teams"));
assert.ok(teams);
assert.deepEqual(teams.tiles, TEAM_TILES.map((tile) => tile.id));
assert.equal(teams.tiles.includes("football"), true);
assert.equal(PREFIX.test(teams.tiles.join(" ")), false);
const kits = byKey.get(feedMenuKey("kits"));
assert.ok(kits);
assert.deepEqual(kits.tiles, sponsorReplicaTiles().map((tile) => tile.id));
const sportswear = byKey.get("sportswear");
assert.ok(sportswear);
assert.deepEqual(sportswear.tiles, expectedHubTileIds("sportswear", products));
assert.equal(sportswear.tiles.includes("teamwear"), false);
assert.equal(sportswear.tiles.includes("jp-916ee19d09"), false);
const outlet = byKey.get("outlet");
assert.ok(outlet);
assert.deepEqual(outlet.tiles, PROMO_TILES.map((tile) => tile.id));
assert.equal(outlet.tiles.includes("outlet-promotions"), true);
assert.equal(byKey.has("outlet-price-199-299"), true);
assert.equal(byKey.get("netball")?.hidden, true);
assert.equal(byKey.has("general"), false);
assert.equal(byKey.has("sets"), false);
assert.deepEqual(
  feed.nodes.filter((node) => node.kind === "audience").map((node) => node.key),
  ["men", "women", "kids"],
);
for (const node of feed.nodes) {
  if (node.parent) assert.equal(byKey.has(node.parent), true, node.key);
  assert.equal(node.title.fr.length > 0, true, node.key);
  assert.equal(node.description.fr.length > 0, true, node.key);
  assert.equal(Number.isInteger(node.order), true, node.key);
  assert.equal(typeof node.hidden, "boolean", node.key);
  assert.equal("href" in node, false, node.key);
  assert.equal("label" in node, false, node.key);
  assert.equal("labelFr" in node, false, node.key);
}

const medium = cardByCode(feed, "CARD-MEDIUM");
assert.ok(medium.cardImage);
assert.equal(medium.cardImage, medium.images[0]);
assert.equal(medium.cardImage.includes("/images/medium/"), true);
assert.equal(medium.cardImage.includes("card-primary"), false);
assert.equal(feedImageUrl(medium.cardImage), medium.cardImage);

const relative = cardByCode(feed, "REL-PATH");
const relativeKept = `${CANONICAL_SITE_ORIGIN}/catalog-photos/rel-path.jpg`;
assert.equal(relative.cardImage, relativeKept);
assert.equal(relative.images[0], relative.cardImage);
assert.equal(relative.cardImage.startsWith("https://"), true);
assert.equal(feedImageUrl("/catalog-photos/rel-path.jpg"), relativeKept);
assert.equal(feedImageUrl(relativeKept), relativeKept);
const savedSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
process.env.NEXT_PUBLIC_SITE_URL = "https://evil.example";
try {
  assert.equal(feedImageUrl("/catalog-photos/rel-path.jpg"), relativeKept);
  assert.equal(feedImageUrl("https://evil.example/x.jpg"), null);
} finally {
  if (savedSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = savedSiteUrl;
}
const canonicalHost = new URL(CANONICAL_SITE_ORIGIN).host;
for (const hostile of [
  "//evil.example/x.jpg",
  "/../x",
  "/a\\b",
  "http://..",
  "https://host:8443/x",
  "/catalog-photos/a\u0001.jpg",
  "/foo/%2e%2e/x",
  `https://user:pass@${canonicalHost}/x.jpg`,
  `http://${canonicalHost}/x.jpg`,
  `https://${canonicalHost}:8443/x`,
  `https://${canonicalHost}.evil.example/x`,
  `https://evil.example/${canonicalHost}/x`,
]) {
  assert.equal(feedImageUrl(hostile), null, hostile);
}
const portOnListed = allowedImageHosts().find((rule) => rule.pathnamePrefix !== "/");
assert.ok(portOnListed);
assert.equal(
  feedImageUrl(`https://${portOnListed.host}:8443${portOnListed.pathnamePrefix}kept.jpg`),
  null,
);

const pack = cardByCode(feed, "PACK-25");
assert.equal(pack.name.includes("Pack of 25"), true);
assert.equal(pack.label, "Pack");
assert.equal(pack.labelFr, "Pack");
assert.equal(pack.packLabel, "Pack");
assert.equal(pack.pairCount, 25);
assert.equal(pack.isPack, true);
assert.equal(pack.price, 2218);
assert.equal(pack.priceLabel, formatPrice(2218));
assert.equal(pack.priceLabel.includes(","), true);

const assort = cardByCode(feed, "ASSORT-12");
assert.equal(assort.isPack, true);
assert.equal(assort.pairCount, 12);
assert.equal(assort.name.includes("12"), true);
assert.ok(assort.packLabel);
assert.equal(assort.labelFr, expectedLabelFr(products.find((product) => product.code === "ASSORT-12")!));
assert.notEqual(assort.labelFr, assort.label);
const multi = cardByCode(feed, "MULTI-6");
assert.equal(multi.labelFr, expectedLabelFr(products.find((product) => product.code === "MULTI-6")!));
assert.notEqual(multi.labelFr, multi.label);
const plain = cardByCode(feed, "PLAIN-01");
assert.equal(plain.label, null);
assert.equal(plain.labelFr, null);

const priced = cardByCode(feed, "PRICE-1083");
assert.equal(priced.price, 1083);
assert.equal(priced.priceLabel, formatPrice(1083));
assert.equal(priced.priceLabel.includes(","), true);

const stripped = cardByCode(feed, "STRIP-BRAND");
assert.equal(stripped.name.toLowerCase().includes("joma"), false);
assert.equal(stripped.name.includes("Club"), true);
assert.equal(stripped.name.includes("boot"), true);

const longName = cardByCode(feed, "LONG-NAME");
assert.equal(longName.name.length > 120, true);

const httpCard = cardByCode(feed, "HTTP-DROP");
assert.equal(httpCard.cardImage, null);
assert.deepEqual(httpCard.images, []);

const offHostUrl = "https://not-on-the-list.example/photo.jpg";
assert.equal(feedImageUrl(offHostUrl), null);
assert.equal(feedImageUrl("http://example.com/hidden.jpg"), null);
assert.equal(feedImageUrl("//example.com/hidden.jpg"), null);
const listed = allowedImageHosts().find((rule) => rule.pathnamePrefix !== "/");
assert.ok(listed);
const keptUrl = `https://${listed.host}${listed.pathnamePrefix}kept.jpg`;
const httpListed = `http://${listed.host}${listed.pathnamePrefix}kept.jpg`;
const wrongPath = `https://${listed.host}/outside-prefix/kept.jpg`;
assert.equal(feedImageUrl(keptUrl), keptUrl);
assert.equal(feedImageUrl(httpListed), null);
assert.equal(feedImageUrl(wrongPath), null);
const offHost = {
  ...products.find((product) => product.code === "PLAIN-01")!,
  id: "OFF-HOST",
  code: "OFF-HOST",
  name: "Off host photo",
  displayName: "Off host photo",
  item: "Off host photo",
  title: "Off host photo",
  imageUrl: offHostUrl,
  images: [offHostUrl],
  folders: [] as string[],
};
const offFeed = buildMobileStorefront([offHost], catalogVersion([offHost]));
assert.equal(cardByCode(offFeed, "OFF-HOST").cardImage, null);
assert.deepEqual(cardByCode(offFeed, "OFF-HOST").images, []);
assert.equal(JSON.stringify(offFeed).includes(offHostUrl), false);
assert.equal(JSON.stringify(offFeed).includes("not-on-the-list.example"), false);
assertNoHostList(offFeed);

const codes = new Set(feed.products.map((product) => product.code));
assert.equal(codes.has("HIDDEN-UNAVAIL"), false);
assert.equal(codes.has("DPO-TEST"), false);
assert.equal(feed.products.length, 18);

for (const key of ["kids-1-4", "w-cycling", "outlet-promotions", "teamwear"]) {
  const expected = filterListing(products as ListingItem[], { group: key }).length;
  const folder = byKey.get(publicFolderKey(key));
  assert.ok(folder, key);
  assert.equal(folder.kind, "folder");
  assert.equal(folder.count, expected, key);
}

const withFlow = [
  ...products,
  {
    ...products.find((product) => product.code === "PLAIN-01")!,
    id: "FLOW-1",
    code: "FLOW-1",
    name: "Court trainer",
    displayName: "Court trainer",
    item: "Court trainer",
    title: "Court trainer",
    folders: ["joma-flow"],
  },
];
const flowFeed = buildMobileStorefront(withFlow, catalogVersion(withFlow));
const flowNodes = indexNodes(flowFeed);
assert.equal(flowNodes.has("flow"), false);
assert.equal(flowNodes.has(publicFolderKey(FEED_EXCLUDED_FOLDER_KEY)), false);
assert.equal(JSON.stringify(flowFeed).includes("joma-flow"), false);
assert.equal(JSON.stringify(flowFeed).includes("\"-flow\""), false);
assert.equal(JSON.stringify(flowFeed).includes("joma-kids"), false);
assert.equal(flowNodes.get(feedMenuKey("shoes"))?.tiles.includes("flow"), false);
for (const value of copyValues(flowFeed)) {
  if (value.toLowerCase().includes("joma")) fail(`flow feed copy contains the brand word: ${value}`);
}

const baked = JSON.parse(read("data/products.json")) as Product[];
const relativeCodes: string[] = [];
const excludedCodes: string[] = [];
let relativeEqual = 0;
let relativeEmpty = 0;
for (const product of baked) {
  const urls = [product.imageUrl, ...(product.images ?? [])].filter(
    (url): url is string => typeof url === "string" && url.startsWith("/") && !url.startsWith("//"),
  );
  if (!urls.length) continue;
  if (product.available === false || product.code === "DPO-TEST") {
    assert.equal(feedProductCard(product), null, product.code);
    excludedCodes.push(product.code);
    continue;
  }
  const gallery = product.images?.[0];
  assert.equal(typeof gallery, "string", product.code);
  assert.equal(gallery!.startsWith("/"), true, product.code);
  assert.equal(gallery!.startsWith("//"), false, product.code);
  const card = feedProductCard(product);
  if (!card) fail(`${product.code} was dropped`);
  const resolved = feedImageUrl(gallery!);
  assert.equal(resolved, `${CANONICAL_SITE_ORIGIN}${gallery}`, product.code);
  assert.equal(card.cardImage, resolved, product.code);
  assert.equal(card.cardImage!.startsWith("https://"), true, product.code);
  assert.equal(card.cardImage, card.images[0] ?? null, product.code);
  for (const image of [card.cardImage, ...card.images]) {
    if (image) assertAllowedFeedImage(image, product.code);
  }
  if (!card.cardImage) relativeEmpty += 1;
  else if (card.images[0] === card.cardImage) relativeEqual += 1;
  relativeCodes.push(product.code);
}
relativeCodes.sort();
excludedCodes.sort();
assert.equal(relativeCodes.length, 75);
for (const code of ["100807.400", "100947.401", "101114.200", "900682.100", "900683.100"]) {
  assert.equal(relativeCodes.includes(code), true, code);
}
assert.equal(relativeEqual + relativeEmpty, relativeCodes.length);
assert.equal(relativeEmpty, 0);
assert.equal(relativeEqual, relativeCodes.length);
console.log(
  `relative card rows covered (${relativeCodes.length}); cardImage absolute https: ${relativeEqual}; images[0] equals cardImage: ${relativeEqual}; no image: ${relativeEmpty}`,
);
console.log(relativeCodes.join("\n"));
console.log(`unavailable relative rows excluded (${excludedCodes.length}): ${excludedCodes.join(", ")}`);

const versionRoute = read("app/api/mobile/v1/version/route.ts");
const storefrontRoute = read("app/api/mobile/v1/storefront/route.ts");
const httpLib = read("lib/mobile-feed-http.ts");
const dataLib = read("lib/mobile-feed-data.ts");
const fixtureRunner = read("scripts/dev-fixture.ts");
const paymentRoute = read("app/api/payments/dpo/create/route.ts");
assert.equal(versionRoute.includes("NextResponse.json({ version },"), true);
assert.equal(versionRoute.includes("s-maxage=60"), true);
assert.equal(versionRoute.includes("stale-while-revalidate=300"), true);
assert.equal(storefrontRoute.includes("status: 400"), true);
assert.equal(storefrontRoute.includes("Invalid version."), true);
assert.equal(storefrontRoute.includes("${"), false);
assert.equal(storefrontRoute.includes("Access-Control"), false);
assert.equal(storefrontRoute.includes("allowedHosts"), false);
assert.equal(storefrontRoute.includes("Content-Security-Policy"), false);
assert.equal(versionRoute.includes("Content-Security-Policy"), false);
assert.equal(httpLib.includes("Content-Security-Policy"), false);
assert.equal(storefrontRoute.includes("CATALOG_REVALIDATE_SECRET"), false);
assert.equal(storefrontRoute.includes("SUPABASE_SERVICE"), false);
assert.equal(storefrontRoute.includes("searchParams.getAll(\"v\")"), true);
assert.equal(httpLib.includes("consumeRateLimit"), true);
assert.equal(httpLib.includes("allowed = false"), true);
assert.equal(versionRoute.includes("methodNotAllowed"), true);
assert.equal(storefrontRoute.includes("methodNotAllowed"), true);
assert.equal(dataLib.includes("CATALOG_CACHE_TAG"), true);
assert.equal(dataLib.includes("unstable_cache"), true);
assert.equal(dataLib.includes("getCatalogLive"), true);
assert.equal(fixtureRunner.includes("127.0.0.1"), true);
assert.equal(fixtureRunner.includes("0.0.0.0"), false);
assert.equal(fixtureRunner.includes("NEXT_PUBLIC_"), false);
assert.equal(fixtureRunner.includes("process.exit(1)"), true);
assert.equal(paymentRoute.includes("resolveVatCountry"), true);
assert.equal(paymentRoute.includes("mobile-feed"), false);
assert.equal(paymentRoute.includes("checkoutCountries"), false);

const feedSources = [
  "lib/mobile-feed.ts",
  "lib/mobile-feed-countries.ts",
  "lib/mobile-feed-data.ts",
  "lib/mobile-feed-http.ts",
  "lib/mobile-feed-slugs.ts",
  "lib/mobile-feed-targets.ts",
  "lib/mobile-feed-version.ts",
  "app/api/mobile/v1/version/route.ts",
  "app/api/mobile/v1/storefront/route.ts",
  "scripts/check-feed.ts",
  "scripts/dev-fixture.ts",
  "scripts/feed-fixture.ts",
];
const feedBuilder = read("lib/mobile-feed.ts");
const feedTargets = read("lib/mobile-feed-targets.ts");
assert.equal(feedBuilder.includes("renderAssortmentLabel"), true);
assert.equal(feedBuilder.includes('makeT("eu")'), true);
assert.equal(feedBuilder.includes("allowedImageHosts()"), true);
assert.equal(feedBuilder.includes("imageHostAllows("), true);
assert.equal(feedBuilder.includes("CANONICAL_SITE_ORIGIN"), true);
assert.equal(feedBuilder.includes("productLineLabel(product.item)"), true);
assert.equal(feedBuilder.includes("product.displayName || product.name || product.code"), true);
assert.equal(feedBuilder.includes("product.item ||"), false);
assert.equal(feedBuilder.includes("memoizedMobileStorefront"), true);
const resultFn = feedBuilder.slice(feedBuilder.indexOf("export async function storefrontResult"));
assert.ok(resultFn.indexOf("=== \"invalid\"") >= 0);
assert.ok(resultFn.indexOf("=== \"invalid\"") < resultFn.indexOf("await read()"));
assert.equal(storefrontRoute.includes("storefrontResult"), true);
assert.equal(feedBuilder.includes("isAllowedProductImageUrl("), false);
assert.equal(feedBuilder.includes("metaSiteUrl"), false);
assert.equal(feedBuilder.includes("metaAbsoluteUrl"), false);
assert.equal(feedBuilder.includes("process.env"), false);
assert.equal(feedBuilder.includes("NEXT_PUBLIC_"), false);
assert.equal(feedBuilder.includes("ALLOWED_IMAGE_HOSTS"), false);
assert.equal(feedBuilder.includes("Content-Security-Policy"), false);
assert.match(
  feedBuilder,
  /The server stays the only source of real prices, shipping, and VAT at order time/,
);
assert.match(feedBuilder, /No checkout or payment route reads this block/);
assert.equal(/\bMobileFeed\b/.test(feedBuilder), false);
assert.equal(/\bMobileFeed\b/.test(read("lib/mobile-feed-data.ts")), false);
assert.equal(/\bbuildMobileFeed\b/.test(feedBuilder), false);
assert.equal(/\breadMobileFeed\b/.test(read("app/api/mobile/v1/storefront/route.ts")), false);
assert.equal(read("lib/mobile-storefront.ts").includes("MobileStorefront"), false);
assert.equal(read("app/checkout/page.tsx").includes("mobile-feed"), false);
assert.equal(read("app/checkout/page.tsx").includes("readMobileStorefront"), false);
assert.equal(paymentRoute.includes("readMobileStorefront"), false);
assert.equal(storefrontRoute.includes("readMobileStorefront()"), true);
assert.equal(feedBuilder.includes("category:${"), false);
assert.equal(feedBuilder.includes("menu:${"), false);
assert.equal(feedTargets.includes("category:${"), false);
assert.equal(feedTargets.includes("`team:"), false);
for (const relativePath of feedSources) {
  const source = read(relativePath);
  for (const rule of allowedImageHosts()) {
    if (source.includes(rule.host)) fail(`${relativePath} copies host ${rule.host}`);
  }
  if (relativePath === "scripts/check-feed.ts") continue;
  for (const literal of ["Assortiment", "paires", "pièces", "Pack de"]) {
    if (source.includes(literal)) fail(`${relativePath} hardcodes French text`);
  }
}

for (const path of [...walkFiles(join(root, "app")), ...walkFiles(join(root, "lib"))]) {
  const source = readFileSync(path, "utf8");
  if (source.includes("scripts/dev-fixture") || source.includes("scripts/fixtures") || source.includes("feed-fixture")) {
    fail(`${path} imports the dev fixture`);
  }
}

for (const extra of [
  { VERCEL: "1" },
  { VERCEL_ENV: "preview" },
  { NODE_ENV: "production" },
]) {
  const result = spawnSync("npx", ["tsx", "scripts/dev-fixture.ts"], {
    cwd: root,
    env: { ...process.env, CI: "1", ...extra } as NodeJS.ProcessEnv,
    encoding: "utf8",
    timeout: 30000,
  });
  assert.notEqual(result.status, 0, JSON.stringify(extra));
  assert.match(`${result.stderr}`, /refuses to start/);
}

const folderMap = JSON.parse(read("data/product-folders.json")) as Record<string, string[]>;
const bakedWithFolders = baked.map((product) => ({
  ...product,
  folders: folderMap[product.id] ?? folderMap[product.code] ?? [],
}));
const bakedFeed = buildMobileStorefront(siteCatalog, catalogVersion(siteCatalog));
assert.equal(bakedFeed.version, mobileFeedVersion(catalogVersion(siteCatalog)));
assert.equal(bakedFeed.version.endsWith(".8"), true);
assertFeedShape(bakedFeed);
let imageEqual = 0;
let imageDiffer = 0;
let imageEmpty = 0;
for (const card of bakedFeed.products) {
  for (const image of [card.cardImage, ...card.images]) {
    if (image) assertAllowedFeedImage(image, card.code);
  }
  if (!card.cardImage && card.images.length === 0) imageEmpty += 1;
  else if (card.cardImage === card.images[0]) imageEqual += 1;
  else imageDiffer += 1;
}
let nodeImages = 0;
for (const node of bakedFeed.nodes) {
  if (node.image) {
    nodeImages += 1;
    assertAllowedFeedImage(node.image, node.key);
  }
}
console.log(`node images kept ${nodeImages}`);
const bakedByCode = new Map(siteCatalog.map((product) => [product.code, product]));
let lineNull = 0;
let labelFrTranslated = 0;
for (const card of bakedFeed.products) {
  const source = bakedByCode.get(card.code);
  assert.ok(source, card.code);
  assert.equal(card.labelFr, expectedLabelFr(source), card.code);
  if (card.label === null) assert.equal(card.labelFr, null, card.code);
  if (card.label && card.labelFr && card.labelFr !== card.label) labelFrTranslated += 1;
  if (card.labelFr) assert.equal(/[<>\u0000-\u001f\u007f]/.test(card.labelFr), false, card.code);
  if (card.line === null) lineNull += 1;
  else assert.equal(/[<>\u0000-\u001f\u007f]/.test(card.line), false, card.code);
}
assert.ok(labelFrTranslated > 0);
console.log(`labelFr differs from label on ${labelFrTranslated} cards`);
// line is null exactly on the 59 hidden-heading codes (price-bracket or empty headings).
const HIDDEN_HEADING_CODES = [
  "101291.452",
  "101291.601",
  "101291.602",
  "101291.609",
  "101291.701",
  "101291.702",
  "101291.715",
  "101291.901",
  "101465.102",
  "101465.109",
  "101465.452",
  "101465.602",
  "101465.702",
  "102219.336",
  "102263.336",
  "102521.102",
  "102521.451",
  "102521.452",
  "102521.601",
  "102521.602",
  "102521.701",
  "102521.702",
  "102521.901",
  "103235.109",
  "103734.102",
  "103734.203",
  "103734.332",
  "103734.381",
  "103734.451",
  "103734.601",
  "103734.703",
  "103734.881",
  "103734.901",
  "103908.991",
  "103971.102",
  "103971.201",
  "103971.452",
  "103971.602",
  "103971.901",
  "104361.031",
  "104361.110",
  "104361.201",
  "104361.601",
  "104361.702",
  "104361.881",
  "104361.901",
  "104488.102",
  "104488.201",
  "104488.474",
  "104488.599",
  "104488.602",
  "104488.702",
  "401521.649",
  "600115.426",
  "900935.027",
  "901267.601",
  "901825.476",
  "901923.104",
  "902340.100"
];
assert.deepEqual(
  bakedFeed.products.filter((card) => card.line === null).map((card) => card.code).sort(),
  HIDDEN_HEADING_CODES,
);
assert.equal(lineNull, HIDDEN_HEADING_CODES.length);
console.log(`product line null ${lineNull} of ${bakedFeed.products.length}`);
assert.equal(imageDiffer, 0);
console.log(
  `cardImage equals images[0]: ${imageEqual}; differs: ${imageDiffer}; no image: ${imageEmpty}`,
);
const bakedNodes = indexNodes(bakedFeed);
for (const key of [
  "hiking-outdoor",
  "underwear-brama",
  "racket-sports",
  "resort",
  "beachwear",
  "acc-balls",
  "acc-palas-padel",
  "padel-shoes",
]) {
  assert.equal(bakedNodes.has(key), true, key);
}
for (const node of bakedFeed.nodes) {
  if (node.parent) assert.equal(bakedNodes.has(node.parent), true, node.key);
}
assert.equal(bakedNodes.get("resort")?.kind, "folder");
// App home = web home (app/page.tsx, components/home-hero.tsx): order, labels, links, pictures.
const bakedPhoto = (code: string, file: string) => {
  const url = baked.find((row) => row.code === code)?.images?.find((image) => image.endsWith(`/${file}`));
  assert.ok(url, `${code} ${file}`);
  return url;
};
const WEB_HOME = [
  ["home-teamwear", "Teamwear", "/teamwear", `${CANONICAL_SITE_ORIGIN}/brand/hub-teampro-2026.webp`],
  ["home-sportswear", "Sportswear", "/category/sportswear", `${CANONICAL_SITE_ORIGIN}/brand/hub-sportswear.png?v=5`],
  ["home-running", "Running", "/category/running-fitness", bakedPhoto("104129.100", "104129.100_1.jpg")],
  ["home-lifestyle", "Lifestyle", "/category/lifestyle", bakedPhoto("100818.200", "100818.200_1.jpg")],
  ["home-footwear", "Footwear", "/category/shoes", `${CANONICAL_SITE_ORIGIN}/brand/hub-shoes.png`],
  ["home-kids", "Kids", "/shop/kids", bakedPhoto("500828.345", "500828.345_2.jpg")],
];
const bakedHome = bakedNodes.get(feedMenuKey("home"));
assert.ok(bakedHome);
assert.deepEqual(bakedHome.tiles, WEB_HOME.map(([key]) => key));
const homeImages: string[] = [];
for (const [key, label, target, image] of WEB_HOME as [string, string, string, string][]) {
  const node = bakedNodes.get(key);
  assert.ok(node, key);
  assert.equal(node.title.en, label, key);
  assert.equal(node.target, target, key);
  assert.equal(node.image, image, key);
  assert.ok(node.image, key);
  assertAllowedFeedImage(node.image, key);
  assert.equal(feedImageUrl(node.image), node.image, key);
  homeImages.push(node.image);
}
assert.equal(new Set(homeImages).size, 6, "home tile images repeat");
console.log(`home tiles match web home: ${WEB_HOME.map(([, label]) => label).join(", ")}`);
for (const slug of ["football", "basketball", "swimming", "rugby", "cricket"]) {
  const tile = jomaTeamsLandingTiles().find((row) => row.href.split("?")[0] === `/shop/${slug}`);
  assert.ok(tile, slug);
  const expected = feedImageUrl(jomaLandingTileImage("teams", tile.label));
  assert.ok(expected, slug);
  assert.equal(bakedNodes.get(slug)?.kind, "category", slug);
  assert.equal(bakedNodes.get(slug)?.image, expected, slug);
}
for (const key of ["resort", "w-resort", "acc-backpacks", "acc-tiendas"]) {
  const image = bakedNodes.get(key)?.image;
  assert.ok(image, key);
  assertAllowedFeedImage(image, key);
}
for (const key of ["official-kits", "brama", "padel", "hiking"]) {
  assert.equal(bakedNodes.get(key)?.image ?? null, null, key);
}
for (const key of [
  "k14-outerwear-chubasqueros",
  "k14-outerwear-anoracks-jackets",
  "jp-86ae5088b9",
  "k14-pants-pants-largos",
]) {
  const image = bakedNodes.get(key)?.image ?? null;
  assert.ok(image, key);
  assertAllowedFeedImage(image, key);
  console.log(`checked kids folder ${key} image ${image}`);
}
const nullNodes = bakedFeed.nodes.filter((node) => !node.image).map((node) => node.key);
console.log(`null images ${nullNodes.length}: ${nullNodes.join(", ")}`);
for (const card of bakedFeed.products) {
  assert.deepEqual(Object.keys(card), [...FEED_PRODUCT_KEYS], card.code);
  for (const banned of ["item", "sheetCategory", "hay", "folders"]) {
    assert.equal(Object.hasOwn(card, banned), false, card.code);
  }
}
const groups: Array<{
  name: string;
  entry: string;
  match: (product: Product) => boolean;
}> = [
  { name: "sportswear", entry: "sportswear", match: (product) => productInHub(product, "sportswear") },
  { name: "balls-bags", entry: "balls-bags", match: (product) => productInHub(product, "balls-bags") },
  { name: "running-fitness", entry: "running-fitness", match: (product) => productInHub(product, "running-fitness") },
  {
    name: "hiking jackets",
    entry: "hiking",
    match: (product) => productInHub(product, "hiking") && product.subcategory === "jackets",
  },
  { name: "padel", entry: "padel", match: (product) => productInHub(product, "padel") },
  { name: "resort", entry: "resort", match: (product) => productInHub(product, "resort") },
  {
    name: "shin guard",
    entry: "football",
    match: (product) => product.subcategory === "shin-guards",
  },
];
for (const group of groups) {
  const rows = bakedWithFolders.filter(
    (product) => product.available !== false && product.code !== "DPO-TEST" && group.match(product),
  );
  let covered = 0;
  let emptyFolders = 0;
  for (const product of rows) {
    const hits = reachIds(product, bakedNodes);
    assert.equal(hits.has(group.entry), true, `${product.code} ${group.name}`);
    if ((product.folders ?? []).length === 0) emptyFolders += 1;
    if (group.name === "hiking jackets") assert.equal(product.subcategory, "jackets");
    if (group.name === "shin guard") assert.equal(product.subcategory, "shin-guards");
    covered += 1;
  }
  assert.equal(covered, rows.length, group.name);
  console.log(`${group.name}: ${rows.length} products, entry ${group.entry}, empty folders ${emptyFolders}`);
}

const liveFootwear = FOOTWEAR_FOLDERS.filter((folder) => folder.key !== "footwear-outlet" && isLiveFolder(folder.key));
const typeCountExpected: Record<string, number> = {
  football: 7,
  basketball: 5,
  rugby: 4,
  cricket: 3,
  swimming: 2,
  sportswear: 9,
};
for (const [slug, count] of Object.entries(typeCountExpected)) {
  const groups = subcategoryHubGroups(slug, siteCatalog);
  assert.equal(groups.length, count, slug);
  assert.deepEqual(bakedNodes.get(slug)?.tiles, expectedHubTileIds(slug, siteCatalog), slug);
}
const seriesCountExpected: Record<string, number> = {
  football: 6,
  basketball: 12,
  rugby: 10,
  cricket: 0,
  swimming: 0,
};
for (const [slug, count] of Object.entries(seriesCountExpected)) {
  const types = subcategoryHubGroups(slug, siteCatalog);
  const series = sportSeriesFolders(slug, siteCatalog).filter(
    (tile) => !types.some((folder) => folder.key === tile.key),
  );
  assert.equal(series.length, count, `${slug} series`);
}
const audienceExpected: Record<string, Record<string, number>> = {
  football: { men: 652, women: 2, kids: 133 },
  swimming: { men: 18, women: 1 },
  sportswear: { men: 6049, women: 108, kids: 164 },
  shoes: { men: 893, women: 353, kids: 486 },
  basketball: { men: 78 },
  rugby: { men: 92 },
  cricket: { men: 9 },
};
for (const [slug, expected] of Object.entries(audienceExpected)) {
  const tiles = audienceTiles(siteCatalog, { categorySlug: slug });
  const got = Object.fromEntries(tiles.map((tile) => [tile.key, tile.count]));
  assert.deepEqual(got, expected, slug);
  const node = bakedNodes.get(slug);
  assert.ok(node, slug);
  if (tiles.length <= 1) {
    assert.deepEqual(node.audiences, [], slug);
  } else {
    assert.equal(node.audiences.length, tiles.length, slug);
    tiles.forEach((tile, index) => {
      const row = node.audiences[index];
      assert.equal(row.id, `${slug}--${tile.key}`, slug);
      assert.equal(row.count, tile.count, row.id);
      assert.equal(row.target, tile.href, row.id);
      assert.equal(row.target, namespacedFeedTargets().get(row.id), row.id);
      assert.equal(row.label.en, audienceName(tile.key, makeT("na")), row.id);
      assert.equal(Number.isInteger(row.count), true, row.id);
    });
  }
}
assert.deepEqual(bakedNodes.get("shoes")?.tiles, expectedHubTileIds("shoes", siteCatalog));
assert.equal(bakedNodes.get("shoes")?.tiles.includes("footwear-outlet"), true);
assert.equal(bakedNodes.get("shoes")?.tiles.includes("flow"), false);
assert.equal(bakedNodes.get(feedMenuKey("shoes"))?.tiles.includes("flow"), false);
assert.deepEqual(bakedNodes.get(feedMenuKey("shoes"))?.tiles, SHOE_TILES.map((tile) => tile.id));
const footballShirts = subcategoryHubGroups("football", siteCatalog).find((tile) => tile.key === "shirts");
assert.equal(footballShirts?.name, "T-Shirts");
assert.equal(bakedNodes.get("football--shirts")?.title.en, subName("shirts", makeT("na")));
assert.equal(bakedNodes.get("football--shirts")?.title.en, "Shirts");
assert.equal(bakedNodes.get("sportswear--bras")?.title.en, "Sports Bras");
const teamSource = siteCatalog.find((product) => /team\/14/i.test(`${product.code} ${product.name} ${product.displayName}`));
assert.ok(teamSource);
assert.equal(teamSource.category, "balls-bags");
const teamCard = bakedFeed.products.find((card) => card.code === teamSource.code) ?? feedProductCard(teamSource);
assert.ok(teamCard);
assert.equal(teamCard.category, "balls-bags");
assert.equal(teamCard.subcategory, teamSource.subcategory);
let categoryDiffs = 0;
for (const card of bakedFeed.products) {
  const source = bakedByCode.get(card.code);
  assert.ok(source, card.code);
  if (card.category !== source.category) categoryDiffs += 1;
  if (card.subcategory !== source.subcategory) categoryDiffs += 1;
  assert.deepEqual(Object.keys(card), [...FEED_PRODUCT_KEYS], card.code);
}
assert.equal(categoryDiffs, 0);
const groupDiffs: string[] = [];
for (const row of jomaFolderMetaSnapshot()) {
  if (!row.sub) continue;
  const before = legacyGroupSlug(row.sub);
  const after = publicFolderKey(row.sub);
  if (before !== after) groupDiffs.push(`${row.key} ${before} -> ${after}`);
}
assert.deepEqual(groupDiffs, [`${FEED_EXCLUDED_FOLDER_KEY} -flow -> flow`]);
for (const node of bakedFeed.nodes) {
  if (node.group !== null) assert.match(node.group, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, node.key);
  assert.notEqual(node.group, "-flow", node.key);
  assert.notEqual(node.key, "flow", node.key);
}
assert.equal(bakedNodes.get("home-teamwear")?.span, 2);
assert.equal(bakedNodes.get("home-teamwear")?.tone, "dark");
assert.equal(bakedNodes.get("home-sportswear")?.span, 1);
assert.equal(bakedNodes.get("home-sportswear")?.tone, "dark");
assert.equal(bakedNodes.get("home-running")?.span, 1);
assert.equal(bakedNodes.get("home-running")?.tone, "dark");
assert.equal(bakedNodes.get("home-lifestyle")?.span, 1);
assert.equal(bakedNodes.get("home-lifestyle")?.tone, "dark");
assert.equal(bakedNodes.get("home-footwear")?.span, 1);
assert.equal(bakedNodes.get("home-footwear")?.tone, "dark");
assert.equal(bakedNodes.get("home-kids")?.span, 2);
assert.equal(bakedNodes.get("home-kids")?.tone, "light");
for (const tile of HOME_TILES) {
  assert.equal(tile.span === 1 || tile.span === 2, true, tile.id);
  assert.equal(tile.tone === "dark" || tile.tone === "light", true, tile.id);
}
const audienceNode = bakedNodes.get("men");
assert.equal(audienceNode?.kind, "audience");
assert.equal(audienceNode?.slug, "men");
assert.equal(bakedNodes.get("women")?.slug, "women");
assert.equal(bakedNodes.get("kids")?.slug, "kids");
const removedSportswearTiles = [
  "teamwear",
  "teamwear-pro-2026",
  "running-trail",
  "cycling",
  "racket-sports",
  "hiking-outdoor",
  "jp-916ee19d09",
  "aguila-line",
  "lifestyle-apparel",
  "resort",
  "beachwear",
  "underwear-brama",
  "athletes-combat",
  "elite-club",
];
for (const id of removedSportswearTiles) {
  assert.equal(bakedNodes.get("sportswear")?.tiles.includes(id), false, id);
}
const countLines = [
  `man site ${man.tiles.length} feed ${bakedNodes.get(feedMenuKey("men"))?.tiles.length}`,
  `woman site ${woman.tiles.length} feed ${bakedNodes.get(feedMenuKey("women"))?.tiles.length}`,
  `children site ${children.tiles.length} feed ${bakedNodes.get(feedMenuKey("kids"))?.tiles.length}`,
  `footwear menu site ${SHOE_TILES.length} feed ${bakedNodes.get(feedMenuKey("shoes"))?.tiles.length}`,
  `teams site ${TEAM_TILES.length} feed ${bakedNodes.get(feedMenuKey("teams"))?.tiles.length}`,
  `kits site ${sponsorReplicaTiles().length} feed ${bakedNodes.get(feedMenuKey("kits"))?.tiles.length}`,
  `accessories site 14 feed ${bakedNodes.get("accessories")?.tiles.length}`,
  `outlet site ${PROMO_TILES.length} feed ${bakedNodes.get("outlet")?.tiles.length}`,
  `sportswear shop ${expectedHubTileIds("sportswear", siteCatalog).length} feed ${bakedNodes.get("sportswear")?.tiles.length}`,
  `footwear shop landing ${expectedHubTileIds("shoes", siteCatalog).length} live structural ${liveFootwear.length} feed ${bakedNodes.get("shoes")?.tiles.length}`,
  `kids age children ${ageChildren.length}`,
  "product line is plain text or null",
  "Kosovo code XK is user-assigned, not an official ISO 3166-1 alpha-2",
];
console.log(countLines.join("\n"));
const tree = treeLines(bakedFeed);
writeFileSync("/tmp/mobile-feed-tree.txt", tree);
writeFileSync("/tmp/mobile-feed-counts.txt", countLines.join("\n"));
console.log(`tree lines ${tree.split("\n").length} chars ${tree.length}`);

const tileReport: string[] = [];
for (const category of CATEGORIES) {
  const node = bakedNodes.get(category.slug);
  if (!node) continue;
  tileReport.push(`# ${category.slug} tiles ${node.tiles.length} audiences ${node.audiences.length}`);
  for (const id of node.tiles) {
    const child = bakedNodes.get(id);
    tileReport.push(
      `${id}\t${child?.title.en ?? ""}\t${child?.count ?? ""}\t${child?.target ?? ""}\t${child?.image ? "img" : "null"}`,
    );
  }
  for (const row of node.audiences) {
    tileReport.push(`${row.id}\t${row.label.en}\t${row.count}\t${row.target}\taudience`);
  }
}
const retargeted: string[] = [];
for (const [key, href] of feedTargetTable()) {
  if (href.startsWith("/shop/football?group=")) retargeted.push(`${key} ${href}`);
}
tileReport.push(`# football folder targets ${retargeted.length}`);
tileReport.push(...retargeted);
writeFileSync("/tmp/feed-tiles.txt", tileReport.join("\n"));
assertSubLinkTargets(byKey, bakedNodes);
// toClientProduct must keep both the public `line` and the stored category/subcategory.
{
  const base = products.find((product) => product.code === "PLAIN-01")!;
  const stored = {
    ...base,
    id: "CLIENT-FIELDS",
    code: "CLIENT-FIELDS",
    category: "stored-category",
    subcategory: "stored-subcategory",
    item: "Combi Shirt Black [60]",
  } as Product;
  const client = toClientProduct(stored) as Product & { line?: unknown };
  assert.equal(client.line, productLineLabel(stored.item), "toClientProduct lost line");
  assert.ok(typeof client.line === "string" && client.line.length > 0, "toClientProduct line is empty");
  assert.equal(client.category, "stored-category", "toClientProduct lost stored category");
  assert.equal(client.subcategory, "stored-subcategory", "toClientProduct lost stored subcategory");
  assert.equal("item" in client, false);
  console.log("toClientProduct keeps line and stored category/subcategory");
}
console.log(`feed check ok (fixture products ${feed.products.length}, version ${feed.version})`);

function assertSubLinkTargets(...nodeMaps: Array<Map<string, FeedNode>>) {
  const generated = storefrontSubLinks();
  const rendered = renderStorefrontSubLinks(generated);
  assert.equal(read("data/storefront-sub-links.json"), rendered);
  const targetsSource = read("lib/mobile-feed-targets.ts");
  const literalStart = targetsSource.indexOf("export const SUB_LINK_TARGETS");
  const literalEnd = targetsSource.indexOf("export function namespacedFeedTargets");
  assert.equal(literalStart >= 0 && literalEnd > literalStart, true);
  const literalBlock = targetsSource.slice(literalStart, literalEnd);
  assert.equal(literalBlock.includes("storefront-sub-links"), false);
  assert.equal(literalBlock.includes("storefront-nav"), false);
  assert.equal(literalBlock.includes("searchParams"), false);
  assert.equal(literalBlock.includes("taxonomy"), false);
  assert.equal(literalBlock.includes("${"), false);
  assert.equal(targetsSource.includes("storefrontSubLinks"), false);
  assert.equal(targetsSource.includes("storefront-sub-links"), false);
  assert.equal(targetsSource.includes("storefront-nav"), false);
  const registerStart = targetsSource.indexOf(
    "for (const [id, href] of Object.entries(SUB_LINK_TARGETS))",
  );
  const registerEnd = targetsSource.indexOf("namespacedTargets = map;", registerStart);
  const registerBlock = targetsSource.slice(registerStart, registerEnd);
  assert.equal(registerStart >= 0 && registerEnd > registerStart, true);
  assert.equal(registerBlock.includes("searchParams"), false);
  assert.equal(registerBlock.includes("storefront"), false);
  assert.equal(registerBlock.includes("taxonomy"), false);
  assert.equal(read("lib/mobile-feed.ts").includes("storefront-sub-links"), false);
  assert.equal(read("lib/mobile-feed.ts").includes("subLinks"), false);
  const ids = new Set<string>();
  for (const row of generated) {
    const id = subLinkTargetId(row.hub, row.sub);
    assert.equal(ids.has(id), false, id);
    ids.add(id);
    assert.match(id, NAMESPACED_FEED_KEY, id);
    assert.equal(SUB_LINK_TARGETS[id], row.href, id);
    assert.equal(literalBlock.includes(`${JSON.stringify(id)}: ${JSON.stringify(row.href)}`), true, id);
    assert.equal(feedTargetFor(id), row.href, id);
    assert.equal(namespacedFeedTargets().get(id), row.href, id);
    assert.equal(feedTargetTable().has(id), false, id);
    for (const nodes of nodeMaps) assert.equal(nodes.has(id), false, id);
  }
  assert.equal(Object.keys(SUB_LINK_TARGETS).length, generated.length);
  assert.equal(ids.size, generated.length);
  const hubCounts = new Map<string, number>();
  for (const row of generated) hubCounts.set(row.hub, (hubCounts.get(row.hub) ?? 0) + 1);
  console.log(`sub link targets ${generated.length} hubs ${hubCounts.size}`);
}

function assertAllowedFeedImage(url: string, label: string) {
  assert.equal(url.startsWith("https://"), true, label);
  assert.equal(/^https:\/\/[^/?#\s:]+:\d+/i.test(url), false, label);
  assert.equal(url.includes("\\"), false, label);
  assert.equal(/[\u0000-\u001f\u007f]/.test(url), false, label);
  const parsed = new URL(url);
  assert.equal(parsed.protocol, "https:", label);
  assert.equal(parsed.port, "", label);
  const onCanonical = parsed.origin === new URL(CANONICAL_SITE_ORIGIN).origin;
  const listed = allowedImageHosts().some((rule) =>
    imageHostAllows(parsed.hostname, parsed.pathname, rule),
  );
  assert.equal(onCanonical || listed, true, `${label} ${parsed.hostname}`);
  if (!onCanonical) assert.equal(listed, true, `${label} ${parsed.hostname}`);
  assert.equal(parsed.username, "", label);
  assert.equal(parsed.password, "", label);
  assert.equal(parsed.pathname.startsWith("/"), true, label);
  assert.equal(parsed.pathname.startsWith("//"), false, label);
  assert.equal(feedImageUrl(url), url, label);
}

function indexNodes(feedValue: MobileStorefront) {
  return new Map(feedValue.nodes.map((node) => [node.key, node]));
}

function assertFeedShape(feedValue: MobileStorefront) {
  const keys = feedTargetKeys();
  const paths = feedTargetSet();
  const allowed = feedAllowedTargets();
  const parsed = JSON.parse(JSON.stringify(feedValue)) as MobileStorefront;
  assert.equal(parsed.version, feedValue.version);
  assert.equal(Array.isArray(parsed.nodes), true);
  assert.equal(Array.isArray(parsed.menus), true);
  assert.equal(Array.isArray(parsed.categoryOrder), true);
  assert.deepEqual(Object.keys(parsed.checkout), ["countries", "eurPerNad", "shipping"]);
  assert.equal(Array.isArray(parsed.checkout.countries), true);
  assert.deepEqual(parsed.checkout.countries, checkoutCountries());
  assert.equal("vatRate" in parsed.checkout, false);
  assert.equal("vatCountries" in parsed.checkout, false);
  assert.equal("vatRates" in parsed.checkout, false);
  assert.equal(typeof parsed.checkout.eurPerNad, "number");
  assert.equal(Number.isFinite(parsed.checkout.eurPerNad), true);
  walk(feedValue, (key, value, path) => {
    if (BANNED_KEYS.has(key)) fail(`${path}.${key} is not a feed field`);
    if (HOST_LIST_KEYS.has(key)) fail(`${path}.${key} is a host list`);
    if (typeof value === "number") {
      if (!Number.isFinite(value)) fail(`${path} is not a finite number`);
    }
    if (typeof value === "string") {
      if (value.startsWith("//") || /^http:\/\//i.test(value)) {
        fail(`${path} is not an allowed URL`);
      }
      if (value.startsWith("/")) {
        if (key !== "target") fail(`${path} starts with a path`);
        if (!allowed.has(value)) fail(`${path} is not in the fixed target list`);
      }
    }
  });
  const used = new Set<string>();
  const nodeKeys = new Set(feedValue.nodes.map((node) => node.key));
  for (const node of feedValue.nodes) {
    const namespaced = NAMESPACED_FEED_KEY.test(node.key);
    if (namespaced) assert.equal(keys.has(node.key), false, node.key);
    else assert.equal(keys.has(node.key), true, node.key);
    assert.equal("href" in node, false, node.key);
    assert.equal("line" in node, false, node.key);
    assert.equal("label" in node, false, node.key);
    assert.equal("labelFr" in node, false, node.key);
    assert.equal(node.target, feedTargetFor(node.key), node.key);
    assert.equal(allowed.has(node.target), true, node.target);
    assert.equal(/^\/[^\s\\]*$/.test(node.target), true, node.key);
    used.add(node.target);
    assert.equal(node.span === null || node.span === 1 || node.span === 2, true, node.key);
    assert.equal(node.tone === null || node.tone === "dark" || node.tone === "light", true, node.key);
    if (node.kind === "audience") {
      assert.equal(AUDIENCES.some((audience) => audience.slug === node.slug), true, node.key);
    } else {
      assert.equal(node.slug, null, node.key);
    }
    assert.equal(Array.isArray(node.audiences), true, node.key);
    for (const row of node.audiences) {
      assert.match(row.id, NAMESPACED_FEED_KEY, row.id);
      assert.equal(namespacedFeedTargets().get(row.id), row.target, row.id);
      assert.equal(Number.isInteger(row.count) && row.count > 0, true, row.id);
      assert.equal(row.label.en.length > 0 && row.label.fr.length > 0, true, row.id);
      assert.equal(/[<>\u0000-\u001f\u007f]/.test(row.label.en + row.label.fr), false, row.id);
    }
    assert.equal(Number.isInteger(node.order), true, node.key);
    assert.equal(typeof node.hidden, "boolean", node.key);
    assert.equal(node.title.fr.length > 0, true, node.key);
    assert.equal(node.description.fr.length > 0, true, node.key);
    for (const text of [node.title.en, node.title.fr, node.description.en, node.description.fr]) {
      assert.equal(/[<>\u0000-\u001f\u007f]/.test(text), false, node.key);
    }
    assert.equal(PREFIX.test(node.key), false, node.key);
    if (node.group !== null) assert.match(node.group, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, node.key);
    if (node.parent) {
      assert.equal(nodeKeys.has(node.parent), true, node.parent);
      assert.equal(PREFIX.test(node.parent), false, node.parent);
    }
    for (const tile of node.tiles) {
      assert.equal(nodeKeys.has(tile), true, tile);
      assert.equal(feedTargetFor(tile) !== null, true, tile);
      assert.equal(PREFIX.test(tile), false, tile);
    }
  }
  for (const path of paths) assert.equal(used.has(path), true, path);
  for (const key of [...feedValue.menus, ...feedValue.categoryOrder]) {
    assert.equal(keys.has(key), true, key);
    assert.equal(PREFIX.test(key), false, key);
  }
}

function reachIds(product: Product & { folders?: string[] }, nodes: Map<string, FeedNode>) {
  const hits = new Set<string>();
  for (const key of product.folders ?? []) {
    const pub = publicFolderKey(key);
    if (nodes.has(pub)) hits.add(pub);
  }
  for (const category of CATEGORIES) {
    if (nodes.has(category.slug) && productInHub(product, category.slug)) hits.add(category.slug);
  }
  return hits;
}

function feedBodyHas(feedValue: MobileStorefront, needle: string) {
  return JSON.stringify(feedValue).includes(needle);
}

function assertNoHostList(value: unknown, path = "feed"): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoHostList(item, `${path}[${index}]`));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (HOST_LIST_KEYS.has(key)) fail(`${path}.${key} is a host list`);
    assertNoHostList(child, `${path}.${key}`);
  }
}

function walk(
  value: unknown,
  visit: (key: string, child: unknown, path: string) => void,
  path = "feed",
) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      if (typeof item === "string") visit(String(index), item, `${path}[${index}]`);
      else walk(item, visit, `${path}[${index}]`);
    });
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    visit(key, child, path);
    if (child && typeof child === "object") walk(child, visit, `${path}.${key}`);
  }
}

function everyImage(feedValue: MobileStorefront): Array<string | null> {
  return [
    ...feedValue.nodes.flatMap((node) => [node.image]),
    ...feedValue.products.flatMap((product) => [product.cardImage, ...product.images]),
  ];
}

function cardByCode(feedValue: MobileStorefront, code: string): FeedProduct {
  const card = feedValue.products.find((product) => product.code === code);
  if (!card) fail(`missing card ${code}`);
  return card;
}

function expectedHubTileIds(slug: string, catalog: Product[]): string[] {
  if (slug === "shoes") {
    const byHref = new Map(SHOE_TILES.map((tile) => [tile.href, tile.id]));
    const ids: string[] = [];
    for (const tile of footwearLandingTiles(catalog)) {
      const id = byHref.get(tile.href);
      if (!id || ids.includes(id)) continue;
      ids.push(id);
    }
    return ids;
  }
  const typeGroups = subcategoryHubGroups(slug, catalog);
  const series = sportSeriesFolders(slug, catalog).filter(
    (tile) => !typeGroups.some((folder) => folder.key === tile.key),
  );
  const ids: string[] = [];
  for (const tile of [...typeGroups, ...series]) {
    const id = `${slug}--${publicFolderKey(tile.key)}`;
    const target = namespacedFeedTargets().get(id);
    if (target && tile.href === target) ids.push(id);
  }
  return ids;
}

function legacyGroupSlug(value: string): string | null {
  const next = publicCopy(value)
    .replace(/[<>\u0000-\u001f\u007f]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!next || !/^[A-Za-z0-9-]+$/.test(next)) return null;
  return next;
}

function copyValues(feedValue: MobileStorefront): string[] {
  return [
    ...feedValue.nodes.flatMap((node) => [
      node.title.en,
      node.title.fr,
      node.description.en,
      node.description.fr,
      ...node.audiences.flatMap((row) => [row.label.en, row.label.fr]),
    ]),
    ...feedValue.products.flatMap((product) => [
      product.name,
      product.label ?? "",
      product.labelFr ?? "",
      product.packLabel ?? "",
      product.line ?? "",
    ]),
    ...feedValue.checkout.shipping.flatMap((method) => [method.title.en, method.title.fr]),
  ];
}

function treeLines(feedValue: MobileStorefront): string {
  const nodes = indexNodes(feedValue);
  const seen = new Set<string>();
  const lines: string[] = [];
  const walkNode = (key: string, depth: number) => {
    const node = nodes.get(key);
    if (!node) return;
    lines.push(`${"  ".repeat(depth)}${node.key}`);
    if (seen.has(key)) return;
    seen.add(key);
    for (const child of node.tiles) walkNode(child, depth + 1);
  };
  walkNode(feedMenuKey("home"), 0);
  for (const key of feedValue.menus) walkNode(key, 0);
  for (const key of feedValue.categoryOrder) if (!seen.has(key)) walkNode(key, 0);
  for (const node of feedValue.nodes) {
    if (!seen.has(node.key)) walkNode(node.key, 0);
  }
  return lines.join("\n");
}
