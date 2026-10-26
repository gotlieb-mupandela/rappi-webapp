/**
 * Mobile feed checks: version query handling, fixed target keys, public copy,
 * absolute card photos, checkout countries, and the navigation tree.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { clientAssortment } from "../lib/assortment";
import { CATEGORIES } from "../lib/catalog";
import { catalogVersion } from "../lib/catalog-version";
import { formatPrice } from "../lib/format";
import { productInHub } from "../lib/hub-membership";
import { allowedImageHosts } from "../lib/image-hosts";
import { eurPerNad } from "../lib/i18n/config";
import { shippingName } from "../lib/i18n/labels";
import { makeT } from "../lib/i18n/translate";
import { isLiveFolder } from "../lib/joma-live";
import { FOOTWEAR_FOLDERS } from "../lib/joma-tree";
import { filterListing, type ListingItem } from "../lib/listing-core";
import { listingCardCandidates } from "../lib/media";
import { metaAbsoluteUrl } from "../lib/meta/site";
import {
  checkoutCountries,
  COUNTRY_LIST_CAP,
  COUNTRY_NAME_MAX,
} from "../lib/mobile-feed-countries";
import {
  buildMobileFeed,
  feedImageUrl,
  feedProductCard,
  type FeedNode,
  type FeedProduct,
  type MobileFeed,
} from "../lib/mobile-feed";
import { LEGACY_FOLDER_SLUGS, publicFolderKey } from "../lib/mobile-feed-slugs";
import {
  FLOW_TILE,
  KIDS_FOOTWEAR_TILE,
  KIDS_TILES,
  PROMO_TILES,
  SHOE_TILES,
  TEAM_TILES,
  feedMenuKey,
  feedTargetKeys,
  folderHref,
  footwearTypeKeys,
  headerMenuKeys,
  kidsAgeChildren,
  sponsorReplicaTiles,
  sportswearTypeKeys,
} from "../lib/mobile-feed-targets";
import { feedVersionParamStatus, mobileFeedVersion } from "../lib/mobile-feed-version";
import { SHIPPING_METHODS } from "../lib/shipping";
import type { Product } from "../lib/types";
import { VAT_COUNTRIES } from "../lib/vat";
import { loadFixtureProducts } from "./feed-fixture";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const tFr = makeT("eu");

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
const BANNED_KEYS = new Set(["href", "vatRates", "vatCountries", "line", "targetId"]);
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
assert.equal(folderHref("joma-flow"), FLOW_TILE.href);
assert.equal(folderHref("joma-flow"), "/shop/shoes?group=flow");

const products = loadFixtureProducts();
assert.equal(products.length, 20);
const version = catalogVersion(products);
const feed = buildMobileFeed(products, version);
assert.equal(feed.version, mobileFeedVersion(version));
assert.equal(feed.version.endsWith(".3"), true);
assert.equal(feedBodyHas(feed, probe), false);
assert.deepEqual(feed.menus, headerMenuKeys());
assert.deepEqual(feed.categoryOrder, CATEGORIES.map((category) => category.slug));
assert.deepEqual(feed.checkout.countries, countries);
assert.equal(feed.checkout.eurPerNad, eurPerNad());
assert.equal(Number.isFinite(feed.checkout.eurPerNad) && feed.checkout.eurPerNad > 0, true);
assert.deepEqual(
  feed.checkout.shipping.map((method) => method.key),
  SHIPPING_METHODS.map((method) => method.id),
);
for (const method of SHIPPING_METHODS) {
  const row = feed.checkout.shipping.find((item) => item.key === method.id);
  assert.ok(row);
  assert.equal(row.amountNad, method.cost);
  assert.equal(row.title.en, method.name);
  assert.equal(row.title.fr, shippingName(method.id, method.name, tFr));
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
    assert.equal(card.code, "HTTP-DROP");
    assert.equal(card.images.length, 0);
  } else {
    assert.equal(card.cardImage.startsWith("https://"), true, card.code);
    assert.equal(card.cardImage.startsWith("/"), false, card.code);
    assert.equal(feedImageUrl(card.cardImage), card.cardImage, card.code);
  }
  const expectedLabel = clientAssortment(source).label;
  assert.equal(card.packLabel, card.label);
  if (expectedLabel) {
    assert.equal(typeof card.label, "string", card.code);
    assert.equal(card.label!.toLowerCase().includes("joma"), false, card.code);
    assert.equal(card.label!.includes("<"), false, card.code);
    assert.equal(typeof card.labelFr, "string", card.code);
  } else {
    assert.equal(card.label, null, card.code);
    assert.equal(card.labelFr, null, card.code);
  }
  assert.equal("line" in card, false, card.code);
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
assert.equal(home.tiles.every((key) => byKey.get(key)?.image?.startsWith("https://")), true);
assertNoHostList(feed);
assert.equal(JSON.stringify(feed).toLowerCase().includes("access-control"), false);
assert.equal(JSON.stringify(feed).includes("example.com"), false);
assert.equal(JSON.stringify(feed).includes("http://"), false);
assert.equal(JSON.stringify(feed).includes("joma-flow"), false);
assert.equal(JSON.stringify(feed).includes("joma-kids"), false);
assert.equal(JSON.stringify(feed).includes("vatRates"), false);

const footwearMenu = byKey.get(feedMenuKey("shoes"));
assert.ok(footwearMenu);
assert.equal(footwearMenu.tiles.includes("flow"), false);
assert.deepEqual(footwearMenu.tiles, SHOE_TILES.map((tile) => tile.id));
const flow = byKey.get("flow");
assert.ok(flow);
assert.equal(flow.kind, "folder");
assert.equal(flow.count, 0);
assert.equal(flow.label, "Flow");
assert.equal(flow.hidden, !isLiveFolder("joma-flow"));
const shoesCategory = byKey.get("shoes");
assert.ok(shoesCategory);
assert.equal(shoesCategory.tiles.includes("flow"), true);
assert.equal(shoesCategory.tiles.includes("footwear-outlet"), false);
assert.deepEqual(shoesCategory.tiles, footwearTypeKeys());

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
assert.deepEqual(sportswear.tiles, sportswearTypeKeys());
assert.equal(sportswear.tiles.length, 14);
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
  assert.equal(typeof node.labelFr, "string", node.key);
  assert.equal(node.label.includes("<"), false, node.key);
  assert.equal(node.labelFr.includes("<"), false, node.key);
}

const medium = cardByCode(feed, "CARD-MEDIUM");
assert.ok(medium.cardImage);
assert.equal(medium.cardImage, medium.images[0]);
assert.equal(medium.cardImage.includes("/images/medium/"), true);
assert.equal(medium.cardImage.includes("card-primary"), false);
assert.equal(feedImageUrl(medium.cardImage), medium.cardImage);

const relative = cardByCode(feed, "REL-PATH");
const relativeAbsolute = metaAbsoluteUrl("/catalog-photos/rel-path.jpg");
assert.equal(relative.cardImage, relativeAbsolute);
assert.equal(relative.images[0], relativeAbsolute);
assert.equal(feedImageUrl("/catalog-photos/rel-path.jpg"), relativeAbsolute);
assert.equal(feedImageUrl(relativeAbsolute), relativeAbsolute);

const pack = cardByCode(feed, "PACK-25");
assert.equal(pack.name.includes("Pack of 25"), true);
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
const offFeed = buildMobileFeed([offHost], catalogVersion([offHost]));
assert.equal(cardByCode(offFeed, "OFF-HOST").cardImage, null);
assert.deepEqual(cardByCode(offFeed, "OFF-HOST").images, []);
assert.equal(JSON.stringify(offFeed).includes(offHostUrl), false);
assert.equal(JSON.stringify(offFeed).includes("not-on-the-list.example"), false);
assertNoHostList(offFeed);

const codes = new Set(feed.products.map((product) => product.code));
assert.equal(codes.has("HIDDEN-UNAVAIL"), false);
assert.equal(codes.has("DPO-TEST"), false);
assert.equal(feed.products.length, 18);

for (const key of ["kids-1-4", "w-cycling", "outlet-promotions", "joma-flow", "teamwear"]) {
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
const flowFeed = buildMobileFeed(withFlow, catalogVersion(withFlow));
const flowNodes = indexNodes(flowFeed);
const flowFolder = flowNodes.get("flow");
assert.ok(flowFolder);
assert.equal(flowFolder.label, "Flow");
assert.equal(flowFolder.count, 1);
assert.equal(flowFolder.hidden, false);
assert.equal(JSON.stringify(flowFeed).includes("joma-flow"), false);
assert.equal(JSON.stringify(flowFeed).includes("joma-kids"), false);
assert.equal(flowNodes.get(feedMenuKey("shoes"))?.tiles.includes("flow"), true);
for (const value of copyValues(flowFeed)) {
  if (value.toLowerCase().includes("joma")) fail(`flow feed copy contains the brand word: ${value}`);
}

const baked = JSON.parse(read("data/products.json")) as Product[];
const relativeCodes: string[] = [];
const excludedCodes: string[] = [];
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
  const card = feedProductCard(product);
  if (!card) fail(`${product.code} was dropped instead of receiving an absolute card photo`);
  if (!card.cardImage || !card.cardImage.startsWith("https://")) {
    fail(`${product.code} cardImage is not absolute https`);
  }
  assert.equal(card.cardImage, card.images[0] ?? null, product.code);
  if (feedImageUrl(card.cardImage) !== card.cardImage) fail(`${product.code} cardImage failed the host check`);
  relativeCodes.push(product.code);
}
relativeCodes.sort();
excludedCodes.sort();
assert.equal(relativeCodes.length, 75);
console.log(`relative card images absolutized (${relativeCodes.length})`);
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
assert.equal(feedBuilder.includes("allowedImageHosts()"), true);
assert.equal(feedBuilder.includes("imageHostAllows("), true);
assert.equal(feedBuilder.includes("isAllowedProductImageUrl("), true);
assert.equal(feedBuilder.includes("ALLOWED_IMAGE_HOSTS"), false);
assert.equal(feedBuilder.includes("Content-Security-Policy"), false);
assert.equal(feedBuilder.includes("category:${"), false);
assert.equal(feedBuilder.includes("menu:${"), false);
assert.equal(feedTargets.includes("category:${"), false);
assert.equal(feedTargets.includes("`team:"), false);
for (const relativePath of feedSources) {
  const source = read(relativePath);
  for (const rule of allowedImageHosts()) {
    if (source.includes(rule.host)) fail(`${relativePath} copies host ${rule.host}`);
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
  folders: folderMap[product.code] ?? [],
}));
const bakedFeed = buildMobileFeed(bakedWithFolders, catalogVersion(bakedWithFolders));
assert.equal(bakedFeed.version, mobileFeedVersion(catalogVersion(bakedWithFolders)));
assert.equal(bakedFeed.version.endsWith(".3"), true);
assertFeedShape(bakedFeed);
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
  "flow",
]) {
  assert.equal(bakedNodes.has(key), true, key);
}
for (const node of bakedFeed.nodes) {
  if (node.parent) assert.equal(bakedNodes.has(node.parent), true, node.key);
}
assert.equal(bakedNodes.get("resort")?.kind, "folder");
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
const countLines = [
  `man site ${man.tiles.length} feed ${bakedNodes.get(feedMenuKey("men"))?.tiles.length}`,
  `woman site ${woman.tiles.length} feed ${bakedNodes.get(feedMenuKey("women"))?.tiles.length}`,
  `children site ${children.tiles.length} feed ${bakedNodes.get(feedMenuKey("kids"))?.tiles.length}`,
  `footwear menu site ${SHOE_TILES.length} feed ${bakedNodes.get(feedMenuKey("shoes"))?.tiles.length}`,
  `teams site ${TEAM_TILES.length} feed ${bakedNodes.get(feedMenuKey("teams"))?.tiles.length}`,
  `kits site ${sponsorReplicaTiles().length} feed ${bakedNodes.get(feedMenuKey("kits"))?.tiles.length}`,
  `accessories site 14 feed ${bakedNodes.get("accessories")?.tiles.length}`,
  `outlet site ${PROMO_TILES.length} feed ${bakedNodes.get("outlet")?.tiles.length}`,
  `sportswear shop ${sportswearTypeKeys().length} feed ${bakedNodes.get("sportswear")?.tiles.length}`,
  `footwear shop structural ${footwearTypeKeys().length} live ${liveFootwear.length} feed ${bakedNodes.get("shoes")?.tiles.length}`,
  `kids age children ${ageChildren.length}`,
  "supplier line field omitted",
  "Kosovo code XK is user-assigned, not an official ISO 3166-1 alpha-2",
];
console.log(countLines.join("\n"));
const tree = treeLines(bakedFeed);
writeFileSync("/tmp/mobile-feed-tree.txt", tree);
writeFileSync("/tmp/mobile-feed-counts.txt", countLines.join("\n"));
console.log(`tree lines ${tree.split("\n").length} chars ${tree.length}`);

console.log(`feed check ok (fixture products ${feed.products.length}, version ${feed.version})`);

function indexNodes(feedValue: MobileFeed) {
  return new Map(feedValue.nodes.map((node) => [node.key, node]));
}

function assertFeedShape(feedValue: MobileFeed) {
  const keys = feedTargetKeys();
  const parsed = JSON.parse(JSON.stringify(feedValue)) as MobileFeed;
  assert.equal(parsed.version, feedValue.version);
  assert.equal(Array.isArray(parsed.nodes), true);
  assert.equal(Array.isArray(parsed.menus), true);
  assert.equal(Array.isArray(parsed.categoryOrder), true);
  assert.equal(Array.isArray(parsed.checkout.countries), true);
  walk(feedValue, (key, value, path) => {
    if (BANNED_KEYS.has(key)) fail(`${path}.${key} is not a feed field`);
    if (HOST_LIST_KEYS.has(key)) fail(`${path}.${key} is a host list`);
    if (typeof value === "string") {
      if (value.startsWith("/") || value.startsWith("//") || /^http:\/\//i.test(value)) {
        fail(`${path} starts with a path or http URL`);
      }
    }
  });
  for (const node of feedValue.nodes) {
    assert.equal(keys.has(node.key), true, node.key);
    assert.equal(PREFIX.test(node.key), false, node.key);
    if (node.parent) {
      assert.equal(keys.has(node.parent), true, node.parent);
      assert.equal(PREFIX.test(node.parent), false, node.parent);
    }
    for (const tile of node.tiles) {
      assert.equal(keys.has(tile), true, tile);
      assert.equal(PREFIX.test(tile), false, tile);
    }
  }
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

function feedBodyHas(feedValue: MobileFeed, needle: string) {
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

function everyImage(feedValue: MobileFeed): Array<string | null> {
  return [
    ...feedValue.nodes.flatMap((node) => [node.image]),
    ...feedValue.products.flatMap((product) => [product.cardImage, ...product.images]),
  ];
}

function cardByCode(feedValue: MobileFeed, code: string): FeedProduct {
  const card = feedValue.products.find((product) => product.code === code);
  if (!card) fail(`missing card ${code}`);
  return card;
}

function copyValues(feedValue: MobileFeed): string[] {
  return [
    ...feedValue.nodes.flatMap((node) => [
      node.label,
      node.labelFr,
      node.description ?? "",
      node.descriptionFr ?? "",
    ]),
    ...feedValue.products.flatMap((product) => [
      product.name,
      product.label ?? "",
      product.labelFr ?? "",
      product.packLabel ?? "",
    ]),
    ...feedValue.checkout.countries.map((country) => country.name),
    ...feedValue.checkout.shipping.flatMap((method) => [method.title.en, method.title.fr]),
  ];
}

function treeLines(feedValue: MobileFeed): string {
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
