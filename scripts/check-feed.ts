/**
 * Mobile feed checks: version query handling, fixed promo targets, public copy,
 * absolute card photos, empty Flow, and the kids slug.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { catalogVersion } from "../lib/catalog-version";
import { formatPrice } from "../lib/format";
import { allowedImageHosts } from "../lib/image-hosts";
import { filterListing, type ListingItem } from "../lib/listing-core";
import { metaAbsoluteUrl } from "../lib/meta/site";
import {
  buildMobileFeed,
  feedImageUrl,
  feedProductCard,
  type FeedProduct,
  type MobileFeed,
} from "../lib/mobile-feed";
import { LEGACY_FOLDER_SLUGS, publicFolderKey } from "../lib/mobile-feed-slugs";
import { FLOW_TILE, PROMO_TILES, feedTargetSet, folderHref } from "../lib/mobile-feed-targets";
import { feedVersionParamStatus } from "../lib/mobile-feed-version";
import type { Product } from "../lib/types";
import { loadFixtureProducts } from "./feed-fixture";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

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
assert.equal(feed.version, version);
assert.equal(feedBodyHas(feed, probe), false);

const promoHrefs = new Set(PROMO_TILES.map((tile) => tile.href));
const allowed = feedTargetSet();
for (const href of everyHref(feed)) {
  assert.equal(allowed.has(href), true, href);
}
for (const promo of feed.promos) {
  assert.equal(promoHrefs.has(promo.href), true, promo.href);
}
assert.equal(feed.promos.some((promo) => promo.id === "outlet-promotions"), true);
assert.equal(feed.promos.some((promo) => promo.id === "outlet-price-199-299"), false);

for (const value of copyValues(feed)) {
  if (value.toLowerCase().includes("joma")) fail(`public copy contains the brand word: ${value}`);
}

for (const card of feed.products) {
  if (card.cardImage === null) {
    assert.equal(card.code, "HTTP-DROP");
  } else {
    assert.equal(card.cardImage.startsWith("https://"), true, card.code);
    assert.equal(card.cardImage.startsWith("/"), false, card.code);
    assert.equal(feedImageUrl(card.cardImage), card.cardImage, card.code);
  }
  assert.equal("imageUrl" in card, false);
  assert.equal(typeof card.price, "number");
}
for (const image of everyImage(feed)) {
  if (image === null) continue;
  assert.equal(image.startsWith("https://"), true, image);
  assert.equal(feedImageUrl(image), image, image);
}
assert.equal(feed.home.sections[0]?.tiles.every((tile) => tile.image?.startsWith("https://")), true);
assertNoHostList(feed);
assert.equal(JSON.stringify(feed).toLowerCase().includes("access-control"), false);
assert.equal(JSON.stringify(feed).includes("example.com"), false);
assert.equal(JSON.stringify(feed).includes("http://"), false);
assert.equal(JSON.stringify(feed).includes("joma-flow"), false);
assert.equal(JSON.stringify(feed).includes("joma-kids"), false);

const shoes = feed.menus.find((menu) => menu.id === "shoes");
assert.ok(shoes);
assert.equal(shoes.tiles.some((tile) => tile.id === "flow"), false);
assert.equal(feed.folders.some((folder) => folder.key === "flow" || folder.key === "wf-flow"), false);

const kids = feed.menus.find((menu) => menu.id === "kids");
assert.ok(kids);
assert.equal(kids.slug, "kids");
const kidsBand = feed.kids.tiles.find((tile) => tile.id === "kids-1-4");
assert.ok(kidsBand);
assert.equal(kidsBand.count > 0, true);
assert.equal(feed.kids.tiles.find((tile) => tile.id === "kids-6-10")?.count, 0);

const women = feed.menus.find((menu) => menu.id === "women");
assert.ok(women);
assert.equal(women.tiles.some((tile) => tile.href.includes("w-")), true);
assert.equal(feed.folders.some((folder) => folder.key.startsWith("w-")), true);

const medium = cardByCode(feed, "CARD-MEDIUM");
assert.ok(medium.cardImage);
assert.equal(medium.cardImage.includes("/images/medium/"), true);
assert.equal(medium.cardImage.includes("card-primary"), false);
assert.equal(feedImageUrl(medium.cardImage), medium.cardImage);

const relative = cardByCode(feed, "REL-PATH");
const relativeAbsolute = metaAbsoluteUrl("/catalog-photos/rel-path.jpg");
assert.equal(relative.cardImage, relativeAbsolute);
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
assert.equal(JSON.stringify(offFeed).includes(offHostUrl), false);
assert.equal(JSON.stringify(offFeed).includes("not-on-the-list.example"), false);
assertNoHostList(offFeed);

const codes = new Set(feed.products.map((product) => product.code));
assert.equal(codes.has("HIDDEN-UNAVAIL"), false);
assert.equal(codes.has("DPO-TEST"), false);
assert.equal(feed.products.length, 18);

for (const key of ["kids-1-4", "w-cycling", "outlet-promotions", "joma-flow", "teamwear"]) {
  const expected = filterListing(products as ListingItem[], { group: key }).length;
  const folder = feed.folders.find((row) => row.key === publicFolderKey(key));
  if (expected === 0) assert.equal(folder, undefined, key);
  else assert.equal(folder?.count, expected, key);
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
const flowFolder = flowFeed.folders.find((folder) => folder.key === "flow");
assert.ok(flowFolder);
assert.equal(flowFolder.label, "Flow");
assert.equal(flowFolder.href, "/shop/shoes?group=flow");
assert.equal(flowFolder.count, 1);
assert.equal(JSON.stringify(flowFeed).includes("joma-flow"), false);
assert.equal(JSON.stringify(flowFeed).includes("joma-kids"), false);
assert.equal(
  flowFeed.menus.find((menu) => menu.id === "shoes")?.tiles.some((tile) => tile.id === "flow"),
  true,
);
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
assert.equal(versionRoute.includes("NextResponse.json({ version },"), true);
assert.equal(versionRoute.includes("s-maxage=60"), true);
assert.equal(versionRoute.includes("stale-while-revalidate=300"), true);
assert.equal(storefrontRoute.includes('status: 400'), true);
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

const feedSources = [
  "lib/mobile-feed.ts",
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
assert.equal(feedBuilder.includes("allowedImageHosts()"), true);
assert.equal(feedBuilder.includes("imageHostAllows("), true);
assert.equal(feedBuilder.includes("isAllowedProductImageUrl("), true);
assert.equal(feedBuilder.includes("ALLOWED_IMAGE_HOSTS"), false);
assert.equal(feedBuilder.includes("Content-Security-Policy"), false);
for (const relative of feedSources) {
  const source = read(relative);
  for (const rule of allowedImageHosts()) {
    if (source.includes(rule.host)) fail(`${relative} copies host ${rule.host}`);
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

console.log(`feed check ok (fixture products ${feed.products.length}, version ${feed.version})`);

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

function everyImage(feedValue: MobileFeed): Array<string | null> {
  return [
    ...feedValue.home.sections.flatMap((section) => section.tiles.map((tile) => tile.image)),
    ...feedValue.menus.flatMap((menu) => [menu.image, ...menu.tiles.map((tile) => tile.image)]),
    ...feedValue.kids.tiles.map((tile) => tile.image),
    ...feedValue.promos.map((tile) => tile.image),
    ...feedValue.products.map((product) => product.cardImage),
  ];
}

function cardByCode(feedValue: MobileFeed, code: string): FeedProduct {
  const card = feedValue.products.find((product) => product.code === code);
  if (!card) fail(`missing card ${code}`);
  return card;
}

function everyHref(feedValue: MobileFeed): string[] {
  const hrefs = [
    ...feedValue.home.sections.flatMap((section) => section.tiles.map((tile) => tile.href)),
    ...feedValue.menus.flatMap((menu) => [menu.href, ...menu.tiles.map((tile) => tile.href)]),
    ...feedValue.kids.tiles.map((tile) => tile.href),
    ...feedValue.promos.map((tile) => tile.href),
    ...feedValue.folders.map((folder) => folder.href),
  ];
  return hrefs;
}

function copyValues(feedValue: MobileFeed): string[] {
  return [
    ...feedValue.home.sections.flatMap((section) => [section.label, ...section.tiles.map((tile) => tile.label)]),
    ...feedValue.menus.flatMap((menu) => [menu.label, ...menu.tiles.map((tile) => tile.label)]),
    ...feedValue.kids.tiles.map((tile) => tile.label),
    ...feedValue.promos.map((tile) => tile.label),
    ...feedValue.folders.map((folder) => folder.label),
    ...feedValue.products.flatMap((product) => [product.name, product.packLabel ?? ""]),
  ];
}
