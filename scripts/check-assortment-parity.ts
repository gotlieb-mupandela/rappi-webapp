/**
 * The catalog API field `assortment` must match the storefront helpers.
 * Loads the live catalogue the same way GET /api/catalog does, and falls
 * back to the baked catalogue fixture when that read is unavailable.
 *
 * GET /api/mobile/storefront returns tiles and covers, not products, so it
 * has no assortment field to compare.
 */
import Module from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatPrice } from "../lib/format";
import {
  WHOLESALE_BALL_THRESHOLD_NAD,
  WHOLESALE_HEADWEAR_THRESHOLD_NAD,
  assortmentCopy,
  clientAssortment,
  curveSplitText,
  getAssortment,
  isApparelSku,
  isBallSku,
  isFootwearSku,
  isHeadwearSku,
  packTitleSuffix,
  renderAssortmentLabel,
  surtidoPackLines,
  surtidoCurveSizes,
  surtidoSizeLabel,
  type ClientAssortment,
} from "../lib/assortment";
import { toClientProduct, buildListing, filterListing } from "../lib/listing-core";
import { productDescription } from "../lib/copy";
import { cardImageUrl, isAllowedProductImageUrl, listingCardCandidates, productCardImageCandidates } from "../lib/media";
import { metaAbsoluteUrl, metaSiteUrl } from "../lib/meta/site";
import { versionProductImages } from "../lib/image-cache";
import { makeT } from "../lib/i18n/translate";
import type { Product } from "../lib/types";

const en = makeT();
const fr = makeT("eu");
const BRAND = "Joma";
const EM_DASH = "\u2014";

/** Named tees with no stored sellAs or packSize. The title still says Pack of 25. */
const PACK_OF_25 = [
  "100807.040",
  "100807.200",
  "100807.250",
  "100807.400",
  "100807.600",
  "100807.700",
] as const;

let failed = 0;

function fail(message: string) {
  failed += 1;
  console.error(`FAIL ${message}`);
}

function same(actual: unknown, expected: unknown, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(message);
  }
}

function sizeNames(product: Product): string[] {
  if (product.sizeOptions?.length) return product.sizeOptions;
  return (product.sizes ?? []).map((row) => row.size);
}

/** The count the product page printed before this field existed. */
function legacyAssortmentCount(product: Product): number | null {
  const info = getAssortment(product);
  if (!info || info.kind !== "assortment") return null;
  const lines = surtidoPackLines(product);
  const curvePairs =
    lines.length > 0 && lines.every((line) => line.pairs && line.pairs === lines[0]?.pairs)
      ? lines[0]?.pairs
      : null;
  if (curvePairs && curvePairs > 1) return curvePairs;
  if (info.packSize && info.packSize > 1) return info.packSize;
  return null;
}

function legacyOtherCount(product: Product): number | null {
  const info = getAssortment(product);
  if (!info || info.kind === "assortment") return null;
  if (info.packSize && info.packSize > 1) return info.packSize;
  return null;
}

function numbersIn(text: string): number[] {
  return [...text.matchAll(/\d+/g)].map((match) => Number(match[0]));
}

function containsPrice(value: unknown): boolean {
  return JSON.stringify(value).includes("N$");
}

type Issue = { code: string; detail: string };

function siteIssues(product: Product, view: ClientAssortment): Issue[] {
  const issues: Issue[] = [];
  const code = product.code;
  const lines = surtidoPackLines(product);
  const price = product.price || product.unitPrice || 0;
  const push = (detail: string) => issues.push({ code, detail });

  if (view.isPack && !view.label) push("pack flag is set and the badge label is empty");

  if (view.kind === "assortment" && view.label && !/assortment/i.test(view.label)) {
    push(`kind assortment but badge is "${view.label}"`);
  }
  if (view.kind === "multipack" && view.label && !/multipack/i.test(view.label)) {
    push(`kind multipack but badge is "${view.label}"`);
  }
  if ((view.kind === "pack" || view.kind === "named") && view.label && !/\bpack\b/i.test(view.label)) {
    push(`kind ${view.kind} but badge is "${view.label}"`);
  }
  if (view.kind === "wholesale-pack" && view.label && !/wholesale/i.test(view.label)) {
    push(`kind wholesale-pack but badge is "${view.label}"`);
  }

  if (view.label && view.pairCount != null) {
    const nums = numbersIn(view.label);
    if (nums.length > 0 && !nums.includes(view.pairCount)) {
      push(`badge "${view.label}" does not include pairCount ${view.pairCount}`);
    }
  }
  if (view.titleSuffix && view.pairCount != null) {
    const nums = numbersIn(view.titleSuffix);
    if (nums.length > 0 && !nums.includes(view.pairCount)) {
      push(`title "${view.titleSuffix}" does not include pairCount ${view.pairCount}`);
    }
  }

  const texts = [view.label, view.titleSuffix, ...view.sizes.map((row) => row.label)];
  for (const text of texts) {
    if (!text) continue;
    if (/\bpairs\b/i.test(text) && !isFootwearSku(product)) {
      push(`label "${text}" says pairs on a non-footwear product`);
    }
    if (/\bpcs\b/i.test(text) && isFootwearSku(product)) {
      push(`label "${text}" says pcs on footwear`);
    }
  }

  if (lines.length > 0) {
    const distinct = [...new Set(lines.map((line) => (line.pairs == null ? "blank" : String(line.pairs))))];
    if (distinct.length > 1) {
      const shown = lines.map((line) => `${line.code}=${line.pairs ?? "blank"}`).join(", ");
      push(
        `curve lines disagree (${shown}); page count is ${view.pairCount ?? "blank"}; stored packSize is ${product.packSize ?? "blank"}`,
      );
    } else if (lines[0]?.pairs && lines[0].pairs > 1 && product.packSize != null && product.packSize !== lines[0].pairs) {
      push(
        `stored packSize ${product.packSize} but the curve line shows ${lines[0].pairs} (${lines.map((line) => line.code).join("/")})`,
      );
    } else if ((product.packSize == null || product.packSize === 0) && lines[0]?.pairs && lines[0].pairs > 1 && view.pairCount === lines[0].pairs) {
      push(`stored packSize is blank while the page prints ${lines[0].pairs} from the curve`);
    }
  }

  const curveBox = surtidoCurveSizes(product);
  if (curveBox && (isBallSku(product) || isApparelSku(product) || isHeadwearSku(product))) {
    push("footwear curve table applied to a ball, headwear, or apparel product");
  }
  if (!curveBox) {
    for (const row of view.sizes) {
      if (row.pairCount != null && view.pairCount != null && row.pairCount !== view.pairCount) {
        push(
          `size ${row.size} is labeled "${row.label}" but the page count is ${view.pairCount}`,
        );
      } else if (row.label) {
        push(
          `size ${row.size} is labeled "${row.label}" although this is not a footwear curve box; page count is ${view.pairCount ?? "blank"}`,
        );
      }
    }
  }

  if (!view.isPack && isHeadwearSku(product) && price >= WHOLESALE_HEADWEAR_THRESHOLD_NAD) {
    push(`headwear price ${price} is at the wholesale threshold and is not flagged as a pack`);
  }
  if (!view.isPack && isBallSku(product) && price >= WHOLESALE_BALL_THRESHOLD_NAD) {
    push(`ball price ${price} is at the wholesale threshold and is not flagged as a pack`);
  }

  return issues;
}

function checkProduct(product: Product) {
  const view = clientAssortment(product);
  const client = toClientProduct(product);
  same(client.assortment, view, `${product.code} API assortment !== clientAssortment()`);
  if (client.price !== product.price || client.unitPrice !== product.unitPrice) {
    fail(`${product.code} price changed`);
  }
  if (client.imageUrl !== versionProductImages(product).imageUrl) {
    fail(`${product.code} imageUrl changed`);
  }
  const siteCard = listingCardCandidates(product)[0] || null;
  const expectedCard = cardImageUrl(product);
  const first = productCardImageCandidates(product)[0] ?? "";
  if (client.cardImage !== expectedCard) {
    fail(`${product.code} cardImage !== cardImageUrl()`);
  }
  if (expectedCard) {
    if (!/^https:\/\//i.test(expectedCard)) {
      fail(`${product.code} cardImage is not an absolute https URL`);
    }
    const resolved = first.startsWith("/") ? metaAbsoluteUrl(first) : first;
    if (expectedCard !== resolved) {
      fail(`${product.code} cardImage is not the first card candidate`);
    }
  }
  if (siteCard) {
    const siteAbsolute = siteCard.startsWith("/") ? metaAbsoluteUrl(siteCard) : siteCard;
    if (
      /^https:\/\//i.test(siteAbsolute) &&
      isAllowedProductImageUrl(siteAbsolute) &&
      client.cardImage !== siteAbsolute
    ) {
      fail(`${product.code} cardImage !== site card candidate`);
    }
  }
  if (client.cardImage !== null && !isAllowedProductImageUrl(client.cardImage)) {
    fail(`${product.code} cardImage host is not allowed`);
  }
  const again = toClientProduct(client);
  if (again.cardImage !== client.cardImage || again.imageUrl !== client.imageUrl) {
    fail(`${product.code} cardImage is not stable`);
  }
  if (client.packSize !== product.packSize || client.sellAs !== product.sellAs) {
    fail(`${product.code} packSize or sellAs changed`);
  }
  if (containsPrice(client.assortment)) fail(`${product.code} assortment includes a price`);
  const blob = JSON.stringify(client.assortment);
  if (blob.includes(BRAND)) fail(`${product.code} assortment label includes a brand name`);
  if (blob.includes(EM_DASH)) fail(`${product.code} assortment label includes an em dash`);

  const copy = assortmentCopy(product, en, formatPrice);
  const badge = copy?.label ?? getAssortment(product)?.label ?? null;
  if ((badge ?? null) !== (view.label ?? null)) {
    fail(`${product.code} badge "${badge}" !== API label "${view.label}"`);
  }
  const title = packTitleSuffix(product, en);
  if ((title ?? null) !== (view.titleSuffix ?? null)) {
    fail(`${product.code} title suffix "${title}" !== API "${view.titleSuffix}"`);
  }

  const info = getAssortment(product);
  if (info?.kind === "assortment" && view.pairCount !== legacyAssortmentCount(product)) {
    fail(`${product.code} pairCount ${view.pairCount} !== page count ${legacyAssortmentCount(product)}`);
  }
  if (info && info.kind !== "assortment" && view.pairCount !== legacyOtherCount(product)) {
    fail(`${product.code} pairCount ${view.pairCount} !== pack size ${legacyOtherCount(product)}`);
  }
  if (!info && (view.isPack || view.label || view.pairCount != null)) {
    fail(`${product.code} UI has no assortment but API field is set`);
  }

  const rows = new Map(view.sizes.map((row) => [row.size, row]));
  for (const size of sizeNames(product)) {
    const expected = surtidoSizeLabel(product, size, en);
    const row = rows.get(size) ?? null;
    if ((expected ?? null) !== (row?.label ?? null)) {
      fail(`${product.code} size ${size} label "${expected}" !== API "${row?.label}"`);
    }
    if (row && row.split !== curveSplitText(row.labelParams?.code ? String(row.labelParams.code) : size)) {
      fail(`${product.code} size ${size} split mismatch`);
    }
    if (!expected && row) fail(`${product.code} size ${size} is on the API but the UI has no label`);
  }

  if (view.labelKey === "product.assortment" && !view.labelParams?.code) {
    const localized = renderAssortmentLabel(view.labelKey, view.labelParams, fr, view.label);
    if (localized === view.label) fail(`${product.code} French badge did not change`);
  }
}

function photos(product: Product) {
  return product.images?.length ?? 0;
}

/**
 * These six rows store no sellAs and no packSize. The product title still
 * appends "Pack of 25" through packTitleSuffix, which reads clientAssortment.
 */
function assertPackOf25(products: Product[]) {
  for (const code of PACK_OF_25) {
    const product = products.find((row) => row.code === code);
    if (!product) {
      fail(`missing explicit pack case ${code}`);
      continue;
    }
    if (product.sellAs) fail(`${code} stores sellAs ${product.sellAs}`);
    if (product.packSize != null) fail(`${code} stores packSize ${product.packSize}`);

    const info = getAssortment(product);
    const view = clientAssortment(product);
    const client = toClientProduct(product);
    const suffix = packTitleSuffix(product, en);
    const phrase = renderAssortmentLabel(view.titleKey, view.titleParams, en, null);
    const badge = renderAssortmentLabel(view.labelKey, view.labelParams, en, view.label);
    const title = (product.displayName || product.item) + (suffix ?? "");
    const description = productDescription(product, { t: en });

    if (phrase !== "Pack of 25") fail(`${code} title phrase is "${phrase}"`);
    if (suffix !== " · Pack of 25") fail(`${code} title suffix is "${suffix}"`);
    if (view.titleSuffix !== suffix || client.assortment.titleSuffix !== suffix) {
      fail(`${code} API titleSuffix is not the site title suffix`);
    }
    if (!title.includes("Pack of 25")) fail(`${code} product title does not show Pack of 25`);
    if (!/pack of 25/i.test(description)) fail(`${code} description does not say pack of 25`);
    if (badge !== "Pack · 25 pcs") fail(`${code} badge is "${badge}"`);
    if (badge !== view.label || client.assortment.label !== view.label) {
      fail(`${code} API badge is not the site badge`);
    }
    if (!view.isPack || !client.assortment.isPack) fail(`${code} isPack is false`);
    if (view.pairCount !== 25 || client.assortment.pairCount !== 25) {
      fail(`${code} pack size is ${view.pairCount}`);
    }
    if (info?.packSize !== 25) fail(`${code} getAssortment pack size is ${info?.packSize ?? "blank"}`);
    if (view.titleParams?.n !== 25) fail(`${code} title param is ${String(view.titleParams?.n)}`);
    if (!JSON.stringify(client.assortment).includes("Pack of 25")) {
      fail(`${code} assortment field does not include Pack of 25`);
    }
  }
}

function assertAbsoluteCardImages(products: Product[]) {
  let absoluteCards = 0;
  for (const product of products) {
    const card = toClientProduct(product).cardImage;
    if (!card) continue;
    absoluteCards += 1;
    if (!/^https:\/\//i.test(card)) fail(`${product.code} cardImage is not absolute https`);
    if (!isAllowedProductImageUrl(card)) fail(`${product.code} cardImage host is not allowed`);
  }
  if (absoluteCards < 40) fail(`expected absolute cardImage on at least 40 products, found ${absoluteCards}`);
  console.log(`absolute cardImage ${absoluteCards}`);

  const lime = products.find((row) => row.code === "100807.400");
  const photo = "/catalog-photos/100807.400.jpg";
  const expected = metaAbsoluteUrl(photo);
  if (!lime) {
    fail("missing 100807.400");
    return;
  }
  if (productCardImageCandidates(lime)[0] !== photo) {
    fail(`100807.400 first photo is ${productCardImageCandidates(lime)[0] ?? "blank"}`);
  }
  const card = toClientProduct(lime).cardImage;
  if (card !== expected) fail(`100807.400 cardImage ${card} !== ${expected}`);
  if (!expected.startsWith("https://")) fail("100807.400 resolved photo is not https");
  if (new URL(expected).hostname !== new URL(metaSiteUrl()).hostname) {
    fail("100807.400 cardImage host is not the canonical site origin");
  }
  if (listingCardCandidates(lime)[0] !== photo) {
    fail("100807.400 site card no longer uses the catalogue photo path");
  }

  const remote = cardImageUrl({ imageUrl: "https://wsrv.nl/photo.jpg", images: [] });
  if (remote !== "https://wsrv.nl/photo.jpg") fail("allowed remote card image was rewritten");
  if (cardImageUrl({ imageUrl: "https://example.com/a.jpg", images: [] }) !== null) {
    fail("cardImage returned a host that is not allowed");
  }
  if (cardImageUrl({ imageUrl: "http://wsrv.nl/photo.jpg", images: [] }) !== null) {
    fail("cardImage returned an http URL");
  }
  if (cardImageUrl({ imageUrl: "//wsrv.nl/photo.jpg", images: [] }) !== null) {
    fail("cardImage returned a protocol-relative URL");
  }
}

function take(products: Product[], count: number, pred: (product: Product) => boolean) {
  const found: Product[] = [];
  for (const product of products) {
    if (!pred(product)) continue;
    found.push(product);
    if (found.length >= count) break;
  }
  return found;
}

function allowServerOnlyAlias() {
  const stub = join(dirname(fileURLToPath(import.meta.url)), "shims", "server-only.cjs");
  const nodeModule = Module as unknown as {
    _resolveFilename: (
      request: string,
      parent: NodeModule | null | undefined,
      isMain: boolean,
      options?: { paths?: string[] },
    ) => string;
  };
  const original = nodeModule._resolveFilename;
  nodeModule._resolveFilename = function (request, parent, isMain, options) {
    if (request === "server-only") return stub;
    return original.call(this, request, parent, isMain, options);
  };
}

async function loadCatalog(): Promise<{ products: Product[]; source: string }> {
  allowServerOnlyAlias();
  try {
    const { getCatalogLive } = await import("../lib/supabase/catalog");
    const products = await getCatalogLive();
    if (products.length >= 40) return { products, source: "getCatalogLive" };
    console.warn(`live catalogue returned ${products.length} rows; using the offline catalogue`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`getCatalogLive unavailable (${message})`);
  }
  try {
    const { getOfflineCatalog } = await import("../lib/offline-catalog");
    const products = await getOfflineCatalog();
    if (products.length >= 40) {
      return { products, source: "getOfflineCatalog" };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`offline catalogue unavailable (${message}); using data/products.json`);
  }
  const bundled = (await import("../data/products.json")).default as Product[];
  return { products: bundled, source: "data/products.json" };
}

async function main() {
  const { products, source } = await loadCatalog();
  console.log(`source ${source}`);
  console.log(`products ${products.length}`);

  const packs = take(products, 10, (product) => clientAssortment(product).isPack);
  const headwear = take(
    products,
    5,
    (product) =>
      isHeadwearSku(product) && (product.price || product.unitPrice || 0) >= WHOLESALE_HEADWEAR_THRESHOLD_NAD,
  );
  const balls = take(
    products,
    5,
    (product) => isBallSku(product) && (product.price || product.unitPrice || 0) >= WHOLESALE_BALL_THRESHOLD_NAD,
  );
  const apparel = take(products, 10, (product) => isApparelSku(product) && photos(product) >= 3);
  const footwear = take(products, 10, (product) => isFootwearSku(product) && photos(product) >= 3);
  const sample = new Map<string, Product>();
  for (const product of [...packs, ...headwear, ...balls, ...apparel, ...footwear]) {
    sample.set(product.code, product);
  }
  for (const code of PACK_OF_25) {
    const product = products.find((row) => row.code === code);
    if (product) sample.set(product.code, product);
  }
  assertPackOf25(products);
  assertAbsoluteCardImages(products);

  console.log(
    `sample ${sample.size} (packs ${packs.length}, headwear ${headwear.length}, balls ${balls.length}, apparel photos ${apparel.length}, footwear photos ${footwear.length})`,
  );
  if (packs.length < 10) fail(`expected at least 10 packs, found ${packs.length}`);
  if (headwear.length < 5) fail(`expected at least 5 headwear rows at the wholesale threshold, found ${headwear.length}`);
  if (balls.length < 5) fail(`expected at least 5 ball rows at the wholesale threshold, found ${balls.length}`);
  if (apparel.length < 10) fail(`expected at least 10 apparel rows with several photos, found ${apparel.length}`);
  if (footwear.length < 10) fail(`expected at least 10 footwear rows with several photos, found ${footwear.length}`);
  if (sample.size < 40) fail(`expected a sample of at least 40 products, found ${sample.size}`);
  const withCard = products.filter((product) => cardImageUrl(product)).length;
  if (withCard < 40) fail(`expected card images on at least 40 products, found ${withCard}`);

  for (const cat of ["shoes", "sportswear"] as const) {
    const listing = buildListing(products, { cat });
    const rows = filterListing(products, { cat });
    if (listing.total !== rows.length) fail(`${cat} total ${listing.total} !== filtered ${rows.length}`);
    const pageCount = Math.max(1, Math.ceil(rows.length / listing.pageSize));
    if (listing.pageCount !== pageCount) fail(`${cat} pageCount drifted`);
    if (rows.some((product) => product.available === false || product.code === "DPO-TEST")) {
      fail(`${cat} listing still contains an unavailable or test product`);
    }
    console.log(`${cat} total ${listing.total} pageCount ${listing.pageCount}`);
  }
  const trail = filterListing(products, { cat: "shoes", group: "running-trail" });
  if (trail.some((product) => product.available === false || product.code === "DPO-TEST")) {
    fail("shoes running-trail still lists an unavailable product");
  }
  console.log(`shoes running-trail ${trail.length}`);

  const issues: Issue[] = [];
  for (const product of products) {
    checkProduct(product);
    if (failed > 25) {
      fail("too many parity failures; stopping");
      break;
    }
    issues.push(...siteIssues(product, clientAssortment(product)));
  }

  const byDetail = new Map<string, string[]>();
  for (const issue of issues) {
    const codes = byDetail.get(issue.detail) ?? [];
    codes.push(issue.code);
    byDetail.set(issue.detail, codes);
  }
  console.log(`site inconsistencies ${issues.length}`);
  const grouped = [...byDetail.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [detail, codes] of grouped) {
    console.log(`ISSUE ${codes.length} ${detail}`);
    console.log(codes.join(", "));
  }

  if (failed > 0) {
    console.error(`parity failed (${failed})`);
    process.exit(1);
  }
  console.log("parity ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
