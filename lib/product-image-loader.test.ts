import assert from "node:assert/strict";
import test from "node:test";
import { productImageLoader, usesProductImageLoader } from "@/lib/product-image-loader";

function proxied(src: string) {
  return new URL(productImageLoader({ src, width: 640, quality: 80 }));
}

test("folder tiles go through wsrv from the production origin", () => {
  const url = proxied("/joma-tiles/b53813b6d769.jpg");
  assert.equal(url.hostname, "wsrv.nl");
  assert.equal(
    url.searchParams.get("url"),
    "https://www.rappisportshub.com/joma-tiles/b53813b6d769.jpg",
  );
  assert.equal(url.searchParams.get("w"), "640");
  assert.equal(url.searchParams.get("q"), "80");
});

test("remote photos keep their own URL", () => {
  const src = "https://v1.joma-sport.net/files/photo.jpg";
  assert.equal(proxied(src).searchParams.get("url"), src);
});

test("other local images stay on the default loader", () => {
  assert.equal(usesProductImageLoader("/brand/hub-shoes.png"), false);
  assert.equal(usesProductImageLoader("/joma-tiles-old/a.jpg"), false);
  assert.equal(
    productImageLoader({ src: "/brand/hub-shoes.png", width: 640 }),
    "/brand/hub-shoes.png",
  );
});

test("site loader sends local raster images through wsrv from the production origin", async () => {
  const { default: siteImageLoader } = await import("@/lib/site-image-loader");
  const url = new URL(siteImageLoader({ src: "/brand/hub-shoes.png", width: 640, quality: 75 }));
  assert.equal(url.hostname, "wsrv.nl");
  assert.equal(url.searchParams.get("url"), "https://www.rappisportshub.com/brand/hub-shoes.png");
  assert.equal(siteImageLoader({ src: "/brand/logo.svg", width: 200 }), "/brand/logo.svg");
  assert.equal(siteImageLoader({ src: "data:image/png;base64,AA", width: 10 }), "data:image/png;base64,AA");
  const remote = "https://wzmzwerzbyudcvoiiege.supabase.co/storage/v1/object/public/product-images/a.jpg";
  assert.equal(new URL(siteImageLoader({ src: remote, width: 320 })).searchParams.get("url"), remote);
});
