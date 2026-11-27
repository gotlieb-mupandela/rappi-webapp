export const BLACK_FRIDAY_PATH = "/black-friday";
export const BLACK_FRIDAY_STARTS_AT = Date.parse("2026-11-26T00:00:00+02:00");
export const BLACK_FRIDAY_ENDS_AT = Date.parse("2026-12-16T00:00:00+02:00");
export const BLACK_FRIDAY_DATES = "Fri 27 Nov – 15 Dec";

export function isBlackFridayLive(now = Date.now()) {
  return now >= BLACK_FRIDAY_STARTS_AT && now < BLACK_FRIDAY_ENDS_AT;
}

export type DealGroup = "shoes" | "swim" | "clothing" | "kids" | "teams" | "equipment";
export type DealKind = "gift" | "discount";

export type BlackFridayDeal = {
  code: string;
  title: string;
  label: string;
  offer: string;
  kind: DealKind;
  gift?: string;
  group: DealGroup;
};

/** Image files live in /public/black-friday, named by product code with dots as dashes. */
export function dealImage(code: string) {
  return `/black-friday/${code.replace(/\./g, "-")}.webp`;
}

export const BLACK_FRIDAY_DEALS: BlackFridayDeal[] = [
  { code: "PSTROW2617", title: "Stroke Men padel shoes", label: "Free gift", offer: "Free wristband or overgrip", kind: "gift", gift: "400300.P03", group: "shoes" },
  { code: "ECUW2511FG", title: "Evolution Top boots", label: "Free gift", offer: "Free boot bag", kind: "gift", gift: "400001.100", group: "shoes" },
  { code: "RR200W2672", title: "R.2000 running shoes", label: "Free gift", offer: "Free sun cap", kind: "gift", gift: "400089.100", group: "shoes" },
  { code: "101353.100", title: "Trail running shorts", label: "Free gift", offer: "Free ankle socks", kind: "gift", gift: "400028.P01", group: "clothing" },
  { code: "WSCHOW2602V", title: "W.School Jr kids' shoes", label: "Free gift", offer: "Free socks", kind: "gift", gift: "400028.P01", group: "kids" },
  { code: "TKTR9S2601", title: "TR-9 trail shoes", label: "Free gift", offer: "Free sports socks", kind: "gift", gift: "400392.200", group: "shoes" },
  { code: "C500LW2302V", title: "500 Lady sneakers", label: "Free gift", offer: "Free ankle socks", kind: "gift", gift: "400028.P01", group: "shoes" },
  { code: "103124.021", title: "Phoenix III team kit", label: "Free gift", offer: "10 free bibs on team orders over N$5,500", kind: "gift", gift: "101686.010", group: "teams" },
  { code: "105135.601", title: "Heroic T-shirt", label: "Save 10%", offer: "Buy 2 tees, tanks or shorts", kind: "discount", group: "clothing" },
  { code: "104142.100", title: "Shark swim boxer", label: "Save 10%", offer: "Buy 2 swimwear items", kind: "discount", group: "swim" },
  { code: "401984.104", title: "Sport sunglasses", label: "Free gift", offer: "Free cap when you spend N$800 on summer gear", kind: "gift", gift: "400089.200", group: "clothing" },
  { code: "902448.745", title: "Hydro swimsuit", label: "Free gift", offer: "Free towel on swimwear over N$1,300", kind: "gift", gift: "400922.353", group: "swim" },
  { code: "104145.100", title: "Splash swim shorts", label: "Free gift", offer: "Free cap on swimwear over N$900", kind: "gift", gift: "400089.200", group: "swim" },
  { code: "902268.600", title: "Shark III swimsuit", label: "Save 10%", offer: "Buy 2 swimwear items", kind: "discount", group: "swim" },
  { code: "103245.700", title: "Olimpiada T-shirt", label: "Save 10%", offer: "Buy 2 tees, tanks or shorts", kind: "discount", group: "clothing" },
  { code: "102222.725", title: "Record II tank top", label: "3 for N$400", offer: "Any 3 Record II tank tops, mix colours and sizes", kind: "discount", group: "clothing" },
  { code: "PSTROLW2601", title: "Stroke Lady padel shoes", label: "Free gift", offer: "Free wristband or overgrip", kind: "gift", gift: "400300.P03", group: "shoes" },
  { code: "VBLOKW2601", title: "Block Low volleyball shoes", label: "Free gift", offer: "Free wristband", kind: "gift", gift: "400300.P03", group: "shoes" },
  { code: "902073.200", title: "Torneo skirt", label: "Save 10%", offer: "Skirt with a tank top or tee", kind: "discount", group: "clothing" },
  { code: "SCOSTS2503", title: "S.Costa pool slides", label: "Save 10%", offer: "Slides with any swimwear", kind: "discount", group: "swim" },
];

export const BANNER_DEALS: { code: string; tag: string }[] = [
  { code: "PSTROW2617", tag: "Free gift" },
  { code: "ECUW2511FG", tag: "Free bag" },
  { code: "902268.600", tag: "-10%" },
  { code: "102222.725", tag: "3 for 400" },
  { code: "RR200W2672", tag: "Free cap" },
  { code: "401984.104", tag: "Free cap" },
];

type Classifiable = { code: string; name?: string; category: string; subcategory: string; price: number };

const key = (p: Classifiable) => `${p.category}/${p.subcategory}`;
const isRacketShoe = (p: Classifiable) => /\/(tennis|padel|pickleball)-shoes$/.test(key(p));
const isBoot = (p: Classifiable) =>
  /^football\/(football-fg|football-ag|football-sg|turf|futsal|boots)$|^shoes\/(futsal|boots)$/.test(key(p));
const isRunningShoe = (p: Classifiable) => /\/running-shoes$/.test(key(p));
const isRunningWear = (p: Classifiable) => /^running-fitness\/(tees|tops|shorts|skirts|bras)$/.test(key(p));
const isKidsShoe = (p: Classifiable) => /\/kids-shoes$/.test(key(p));
const isTrailShoe = (p: Classifiable) => /^(shoes|hiking)\/(trail-running|outdoor-shoes)$/.test(key(p));
const isSneaker = (p: Classifiable) => /^shoes\/(sneakers|comfort-shoes|barefoot)$/.test(key(p));
const isVolleyballShoe = (p: Classifiable) => /\/volleyball-shoes$/.test(key(p));
const isTeamKit = (p: Classifiable) => /^(football|sportswear|teampro-2026|basketball)\/sets$/.test(key(p));
const isSwimwear = (p: Classifiable) => /^swimming\/(swimwear|shorts)$/.test(key(p));
const isSlide = (p: Classifiable) => /^shoes\/(sandals|summer-shoes)$/.test(key(p));
const isSunglasses = (p: Classifiable) => /SUNGLASS/i.test(p.name ?? "");
const isTank = (p: Classifiable) => /TANK TOP|SLEEVELESS/i.test(p.name ?? "");
const isRecordTank = (p: Classifiable) => /TANK TOP RECORD II/i.test(p.name ?? "");
const isTop = (p: Classifiable) => /\/(tees|tops|tees-kids)$/.test(key(p)) || isTank(p);
const isShorts = (p: Classifiable) => /\/shorts$/.test(key(p)) && !isSwimwear(p);
const isSkirt = (p: Classifiable) => /\/skirts$/.test(key(p));
const isCap = (p: Classifiable) => /\/caps$/.test(key(p)) && p.category !== "swimming";
const isPickleballPaddle = (p: Classifiable) => key(p) === "balls-bags/rackets" && /PICKLEBALL/i.test(p.name ?? "");
const isPadelRacket = (p: Classifiable) => key(p) === "padel/rackets";
const isGkGloves = (p: Classifiable) => /\/gk-gloves$/.test(key(p));
const isBall = (p: Classifiable) => /\/balls$/.test(key(p));
const isSportsBag = (p: Classifiable) => /^(balls-bags|padel)\/bags$/.test(key(p));
const isTracksuit = (p: Classifiable) => /\/tracksuits$/.test(key(p));
const isJacket = (p: Classifiable) => /\/jackets$/.test(key(p));
const isHoodie = (p: Classifiable) => /\/hoodies$/.test(key(p));
const isPants = (p: Classifiable) => /\/pants$/.test(key(p));
const isCourtShoe = (p: Classifiable) => /\/(basketball|handball|hockey)-shoes$/.test(key(p));
const isTrainingShoe = (p: Classifiable) => /\/training-shoes$/.test(key(p));
const isPolo = (p: Classifiable) => /\/polos$/.test(key(p));
const isLegging = (p: Classifiable) => /\/(leggings|tights)$/.test(key(p));
/** Everyday clothing for "buy 2, save 10%". Record II tanks have their own 3-for-N$400 deal. */
const isKit = (p: Classifiable) => (isTop(p) || isShorts(p) || isPolo(p) || isLegging(p)) && !isRecordTank(p);
const isSummerGear = (p: Classifiable) =>
  isSwimwear(p) || isSlide(p) || isSunglasses(p) || isCap(p) || isTop(p) || isShorts(p) || isSkirt(p);

/** The deal shown on a single product page, if the product qualifies. */
export function productDeal(p: Classifiable): { title: string; detail: string; gift?: string } | null {
  if (isRacketShoe(p) && p.price >= 430)
    return p.price >= 790
      ? { title: "Free wristband or overgrip", detail: "Your choice, one gift per pair", gift: "400300.P03" }
      : { title: "Free wristband with these shoes", detail: "One wristband per pair", gift: "400300.P03" };
  if (isBoot(p) && p.price >= 530) return { title: "Free boot bag with these boots", detail: "One bag per pair", gift: "400001.100" };
  if (isRunningShoe(p) && p.price >= 790) return { title: "Free cap with these shoes", detail: "One cap per pair", gift: "400089.100" };
  if (isRunningWear(p) && p.price >= 240) return { title: "Free ankle socks", detail: "One pair per item", gift: "400028.P01" };
  if (isKidsShoe(p) && p.price >= 260) return { title: "Free socks with these shoes", detail: "One pair per pair of shoes", gift: "400028.P01" };
  if (isTrailShoe(p)) return { title: "Free sports socks with these shoes", detail: "One pair per pair of shoes", gift: "400392.200" };
  if (isSneaker(p) && p.price >= 240) return { title: "Free ankle socks with these shoes", detail: "One pair per pair of shoes", gift: "400028.P01" };
  if (isVolleyballShoe(p) && p.price >= 430) return { title: "Free wristband with these shoes", detail: "One wristband per pair", gift: "400300.P03" };
  if (isCourtShoe(p) && p.price >= 430) return { title: "Free wristband with these shoes", detail: "One wristband per pair", gift: "400300.P03" };
  if (isTrainingShoe(p) && p.price >= 530) return { title: "Free gym sack with these shoes", detail: "One sack per pair", gift: "400379.040" };
  if (isPadelRacket(p) && p.price >= 1310) return { title: "Free padel training set", detail: "Training shirt + shorts with this racket", gift: "103124.021" };
  if (isPickleballPaddle(p) && p.price >= 430) return { title: "Free wristband with this paddle", detail: "One wristband per paddle", gift: "400300.P03" };
  if (isGkGloves(p) && p.price >= 260) return { title: "Free ankle socks with these gloves", detail: "One pair per pair of gloves", gift: "400028.P01" };
  if (isBall(p) && p.price >= 260) return { title: "Free ankle socks with this ball", detail: "One pair per ball", gift: "400028.P01" };
  if (isSportsBag(p) && p.price >= 430) return { title: "Free wristband with this bag", detail: "One wristband per bag", gift: "400300.P03" };
  if (isJacket(p) && p.price >= 790) return { title: "Free cap with this jacket", detail: "One cap per jacket", gift: "400089.100" };
  if (isTracksuit(p) && p.price >= 530) return { title: "Free gym sack with this tracksuit", detail: "One sack per tracksuit", gift: "400379.040" };
  if (isHoodie(p) && p.price >= 260) return { title: "Free ankle socks with this hoodie", detail: "One pair per hoodie", gift: "400028.P01" };
  if (isPants(p) && p.price >= 260) return { title: "Free ankle socks with these pants", detail: "One pair per pair of pants", gift: "400028.P01" };
  if (isTeamKit(p)) return { title: "10 free training bibs", detail: "On team kit orders over N$5,500", gift: "101686.010" };
  if (isSwimwear(p))
    return { title: "Swimwear deals", detail: "Buy 2, save 10% · free cap over N$900 · free towel over N$1,300", gift: "400922.353" };
  if (isSlide(p)) return { title: "Slides + swimwear, save 10%", detail: "Buy pool slides with any swimwear" };
  if (isRecordTank(p)) return { title: "Any 3 Record II tank tops for N$400", detail: "Mix colours and sizes" };
  if (isSkirt(p)) return { title: "Skirt + tank top or tee, save 10%", detail: "Buy them together in one order" };
  if (isKit(p)) return { title: "Buy 2, save 10%", detail: "On tees, tank tops, shorts, polos and leggings" };
  if (isSunglasses(p)) return { title: "Free cap when you spend N$800", detail: "On summer gear in one order", gift: "400089.200" };
  return null;
}

export type OfferLine = Classifiable & { qty: number };

export type BlackFridayGift = {
  /** Catalogue code of the gift item, used for photos on PDFs. */
  code: string;
  name: string;
  qty: number;
  image: string;
  /** Paid item that earned the gift; empty for order-level gifts. */
  forCode?: string;
  reason: string;
};

export type BlackFridayDiscount = { label: string; amount: number };

export type BlackFridayOffer = {
  gifts: BlackFridayGift[];
  discounts: BlackFridayDiscount[];
  /** Money off the merchandise subtotal, rounded to cents. */
  discountTotal: number;
};

const EMPTY_OFFER: BlackFridayOffer = { gifts: [], discounts: [], discountTotal: 0 };

const GIFT = {
  wristband: { code: "400300.P03", name: "Wristband" },
  racket: { code: "400300.P03", name: "Wristband or overgrip (your choice)" },
  bootBag: { code: "400001.100", name: "Boot bag" },
  runCap: { code: "400089.100", name: "Cap" },
  summerCap: { code: "400089.200", name: "Cap" },
  ankleSocks: { code: "400028.P01", name: "Ankle socks (1 pair)" },
  kidsSocks: { code: "400028.P01", name: "Socks (1 pair)" },
  sportSocks: { code: "400392.200", name: "Sports socks (1 pair)" },
  bibs: { code: "101686.010", name: "Set of 10 training bibs" },
  towel: { code: "400922.353", name: "Towel" },
  gymSack: { code: "400379.040", name: "Gym sack" },
  trainingSet: { code: "103124.021", name: "Padel training set (shirt + shorts)" },
} as const;

const cents = (n: number) => Math.round(n * 100) / 100;
const money = (n: number) => `N$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

/**
 * Black Friday gifts and discounts for a set of priced lines. Used by the
 * cart, checkout, the payment amount, the staff note and both PDFs, so every
 * screen and document agrees with what DPO charges.
 */
export function blackFridayOffer(lines: OfferLine[], now = Date.now()): BlackFridayOffer {
  if (!isBlackFridayLive(now) || !lines.length) return EMPTY_OFFER;
  const gifts: BlackFridayGift[] = [];
  const give = (
    g: { code: string; name: string; image?: string },
    qty: number,
    reason: string,
    forCode?: string,
  ) => {
    const prev = gifts.find((x) => x.code === g.code && x.name === g.name && x.forCode === forCode);
    if (prev) prev.qty += qty;
    else gifts.push({ code: g.code, name: g.name, qty, image: dealImage(g.image ?? g.code), forCode, reason });
  };
  const sum = (test: (p: Classifiable) => boolean) =>
    lines.filter(test).reduce((s, l) => s + l.price * l.qty, 0);
  const count = (test: (p: Classifiable) => boolean) =>
    lines.filter(test).reduce((s, l) => s + l.qty, 0);

  for (const l of lines) {
    if (isRacketShoe(l) && l.price >= 790) give(GIFT.racket, l.qty, "With padel / tennis shoes", l.code);
    else if (isRacketShoe(l) && l.price >= 430) give(GIFT.wristband, l.qty, "With padel / tennis shoes", l.code);
    else if (isBoot(l) && l.price >= 530) give(GIFT.bootBag, l.qty, "With football boots", l.code);
    else if (isRunningShoe(l) && l.price >= 790) give(GIFT.runCap, l.qty, "With running shoes", l.code);
    else if (isRunningWear(l) && l.price >= 240) give(GIFT.ankleSocks, l.qty, "With running wear", l.code);
    else if (isKidsShoe(l) && l.price >= 260) give(GIFT.kidsSocks, l.qty, "With kids' shoes", l.code);
    else if (isTrailShoe(l)) give(GIFT.sportSocks, l.qty, "With trail / hiking shoes", l.code);
    else if (isSneaker(l) && l.price >= 240) give(GIFT.ankleSocks, l.qty, "With sneakers", l.code);
    else if (isVolleyballShoe(l) && l.price >= 430) give(GIFT.wristband, l.qty, "With volleyball shoes", l.code);
    else if (isCourtShoe(l) && l.price >= 430) give(GIFT.wristband, l.qty, "With court shoes", l.code);
    else if (isTrainingShoe(l) && l.price >= 530) give(GIFT.gymSack, l.qty, "With training shoes", l.code);
    else if (isPadelRacket(l) && l.price >= 1310) give(GIFT.trainingSet, l.qty, "With a padel racket", l.code);
    else if (isPickleballPaddle(l) && l.price >= 430) give(GIFT.wristband, l.qty, "With a pickleball paddle", l.code);
    else if (isGkGloves(l) && l.price >= 260) give(GIFT.ankleSocks, l.qty, "With goalkeeper gloves", l.code);
    else if (isBall(l) && l.price >= 260) give(GIFT.ankleSocks, l.qty, "With a ball", l.code);
    else if (isSportsBag(l) && l.price >= 430) give(GIFT.wristband, l.qty, "With a sports bag", l.code);
    else if (isJacket(l) && l.price >= 790) give(GIFT.runCap, l.qty, "With a jacket", l.code);
    else if (isTracksuit(l) && l.price >= 530) give(GIFT.gymSack, l.qty, "With a tracksuit", l.code);
    else if (isHoodie(l) && l.price >= 260) give(GIFT.ankleSocks, l.qty, "With a hoodie", l.code);
    else if (isPants(l) && l.price >= 260) give(GIFT.ankleSocks, l.qty, "With pants", l.code);
  }
  if (sum(isTeamKit) > 5500) give(GIFT.bibs, 1, "Team kit order over N$5,500");
  const swim = sum(isSwimwear);
  // One summer gift per order: swimwear gifts take priority over the N$800 summer-gear cap.
  if (swim >= 1300) give(GIFT.towel, 1, "Swimwear over N$1,300");
  else if (swim >= 900) give(GIFT.summerCap, 1, "Swimwear over N$900");
  else if (sum(isSummerGear) >= 800) give(GIFT.summerCap, 1, "Summer gear over N$800");

  const discounts: BlackFridayDiscount[] = [];
  const off = (label: string, amount: number) => {
    const value = cents(amount);
    if (value > 0) discounts.push({ label, amount: value });
  };
  // Each item gets at most one deal: combo deals only discount items not already discounted.
  const swim2 = count(isSwimwear) >= 2;
  if (swim2) off("Buy 2 swimwear, 10% off", swim * 0.1);
  const kit2 = count(isKit) >= 2;
  if (kit2) off("Buy 2 tees, shorts, polos or leggings, 10% off", sum(isKit) * 0.1);
  const tanks = lines.filter(isRecordTank);
  const tankQty = tanks.reduce((s, l) => s + l.qty, 0);
  if (tankQty >= 3) {
    const unit = Math.min(...tanks.map((l) => l.price));
    const sets = Math.floor(tankQty / 3);
    off(`3 Record II tank tops for N$400${sets > 1 ? ` x${sets}` : ""}`, sets * Math.max(0, unit * 3 - 400));
  }
  if (count(isSkirt) && count(isTop)) off("Skirt + top, 10% off", (sum(isSkirt) + (kit2 ? 0 : sum(isTop))) * 0.1);
  if (count(isSlide) && swim) off("Slides + swimwear, 10% off", (sum(isSlide) + (swim2 ? 0 : swim)) * 0.1);

  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const discountTotal = Math.min(cents(subtotal), cents(discounts.reduce((s, d) => s + d.amount, 0)));
  return { gifts, discounts, discountTotal };
}

/** Plain-text note for staff listing the gifts to pack and the discount given. */
export function blackFridayOrderNote(lines: OfferLine[], now = Date.now()) {
  const offer = blackFridayOffer(lines, now);
  if (!offer.gifts.length && !offer.discounts.length) return "";
  const out = ["BLACK FRIDAY"];
  if (offer.gifts.length)
    out.push(
      `Free gifts to pack: ${offer.gifts.map((g) => `${g.qty} x ${g.name}${g.forCode ? ` (with ${g.forCode})` : ""}`).join("; ")}`,
    );
  if (offer.discounts.length)
    out.push(
      `Discount already taken off at checkout: ${offer.discounts.map((d) => `${d.label} -${money(d.amount)}`).join("; ")}`,
    );
  return out.join("\n");
}
