/**
 * Full-catalog parity: every feed product and every home, category, and
 * athlete tile against the same helpers the website uses.
 * Prints match and mismatch counts. Exits 1 when any difference remains.
 */
import { clientAssortment, renderAssortmentLabel } from "../lib/assortment";
import { AUDIENCES, CATEGORIES } from "../lib/catalog";
import { catalogVersion } from "../lib/catalog-version";
import { formatPrice } from "../lib/format";
import { audienceTiles } from "../lib/hubs";
import { HOME_TILE_LAYOUT } from "../lib/home-tiles";
import { brandPath, galleryVersion } from "../lib/image-cache";
import { makeT } from "../lib/i18n/translate";
import { publicCopy } from "../lib/mobile-feed-slugs";
import { buildMobileStorefront, feedImageUrl } from "../lib/mobile-feed";
import { namespacedFeedTargets } from "../lib/mobile-feed-targets";
import { products as catalog } from "../lib/products";
import { audienceTileFrame, audienceTileImage, FOLDER_TILE_FRAME, PRODUCT_CARD_FRAME } from "../lib/tile-frame";

const tEn = makeT("na");
const audienceSlugs = new Set(AUDIENCES.map((audience) => audience.slug));

type Diff = { id: string; field: string; feed: string; site: string };
const diffs: Diff[] = [];

function note(id: string, field: string, feed: unknown, site: unknown) {
  const left = feed == null ? "" : String(feed);
  const right = site == null ? "" : String(site);
  if (left === right) return;
  diffs.push({ id, field, feed: left, site: right });
}

function pathOf(url: string): string {
  try {
    if (url.startsWith("http")) return new URL(url).pathname;
    return url.split("?")[0]?.split("#")[0] ?? url;
  } catch {
    return url;
  }
}

function plain(value: string): string {
  return publicCopy(value)
    .replace(/[<>\u0000-\u001f\u007f]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const feed = buildMobileStorefront(catalog, catalogVersion(catalog));
const byCode = new Map(feed.products.map((card) => [card.code, card]));
const nodes = new Map(feed.nodes.map((node) => [node.key, node]));

const counts = {
  catalog: catalog.length,
  feedProducts: feed.products.length,
  excluded: 0,
  cardImageMatch: 0,
  priceMatch: 0,
  priceLabelMatch: 0,
  packLabelMatch: 0,
  isPackMatch: 0,
  pairCountMatch: 0,
  cardFrameMatch: 0,
  catalogPriceEqual: 0,
  homeMatch: 0,
  audienceMatch: 0,
  tileFrameMatch: 0,
};

for (const product of catalog) {
  if (product.price === product.unitPrice) counts.catalogPriceEqual += 1;
  else note(product.code, "catalog price/unitPrice", product.price, product.unitPrice);
}

for (const card of feed.products) {
  const product = catalog.find((row) => row.code === card.code);
  if (!product) {
    note(card.code, "catalog row", "missing", "present");
    continue;
  }
  if (card.cardImage === (card.images[0] ?? null)) counts.cardImageMatch += 1;
  else note(card.code, "cardImage", card.cardImage, card.images[0] ?? null);

  if (card.price === product.price && card.price === product.unitPrice) counts.priceMatch += 1;
  else note(card.code, "price", card.price, product.unitPrice);

  const sitePrice = formatPrice(product.unitPrice);
  if (card.priceLabel === sitePrice) counts.priceLabelMatch += 1;
  else note(card.code, "priceLabel", card.priceLabel, sitePrice);

  const view = clientAssortment(product);
  const rendered = renderAssortmentLabel(view.labelKey, view.labelParams, tEn, view.label);
  const sitePack = rendered ? plain(rendered) || null : null;
  if (card.packLabel === sitePack) counts.packLabelMatch += 1;
  else note(card.code, "packLabel", card.packLabel, sitePack);

  if (card.isPack === view.isPack) counts.isPackMatch += 1;
  else note(card.code, "isPack", card.isPack, view.isPack);

  if (card.pairCount === view.pairCount) counts.pairCountMatch += 1;
  else note(card.code, "pairCount", card.pairCount, view.pairCount);

  if (card.fit === PRODUCT_CARD_FRAME.fit && card.objectPosition === PRODUCT_CARD_FRAME.objectPosition) {
    counts.cardFrameMatch += 1;
  } else {
    note(card.code, "card fit", `${card.fit} ${card.objectPosition}`, `${PRODUCT_CARD_FRAME.fit} ${PRODUCT_CARD_FRAME.objectPosition}`);
  }

  if (!card.audience) note(card.code, "audience", card.audience, "men|women|kids|unisex");
}

const feedCodes = new Set(feed.products.map((card) => card.code));
for (const product of catalog) {
  if (!feedCodes.has(product.code)) counts.excluded += 1;
}
if (counts.feedProducts !== byCode.size) note("products", "duplicate code", feed.products.length, byCode.size);

for (const layout of HOME_TILE_LAYOUT) {
  const key = `home-${layout.id}`;
  const node = nodes.get(key);
  if (!node?.image) {
    note(key, "image", node?.image ?? null, "site home tile");
    continue;
  }
  if (node.fit === layout.fit && node.objectPosition === layout.objectPosition) counts.homeMatch += 1;
  else note(key, "home frame", `${node.fit} ${node.objectPosition}`, `${layout.fit} ${layout.objectPosition}`);
}

const targets = namespacedFeedTargets();
for (const category of CATEGORIES) {
  const node = nodes.get(category.slug);
  if (!node || node.kind !== "category") continue;
  const tiles = audienceTiles(catalog, { categorySlug: category.slug });
  if (tiles.length <= 1) {
    note(category.slug, "audiences hidden", node.audiences.length, 0);
    continue;
  }
  const expected = tiles.filter((tile) => {
    if (!audienceSlugs.has(tile.key) || tile.count <= 0) return false;
    const id = `${category.slug}--${tile.key}`;
    return targets.get(id) === tile.href;
  });
  note(category.slug, "audience ids", node.audiences.map((row) => row.id).join(","), expected.map((tile) => `${category.slug}--${tile.key}`).join(","));
  for (const tile of expected) {
    const id = `${category.slug}--${tile.key}`;
    const row = node.audiences.find((item) => item.id === id);
    if (!row) continue;
    const siteRaw = audienceTileImage(tile.cover, tile.sample ?? null);
    const frame = audienceTileFrame(Boolean(tile.cover));
    const siteImage = siteRaw.startsWith("/") ? feedImageUrl(siteRaw) : siteRaw;
    const samePath = Boolean(row.image) && pathOf(row.image) === pathOf(siteRaw);
    const sameFrame = row.fit === frame.fit && row.objectPosition === frame.objectPosition;
    let versioned = true;
    if (brandPath(siteRaw)) versioned = /[?&]v=/.test(row.image ?? "");
    else if (tile.sample) {
      const token = galleryVersion(tile.sample.imageUrl ?? "", tile.sample.images ?? []);
      versioned = !token || (row.image ?? "").includes(`v=${encodeURIComponent(token)}`) || (row.image ?? "").includes(`v=${token}`);
    }
    if (samePath && sameFrame && versioned && row.image?.startsWith("https://")) counts.audienceMatch += 1;
    else {
      note(id, "audience image", row.image, siteImage);
      note(id, "audience frame", `${row.fit} ${row.objectPosition}`, `${frame.fit} ${frame.objectPosition}`);
    }
    if (pathOf(row.image ?? "").endsWith("/brand/hub-sportswear.png")) {
      note(id, "audience image", row.image, "not the sportswear cover");
    }
  }
}

const sportswearKids = nodes.get("sportswear")?.audiences.find((row) => row.id === "sportswear--kids");
const kids = nodes.get("kids");
note("kids", "image", kids?.image ?? null, sportswearKids?.image ?? null);
note("kids", "frame", `${kids?.fit} ${kids?.objectPosition}`, "cover center");
note("men", "frame", `${nodes.get("men")?.fit} ${nodes.get("men")?.objectPosition}`, "contain center");
note("women", "frame", `${nodes.get("women")?.fit} ${nodes.get("women")?.objectPosition}`, "contain center");
note("men", "image path", pathOf(nodes.get("men")?.image ?? ""), "/brand/audience-men.png");
note("women", "image path", pathOf(nodes.get("women")?.image ?? ""), "/brand/audience-women.png");
if ((kids?.image ?? "").includes("hub-sportswear")) note("kids", "image", kids?.image ?? "", "sportswear kids product photo");

for (const node of feed.nodes) {
  if (!node.image) {
    if (node.fit === null && node.objectPosition === null) counts.tileFrameMatch += 1;
    else note(node.key, "empty frame", `${node.fit} ${node.objectPosition}`, "null null");
    continue;
  }
  if (node.key.startsWith("home-") || node.kind === "audience") continue;
  if (node.fit === FOLDER_TILE_FRAME.fit && node.objectPosition === FOLDER_TILE_FRAME.objectPosition) counts.tileFrameMatch += 1;
  else note(node.key, "tile frame", `${node.fit} ${node.objectPosition}`, `${FOLDER_TILE_FRAME.fit} ${FOLDER_TILE_FRAME.objectPosition}`);
}

const sportswearAudiences = nodes.get("sportswear")?.audiences ?? [];
const sportswearImages = new Set(sportswearAudiences.map((row) => row.image));
if (sportswearAudiences.length !== 3 || sportswearImages.size !== 3) {
  note("sportswear", "distinct athlete images", sportswearImages.size, 3);
}

console.log(`catalog products ${counts.catalog}`);
console.log(`feed products ${counts.feedProducts}`);
console.log(`excluded from feed ${counts.excluded}`);
console.log(`catalog price equals unitPrice ${counts.catalogPriceEqual} of ${counts.catalog}`);
console.log(`cardImage equals images[0] ${counts.cardImageMatch} of ${counts.feedProducts}`);
console.log(`price matches unitPrice ${counts.priceMatch} of ${counts.feedProducts}`);
console.log(`priceLabel matches ${counts.priceLabelMatch} of ${counts.feedProducts}`);
console.log(`packLabel matches ${counts.packLabelMatch} of ${counts.feedProducts}`);
console.log(`isPack matches ${counts.isPackMatch} of ${counts.feedProducts}`);
console.log(`pairCount matches ${counts.pairCountMatch} of ${counts.feedProducts}`);
console.log(`card fit matches ${counts.cardFrameMatch} of ${counts.feedProducts}`);
console.log(`home tiles ${counts.homeMatch} of ${HOME_TILE_LAYOUT.length}`);
console.log(`audience rows ${counts.audienceMatch}`);
console.log(`pictured tiles ${counts.tileFrameMatch}`);
console.log(`mismatches ${diffs.length}`);
for (const diff of diffs.slice(0, 40)) {
  console.log(`DIFF ${diff.id} ${diff.field} feed=${diff.feed} site=${diff.site}`);
}
if (diffs.length > 40) console.log(`... ${diffs.length - 40} more`);
if (diffs.length > 0) process.exit(1);
