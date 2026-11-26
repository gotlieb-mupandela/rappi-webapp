export const BLACK_FRIDAY_PATH = "/black-friday";
export const BLACK_FRIDAY_ENDS_AT = Date.parse("2026-12-16T00:00:00+02:00");
export const BLACK_FRIDAY_DATES = "Fri 27 Nov – 15 Dec";

export function isBlackFridayLive(now = Date.now()) {
  return now < BLACK_FRIDAY_ENDS_AT;
}

export type DealGroup = "shoes" | "swim" | "clothing" | "kids" | "teams";
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
  { code: "104145.100", title: "Splash swim shorts", label: "Free gift", offer: "Free swim cap on swimwear over N$900", kind: "gift", gift: "swimcap-single", group: "swim" },
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
  if (isTeamKit(p)) return { title: "10 free training bibs", detail: "On team kit orders over N$5,500", gift: "101686.010" };
  if (isSwimwear(p))
    return { title: "Swimwear deals", detail: "Buy 2, save 10% · free swim cap over N$900 · free towel over N$1,300", gift: "400922.353" };
  if (isSlide(p)) return { title: "Slides + swimwear, save 10%", detail: "Buy pool slides with any swimwear" };
  if (isRecordTank(p)) return { title: "Any 3 Record II tank tops for N$400", detail: "Mix colours and sizes" };
  if (isSkirt(p)) return { title: "Skirt + tank top or tee, save 10%", detail: "Buy them together in one order" };
  if (isTop(p) || isShorts(p)) return { title: "Buy 2, save 10%", detail: "On T-shirts, tank tops and shorts" };
  if (isSunglasses(p)) return { title: "Free cap when you spend N$800", detail: "On summer gear in one order", gift: "400089.200" };
  return null;
}

type OrderLine = Classifiable & { qty: number };

const money = (n: number) => `N$${Math.round(n).toLocaleString("en-US")}`;

/**
 * Plain-text note for staff listing the Black Friday gifts to pack and the
 * discounts the order qualifies for. Empty when nothing applies.
 */
export function blackFridayOrderNote(lines: OrderLine[], now = Date.now()) {
  if (!isBlackFridayLive(now) || !lines.length) return "";
  const gifts = new Map<string, number>();
  const add = (gift: string, n: number) => gifts.set(gift, (gifts.get(gift) ?? 0) + n);
  const sum = (test: (p: Classifiable) => boolean) =>
    lines.filter(test).reduce((s, l) => s + l.price * l.qty, 0);
  const count = (test: (p: Classifiable) => boolean) =>
    lines.filter(test).reduce((s, l) => s + l.qty, 0);

  for (const l of lines) {
    if (isRacketShoe(l) && l.price >= 790) add("Wristband or overgrip (customer's choice)", l.qty);
    else if (isRacketShoe(l) && l.price >= 430) add("Wristband", l.qty);
    else if (isBoot(l) && l.price >= 530) add("Boot bag", l.qty);
    else if (isRunningShoe(l) && l.price >= 790) add("Cap", l.qty);
    else if (isRunningWear(l) && l.price >= 240) add("Ankle socks (pair)", l.qty);
    else if (isKidsShoe(l) && l.price >= 260) add("Socks (pair)", l.qty);
    else if (isTrailShoe(l)) add("Sports socks (pair)", l.qty);
    else if (isSneaker(l) && l.price >= 240) add("Ankle socks (pair)", l.qty);
    else if (isVolleyballShoe(l) && l.price >= 430) add("Wristband", l.qty);
  }
  if (sum(isTeamKit) > 5500) add("Set of 10 training bibs", 1);
  const swim = sum(isSwimwear);
  if (swim >= 1300) add("Towel", 1);
  else if (swim >= 900) add("Swim cap", 1);
  if (sum(isSummerGear) >= 800) add("Cap (summer gear N$800+)", 1);

  const discounts: string[] = [];
  const tenPct = (label: string, amount: number) => discounts.push(`${label}: 10% = ${money(amount * 0.1)}`);
  // Each item gets at most one 10%: combo deals only add the items not already discounted.
  const swim2 = count(isSwimwear) >= 2;
  if (swim2) tenPct("Buy 2 swimwear", swim);
  const kit = (p: Classifiable) => (isTop(p) || isShorts(p)) && !isRecordTank(p);
  const kit2 = count(kit) >= 2;
  if (kit2) tenPct("Buy 2 tees/tanks/shorts", sum(kit));
  const tanks = lines.filter(isRecordTank);
  const tankQty = tanks.reduce((s, l) => s + l.qty, 0);
  if (tankQty >= 3) {
    const unit = tanks[0].price;
    const sets = Math.floor(tankQty / 3);
    discounts.push(`3 Record II tanks for N$400 x${sets}: save ${money(sets * (unit * 3 - 400))}`);
  }
  if (count(isSkirt) && count(isTop)) tenPct("Skirt + top", sum(isSkirt) + (kit2 ? 0 : sum(isTop)));
  if (count(isSlide) && swim) tenPct("Slides + swimwear", sum(isSlide) + (swim2 ? 0 : swim));

  if (!gifts.size && !discounts.length) return "";
  const out = ["BLACK FRIDAY"];
  if (gifts.size) out.push(`Gifts to pack: ${[...gifts].map(([g, n]) => `${n} x ${g}`).join("; ")}`);
  if (discounts.length) out.push(`Discount owed: ${discounts.join("; ")}`);
  return out.join("\n");
}
