import assert from "node:assert/strict";
import test from "node:test";
import { withBakedGallery } from "../lib/gallery-source";
import { hasUsableProductImage } from "../lib/media";

const photo = (name: string) => `https://cdn.example.test/gallery/${name}.jpg`;

type Fixture = {
  imageUrl: string;
  images: string[];
  price: number;
  unitPrice: number;
  stockQty: number;
  totalQty: number;
  available: boolean;
  sizes: { size: string; stock: number }[];
  sizeOptions: string[];
  title: string;
  name: string;
  displayName: string;
  description: string;
  item: string;
};

function product(images: string[], patch: Partial<Fixture> = {}): Fixture {
  return {
    price: 480,
    unitPrice: 480,
    stockQty: 7,
    totalQty: 7,
    available: true,
    sizes: [
      { size: "M", stock: 3 },
      { size: "L", stock: 4 },
    ],
    sizeOptions: ["M", "L"],
    title: "Live title",
    name: "Live name",
    displayName: "Live display",
    description: "Live description",
    item: "Live item",
    ...patch,
    imageUrl: patch.imageUrl ?? images[0] ?? "",
    images: patch.images ?? images,
  };
}

function bakedCopy(images: string[]): Fixture {
  return product(images, {
    price: 1,
    unitPrice: 1,
    stockQty: 0,
    totalQty: 0,
    available: false,
    sizes: [{ size: "S", stock: 0 }],
    sizeOptions: ["S"],
    title: "Baked title",
    name: "Baked name",
    displayName: "Baked display",
    description: "Baked description",
    item: "Baked item",
  });
}

function assertLiveCommercialFields(actual: Fixture, live: Fixture) {
  assert.equal(actual.price, live.price);
  assert.equal(actual.unitPrice, live.unitPrice);
  assert.equal(actual.stockQty, live.stockQty);
  assert.equal(actual.totalQty, live.totalQty);
  assert.equal(actual.available, live.available);
  assert.deepEqual(actual.sizes, live.sizes);
  assert.deepEqual(actual.sizeOptions, live.sizeOptions);
  assert.equal(actual.title, live.title);
  assert.equal(actual.name, live.name);
  assert.equal(actual.displayName, live.displayName);
  assert.equal(actual.description, live.description);
  assert.equal(actual.item, live.item);
}

function assertHasImageFollowsGallery(actual: { imageUrl: string; images: string[]; hasImage: boolean }) {
  assert.equal(actual.hasImage, hasUsableProductImage(actual));
}

test("code in the bake with a one-image row uses the baked six", () => {
  const live = product([photo("row-only")]);
  const baked = bakedCopy([
    photo("bake-1"),
    photo("bake-2"),
    photo("bake-3"),
    photo("bake-4"),
    photo("bake-5"),
    photo("bake-6"),
  ]);
  const listing = withBakedGallery(live, baked);

  assert.equal(listing.images.length, 6);
  assert.deepEqual(listing.images, baked.images);
  assert.equal(listing.imageUrl, baked.imageUrl);
  assert.notEqual(listing.imageUrl, live.imageUrl);
  assertLiveCommercialFields(listing, live);
  assertHasImageFollowsGallery(listing);
  assert.equal(listing.hasImage, true);
});

test("code in the bake uses five baked images when the row has six", () => {
  const live = product([
    photo("row-1"),
    photo("row-2"),
    photo("row-3"),
    photo("row-4"),
    photo("row-5"),
    photo("row-6"),
  ]);
  const baked = bakedCopy([
    photo("bake-1"),
    photo("bake-2"),
    photo("bake-3"),
    photo("bake-4"),
    photo("bake-5"),
  ]);
  const listing = withBakedGallery(live, baked);

  assert.equal(listing.images.length, 5);
  assert.deepEqual(listing.images, baked.images);
  assert.equal(listing.imageUrl, baked.imageUrl);
  assert.notEqual(listing.images.length, live.images.length);
  assertLiveCommercialFields(listing, live);
  assertHasImageFollowsGallery(listing);
  assert.equal(listing.hasImage, true);
});

test("a code that exists only on the live row keeps that row's images", () => {
  const live = product([photo("row-1"), photo("row-2"), photo("row-3")]);
  const listing = withBakedGallery(live);

  assert.deepEqual(listing.images, live.images);
  assert.equal(listing.imageUrl, live.imageUrl);
  assertLiveCommercialFields(listing, live);
  assertHasImageFollowsGallery(listing);
  assert.equal(listing.hasImage, true);

  const placeholder = product(["/products/only-live/01.webp"]);
  const onlyRow = withBakedGallery(placeholder);
  assert.deepEqual(onlyRow.images, placeholder.images);
  assert.equal(onlyRow.imageUrl, placeholder.imageUrl);
  assertHasImageFollowsGallery(onlyRow);
  assert.equal(onlyRow.hasImage, false);
});

test("hasImage follows the gallery that was chosen, not the other source", () => {
  const rowPlaceholder = product(["/products/changed/01.webp"]);
  const bakedSix = bakedCopy([
    photo("bake-1"),
    photo("bake-2"),
    photo("bake-3"),
    photo("bake-4"),
    photo("bake-5"),
    photo("bake-6"),
  ]);
  assert.equal(hasUsableProductImage(rowPlaceholder), false);
  const fromBake = withBakedGallery(rowPlaceholder, bakedSix);
  assert.equal(fromBake.hasImage, true);
  assert.equal(fromBake.images.length, 6);
  assertHasImageFollowsGallery(fromBake);

  const rowSix = product([
    photo("row-1"),
    photo("row-2"),
    photo("row-3"),
    photo("row-4"),
    photo("row-5"),
    photo("row-6"),
  ]);
  const bakedPlaceholders = bakedCopy([
    "/products/bake/01.webp",
    "/products/bake/02.webp",
    "/products/bake/03.webp",
    "/products/bake/04.webp",
    "/products/bake/05.webp",
  ]);
  assert.equal(hasUsableProductImage(rowSix), true);
  const fromShorterBake = withBakedGallery(rowSix, bakedPlaceholders);
  assert.equal(fromShorterBake.hasImage, false);
  assert.equal(fromShorterBake.images.length, 5);
  assert.deepEqual(fromShorterBake.images, bakedPlaceholders.images);
  assertHasImageFollowsGallery(fromShorterBake);
  assertLiveCommercialFields(fromBake, rowPlaceholder);
  assertLiveCommercialFields(fromShorterBake, rowSix);
});
