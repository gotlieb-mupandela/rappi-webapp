/**
 * Mobile feed checks: version query handling, fixed promo targets, public copy,
 * absolute card photos, empty Flow, and the kids slug.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { typeFolderForSubcategory } from "../lib/catalog";
import { catalogVersion } from "../lib/catalog-version";
import { clientAssortment } from "../lib/assortment";
import { formatPrice } from "../lib/format";
import { productInHub } from "../lib/hub-membership";
import { listingCardCandidates } from "../lib/media";
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
import { feedVersionParamStatus, mobileFeedVersion } from "../lib/mobile-feed-version";
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
assert.equal(feed.version, mobileFeedVersion(version));
assert.equal(feed.version.endsWith(".2"), true);
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
  const source = products.find((product) => product.code === card.code);
  assert.ok(source);
  const siteFirst = listingCardCandidates(source)[0] ?? null;
  assert.equal(card.cardImage, feedImageUrl(siteFirst), card.code);
  if (card.cardImage === null) {
    assert.equal(card.code, "HTTP-DROP");
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
  } else {
    assert.equal(card.label, null, card.code);
  }
  assert.equal("line" in card, false, card.code);
  assert.equal("imageUrl" in card, false);
  assert.equal(typeof card.price, "number");
}
assertFeedLinks(feed);
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
assert.ok(feed.flow);
assert.equal(feed.flow.count, 0);
assert.equal(feed.flow.targetId, "flow");
assert.equal(feed.folders.some((folder) => folder.key === "flow"), true);

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
  assert.ok(folder, key);
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

assert.deepEqual(
  feed.audiences.map((tile) => tile.id),
  ["audience:men", "audience:women", "audience:kids"],
);
assert.deepEqual(feed.categoryOrder, feed.categories.map((category) => category.slug));
for (const slug of ["sportswear", "balls-bags", "running-fitness", "hiking", "padel", "resort", "football"]) {
  assert.equal(feed.categoryOrder.includes(slug), true, slug);
}
const menMenu = feed.menus.find((menu) => menu.id === "men");
assert.ok(menMenu);
for (const key of ["hiking-outdoor", "underwear-brama", "racket-sports", "resort", "beachwear"]) {
  assert.equal(menMenu.tiles.some((tile) => tile.href.includes(`group=${key}`)), true, key);
}
const accessories = feed.menus.find((menu) => menu.id === "accessories");
assert.ok(accessories);
for (const key of ["acc-balls", "acc-palas-padel", "acc-backpacks"]) {
  assert.equal(accessories.tiles.some((tile) => tile.id === key), true, key);
}
const folderKeys = new Set(feed.folders.map((folder) => folder.key));
for (const folder of feed.folders) {
  if (folder.parent) assert.equal(folderKeys.has(folder.parent), true, folder.key);
}

const folderMap = JSON.parse(read("data/product-folders.json")) as Record<string, string[]>;
const bakedWithFolders = baked.map((product) => ({
  ...product,
  folders: folderMap[product.code] ?? [],
}));
const bakedFeed = buildMobileFeed(bakedWithFolders, catalogVersion(bakedWithFolders));
assert.equal(bakedFeed.version, mobileFeedVersion(catalogVersion(bakedWithFolders)));
assertFeedLinks(bakedFeed);
const bakedFolderKeys = new Set(bakedFeed.folders.map((folder) => folder.key));
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
  assert.equal(bakedFolderKeys.has(key), true, key);
}
for (const folder of bakedFeed.folders) {
  if (folder.parent) assert.equal(bakedFolderKeys.has(folder.parent), true, folder.key);
  if (folder.count > 0) assert.equal(bakedFolderKeys.has(folder.key), true);
}
const groups: Array<{
  name: string;
  entry: string;
  match: (product: Product) => boolean;
}> = [
  { name: "sportswear", entry: "category:sportswear", match: (product) => productInHub(product, "sportswear") },
  { name: "balls-bags", entry: "category:balls-bags", match: (product) => productInHub(product, "balls-bags") },
  {
    name: "running-fitness",
    entry: "category:running-fitness",
    match: (product) => productInHub(product, "running-fitness"),
  },
  {
    name: "hiking jackets",
    entry: "category:hiking:sub:jackets",
    match: (product) => productInHub(product, "hiking") && product.subcategory === "jackets",
  },
  { name: "padel", entry: "category:padel", match: (product) => productInHub(product, "padel") },
  { name: "resort", entry: "category:resort", match: (product) => productInHub(product, "resort") },
  {
    name: "shin guard",
    entry: "category:football:sub:shin-guards",
    match: (product) => product.subcategory === "shin-guards",
  },
];
for (const group of groups) {
  const rows = bakedWithFolders.filter(
    (product) => product.available !== false && product.code !== "DPO-TEST" && group.match(product),
  );
  let covered = 0;
  const folders = new Map<string, number>();
  for (const product of rows) {
    const hits = reachIds(product, bakedFeed);
    assert.equal(hits.includes(group.entry), true, `${product.code} ${group.name}`);
    if (hits.includes(group.entry)) covered += 1;
    for (const hit of hits) {
      if (!hit.startsWith("folder:")) continue;
      folders.set(hit, (folders.get(hit) ?? 0) + 1);
    }
  }
  assert.equal(covered, rows.length, group.name);
  const folderSummary = [...folders.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([id, count]) => `${id} ${count}`)
    .join(", ");
  console.log(
    `${group.name}: ${rows.length} products, entry ${group.entry}${folderSummary ? `, folders ${folderSummary}` : ""}`,
  );
}

console.log(`feed check ok (fixture products ${feed.products.length}, version ${feed.version})`);

function assertFeedLinks(feedValue: MobileFeed) {
  const byId = new Map(feedValue.targets.map((target) => [target.id, target.href]));
  const nodes: Array<{ targetId: string; href: string; label: string }> = [
    ...feedValue.home.sections.flatMap((section) => section.tiles),
    ...feedValue.audiences,
    ...feedValue.menus.flatMap((menu) => [menu, ...menu.tiles]),
    ...feedValue.kids.tiles,
    ...(feedValue.flow ? [feedValue.flow] : []),
    ...feedValue.promos,
    ...feedValue.folders,
    ...feedValue.categories.flatMap((category) => [category, ...category.children]),
  ];
  for (const node of nodes) {
    assert.equal(byId.get(node.targetId), node.href, node.targetId);
    assert.equal(node.href.startsWith("/"), true, node.href);
    assert.equal(/^https?:/i.test(node.href), false, node.href);
    assert.equal(node.label.includes("<"), false, node.label);
  }
  const parsed = JSON.parse(JSON.stringify(feedValue)) as MobileFeed;
  assert.equal(parsed.version, feedValue.version);
  assert.equal(Array.isArray(parsed.targets), true);
  assert.equal(Array.isArray(parsed.folders), true);
  assert.equal(Array.isArray(parsed.categoryOrder), true);
}

function reachIds(product: Product & { folders?: string[] }, feedValue: MobileFeed): string[] {
  const hits: string[] = [];
  for (const key of product.folders ?? []) {
    const pub = publicFolderKey(key);
    if (feedValue.folders.some((folder) => folder.key === pub)) hits.push(`folder:${pub}`);
  }
  const group = typeFolderForSubcategory(product.subcategory);
  for (const category of feedValue.categories) {
    if (!productInHub(product, category.slug)) continue;
    hits.push(category.targetId);
    for (const child of category.children) {
      if (child.kind === "sub" && child.slug === product.subcategory) hits.push(child.targetId);
      if (child.kind === "group" && child.slug === group) hits.push(child.targetId);
    }
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

function everyImage(feedValue: MobileFeed): Array<string | null> {
  return [
    ...feedValue.home.sections.flatMap((section) => section.tiles.map((tile) => tile.image)),
    ...feedValue.audiences.map((tile) => tile.image),
    ...feedValue.menus.flatMap((menu) => [menu.image, ...menu.tiles.map((tile) => tile.image)]),
    ...feedValue.kids.tiles.map((tile) => tile.image),
    feedValue.flow?.image ?? null,
    ...feedValue.promos.map((tile) => tile.image),
    ...feedValue.folders.map((folder) => folder.image),
    ...feedValue.categories.flatMap((category) => [
      category.image,
      ...category.children.map((child) => child.image),
    ]),
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
    ...feedValue.targets.map((target) => target.href),
    ...feedValue.home.sections.flatMap((section) => section.tiles.map((tile) => tile.href)),
    ...feedValue.audiences.map((tile) => tile.href),
    ...feedValue.menus.flatMap((menu) => [menu.href, ...menu.tiles.map((tile) => tile.href)]),
    ...feedValue.kids.tiles.map((tile) => tile.href),
    ...(feedValue.flow ? [feedValue.flow.href] : []),
    ...feedValue.promos.map((tile) => tile.href),
    ...feedValue.folders.map((folder) => folder.href),
    ...feedValue.categories.flatMap((category) => [
      category.href,
      ...category.children.map((child) => child.href),
    ]),
  ];
  return hrefs;
}

function copyValues(feedValue: MobileFeed): string[] {
  return [
    ...feedValue.home.sections.flatMap((section) => [section.label, ...section.tiles.map((tile) => tile.label)]),
    ...feedValue.audiences.map((tile) => tile.label),
    ...feedValue.menus.flatMap((menu) => [menu.label, ...menu.tiles.map((tile) => tile.label)]),
    ...feedValue.kids.tiles.map((tile) => tile.label),
    ...(feedValue.flow ? [feedValue.flow.label] : []),
    ...feedValue.promos.map((tile) => tile.label),
    ...feedValue.folders.map((folder) => folder.label),
    ...feedValue.categories.flatMap((category) => [
      category.label,
      ...category.children.map((child) => child.label),
    ]),
    ...feedValue.products.flatMap((product) => [product.name, product.label ?? "", product.packLabel ?? ""]),
  ];
}
