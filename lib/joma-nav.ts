/** Exact Joma B2B MAN / WOMAN destinations shared by header hover + audience landing. */

export type JomaAudienceLink = { href: string; label: string };

type LandingTileDef = {
  label: string;
  /** i18n key resolving the label at render (falls back to label). */
  labelKey?: string;
  href: string;
  /** Catalog hub used for product-sample cover fallbacks. */
  hub: string;
  /** Preferred local brand cover when available. */
  cover?: string;
  /** Optional case-insensitive name match for product-sample covers. */
  match?: string;
  /** Prefer these name patterns when picking a cover product. */
  prefer?: string;
  /** Drop products matching this pattern from the cover pool. */
  exclude?: string;
  /** Prefer these product ids (first hit with a usable image wins). */
  productIds?: string[];
};

function destinations(audience: "men" | "women") {
  // Woman uses audience-scoped folder keys where Part B differs from Man.
  const w = audience === "women";
  return {
    teamwearPro: `/shop/${audience}?group=teamwear-pro-2026`,
    teamwear: `/shop/${audience}?group=${w ? "teamwear-woman" : "teamwear"}`,
    running: `/shop/${audience}?group=${w ? "running-trail-woman" : "running-trail"}`,
    cycling: `/shop/${audience}?group=cycling`,
    racket: `/shop/${audience}?group=${w ? "racket-sports-woman" : "racket-sports"}`,
    hiking: `/shop/${audience}?group=hiking-outdoor`,
    fitness: `/shop/${audience}?group=${w ? "fitness-gym-woman" : "fitness-gym"}`,
    aguila: `/shop/${audience}?group=aguila-line`,
    resort: `/shop/${audience}?group=resort`,
    lifestyle: `/shop/${audience}?group=${w ? "lifestyle-apparel-woman" : "lifestyle-apparel"}`,
    beachwear: `/shop/${audience}?group=beachwear`,
    brama: `/shop/${audience}?group=${w ? "underwear-brama-woman" : "underwear-brama"}`,
    combat: `/shop/${audience}?group=athletes-combat`,
    elite: `/shop/${audience}?group=elite-club`,
  } as const;
}

/** Man / Woman hover-menu order (live joma-sport.net main-menu). */
export function jomaAudienceLinks(audience: "men" | "women"): JomaAudienceLink[] {
  const d = destinations(audience);
  if (audience === "women") {
    return [
      { label: "Teamwear", href: d.teamwear },
      { label: "Teamwear Pro 2026", href: d.teamwearPro },
      { label: "Running / Trail", href: d.running },
      { label: "Cycling", href: d.cycling },
      { label: "Racket sports", href: d.racket },
      { label: "Fitness / Gym", href: d.fitness },
      { label: "Hiking / Outdoor", href: d.hiking },
      { label: "Lifestyle", href: d.lifestyle },
      { label: "Resort", href: d.resort },
      { label: "Águila Line", href: d.aguila },
      { label: "Beachwear", href: d.beachwear },
      { label: "Underwear / Brama", href: d.brama },
      { label: "Athletes / Combat", href: d.combat },
      { label: "Elite club", href: d.elite },
    ];
  }
  return [
    { label: "Teamwear Pro 2026", href: d.teamwearPro },
    { label: "Teamwear", href: d.teamwear },
    { label: "Running / Trail", href: d.running },
    { label: "Cycling", href: d.cycling },
    { label: "Racket sports", href: d.racket },
    { label: "Hiking / Outdoor", href: d.hiking },
    { label: "Fitness / Gym", href: d.fitness },
    { label: "Águila Line", href: d.aguila },
    { label: "Resort", href: d.resort },
    { label: "Lifestyle", href: d.lifestyle },
    { label: "Beachwear", href: d.beachwear },
    { label: "Underwear / Brama", href: d.brama },
    { label: "Athletes / Combat", href: d.combat },
    { label: "Elite club", href: d.elite },
  ];
}

/** Footwear first-view tiles — matches header Footwear dropdown order. */
export type FootwearLandingTileDef = {
  label: string;
  /** i18n key resolving the label at render (falls back to label). */
  labelKey?: string;
  href: string;
  audience?: AudienceSlugForShoes;
  banner?: string;
  /** i18n key resolving the banner at render (falls back to banner). */
  bannerKey?: string;
  /** Catalog id or code. Resolved with productCardImageUrl. */
  productIds?: string[];
};

type AudienceSlugForShoes = "men" | "women" | "kids";

/** Exact Footwear first-view tiles (Joma B2B: MEN / WOMEN / KIDS / OUTLET). */
export function jomaFootwearLandingTiles(): FootwearLandingTileDef[] {
  return [
    { label: "MEN", labelKey: "tiles.men", href: "/shop/shoes?audience=men", audience: "men" },
    { label: "WOMEN", labelKey: "tiles.women", href: "/shop/shoes?audience=women", audience: "women" },
    { label: "KIDS", labelKey: "tiles.kids", href: "/shop/shoes?audience=kids", audience: "kids" },
    {
      label: "OUTLET",
      labelKey: "tiles.outlet",
      href: "/shop/shoes?group=footwear-outlet",
      productIds: ["FSS2402IN"],
    },
  ];
}

/**
 * Man / Woman first-view tile order (live `#link=1` / `#link=2` landings).
 * Labels are display-ready uppercase; hrefs match `jomaAudienceLinks`.
 */
export function jomaAudienceLandingTiles(audience: "men" | "women"): LandingTileDef[] {
  const d = destinations(audience);
  if (audience === "women") {
    // Same pattern as Man: distinct lifestyle covers on hero tiles only;
    // remaining tiles use women/unisex product samples for that hub (no repeats).
    return [
      {
        label: "TEAMWEAR",
        labelKey: "tiles.teamwear",
        href: d.teamwear,
        hub: "teampro-2026",
        cover: "/brand/audience-women-teamwear.png?v=2",
      },
      {
        label: "TEAMWEAR PRO 2026",
        labelKey: "tiles.teamwearPro",
        href: d.teamwearPro,
        hub: "teampro-2026",
        cover: "/brand/audience-women-jersey-navy.png?v=2",
      },
      {
        label: "RUNNING / TRAILRUNNING",
        labelKey: "tiles.runningTrail",
        href: d.running,
        hub: "running-fitness",
        cover: "/brand/audience-women-field.png?v=2",
      },
      {
        label: "CYCLING",
        labelKey: "tiles.cycling",
        href: d.cycling,
        hub: "sportswear",
        productIds: ["105427-100"],
      },
      { label: "RACKET SPORTS", labelKey: "tiles.racketSports", href: d.racket, hub: "padel" },
      {
        label: "FITNESS / GYM",
        labelKey: "tiles.fitnessGym",
        href: d.fitness,
        hub: "running-fitness",
        productIds: ["102968-008"],
      },
      { label: "HIKING / OUTDOOR", labelKey: "tiles.hikingOutdoor", href: d.hiking, hub: "hiking" },
      {
        label: "LIFESTYLE",
        labelKey: "tiles.lifestyle",
        href: d.lifestyle,
        hub: "lifestyle",
        cover: "/brand/audience-women-lifestyle.png?v=2",
      },
      { label: "Águila Line", href: d.aguila, hub: "football", productIds: ["105681-576"] },
      { label: "RESORT", href: d.resort, hub: "resort", productIds: ["902748-649"] },
      {
        label: "BEACHWEAR",
        labelKey: "tiles.beachwear",
        href: d.beachwear,
        hub: "swimming",
        productIds: ["903276-740"],
      },
      { label: "UNDERWEAR / BRAMA", labelKey: "tiles.underwearBrama", href: d.brama, hub: "brama" },
      { label: "ATHLETES / COMBAT", labelKey: "tiles.athletesCombat", href: d.combat, hub: "boxing" },
      { label: "ELITE CLUB", href: d.elite, hub: "football", productIds: ["104798-200"] },
    ];
  }
  return [
    {
      label: "TEAMWEAR",
      labelKey: "tiles.teamwear",
      href: d.teamwear,
      hub: "teampro-2026",
      productIds: ["104594-102"],
    },
    {
      label: "TEAMWEAR PRO 2026",
      labelKey: "tiles.teamwearPro",
      href: d.teamwearPro,
      hub: "teampro-2026",
      cover: "/brand/hub-teampro-2026.png",
    },
    {
      label: "RUNNING / TRAILRUNNING",
      labelKey: "tiles.runningTrail",
      href: d.running,
      hub: "running-fitness",
      cover: "/brand/hero-athlete.png?v=2",
    },
    {
      label: "CYCLING",
      labelKey: "tiles.cycling",
      href: d.cycling,
      hub: "sportswear",
      productIds: ["103456-112"],
    },
    { label: "RACKET SPORTS", labelKey: "tiles.racketSports", href: d.racket, hub: "padel" },
    { label: "HIKING / OUTDOOR", labelKey: "tiles.hikingOutdoor", href: d.hiking, hub: "hiking" },
    {
      label: "FITNESS / GYM",
      labelKey: "tiles.fitnessGym",
      href: d.fitness,
      hub: "running-fitness",
      productIds: ["102968-008"],
    },
    {
      label: "LIFESTYLE",
      labelKey: "tiles.lifestyle",
      href: d.lifestyle,
      hub: "lifestyle",
      productIds: ["100818-200"],
    },
    { label: "Águila Line", href: d.aguila, hub: "football", productIds: ["105681-003"] },
    { label: "RESORT", href: d.resort, hub: "resort", productIds: ["104657-100"] },
    {
      label: "BEACHWEAR",
      labelKey: "tiles.beachwear",
      href: d.beachwear,
      hub: "swimming",
      productIds: ["105382-585"],
    },
    { label: "UNDERWEAR / BRAMA", labelKey: "tiles.underwearBrama", href: d.brama, hub: "brama" },
    { label: "ATHLETES / COMBAT", labelKey: "tiles.athletesCombat", href: d.combat, hub: "boxing" },
    { label: "ELITE CLUB", href: d.elite, hub: "football", productIds: ["104798-200"] },
  ];
}

/**
 * Children landing tiles — matches header Kids dropdown labels + hrefs.
 * Four equal portrait cards (desktop row / mobile 2×2).
 */
export function jomaKidsLandingTiles(): LandingTileDef[] {
  return [
    {
      label: "1-4 YEARS",
      labelKey: "tiles.kids1to4",
      href: "/shop/kids?age=1-4",
      hub: "sportswear",
      productIds: ["600157-600"],
    },
    {
      label: "6-10 YEARS",
      labelKey: "tiles.kids6to10",
      href: "/shop/kids?age=6-10",
      hub: "lifestyle",
      productIds: ["500948-200"],
    },
    {
      label: "12-14 YEAR OLD BOY",
      labelKey: "tiles.kidsBoy1214",
      href: "/shop/kids?age=12-14&gender=boy",
      hub: "football",
      productIds: ["500947-003"],
    },
    {
      label: "12-14 YEAR OLD GIRL",
      labelKey: "tiles.kidsGirl1214",
      href: "/shop/kids?age=12-14&gender=girl",
      hub: "running-fitness",
      productIds: ["500951-594"],
    },
  ];
}

/** Accessories first-view tiles — matches header Accessories dropdown order (incl. duplicate Socks). */
export type AccessoriesLandingTileDef = {
  label: string;
  /** i18n key resolving the label at render (falls back to label). */
  labelKey?: string;
  href: string;
  /** Catalog hub used for product-sample cover fallbacks. */
  hub?: string;
  /** Prefer products with this subcategory when sampling. */
  sub?: string;
  /** Preferred local brand cover when available. */
  cover?: string;
  /** Catalog id or code. Resolved with productCardImageUrl. */
  productIds?: string[];
};

/**
 * Accessories first-view tiles — Part B order/labels, every tile folder-backed
 * (`acc-*` keys in lib/joma-tree.ts). Covers keep the previous hub sampling.
 */
export function jomaAccessoriesLandingTiles(): AccessoriesLandingTileDef[] {
  return [
    {
      label: "Balls",
      labelKey: "tiles.balls",
      href: "/shop/balls-bags?group=acc-balls",
      hub: "balls-bags",
      sub: "balls",
    },
    {
      label: "Gloves portero",
      labelKey: "tiles.glovesPortero",
      href: "/shop/football?group=acc-gloves-portero",
      hub: "football",
      sub: "gk-gloves",
    },
    {
      label: "Backpacks",
      labelKey: "tiles.backpacks",
      href: "/shop/balls-bags?group=acc-backpacks",
      hub: "balls-bags",
      sub: "bags",
    },
    {
      label: "Medias",
      labelKey: "tiles.medias",
      href: "/shop/balls-bags?group=acc-medias",
      hub: "balls-bags",
      productIds: ["400022-100"],
    },
    {
      label: "Socks",
      labelKey: "tiles.socks",
      href: "/shop/sportswear?group=acc-socks",
      hub: "balls-bags",
      sub: "socks",
    },
    {
      label: "Accessories teamwear",
      labelKey: "tiles.accTeamwear",
      href: "/shop/sportswear?group=acc-teamwear",
      hub: "teampro-2026",
      productIds: ["400024-100"],
    },
    {
      label: "Accessories running",
      labelKey: "tiles.accRunning",
      href: "/shop/running-fitness?group=acc-running",
      hub: "running-fitness",
      sub: "accessories",
      cover: "/brand/hero-athlete.png?v=2",
    },
    {
      label: "Accessories of Racket",
      labelKey: "tiles.accRacket",
      href: "/shop/sportswear?group=acc-racket",
      hub: "balls-bags",
      sub: "rackets",
      productIds: ["401845-100"],
    },
    {
      label: "Palas of pádel",
      labelKey: "tiles.palasPadel",
      href: "/shop/padel?group=acc-palas-padel",
      hub: "padel",
      sub: "rackets",
    },
    {
      label: "Palas of Pickleball",
      labelKey: "tiles.palasPickleball",
      href: "/shop/balls-bags?group=acc-palas-pickleball",
      hub: "balls-bags",
      sub: "rackets",
    },
    {
      label: "Accessories Outdoor",
      labelKey: "tiles.accOutdoor",
      href: "/shop/hiking?group=acc-outdoor",
      hub: "hiking",
      productIds: ["401970-477"],
    },
    {
      label: "Accessories Fitness / Gym",
      labelKey: "tiles.accFitnessGym",
      href: "/shop/running-fitness?group=acc-fitness-gym",
      hub: "running-fitness",
      cover: "/brand/hero-athlete.png?v=2",
    },
    {
      label: "Accessories tiendas",
      labelKey: "tiles.accTiendas",
      href: "/shop/balls-bags?group=acc-tiendas",
      productIds: ["JOM-019"],
    },
    {
      label: "Teamwear Catalogue",
      labelKey: "tiles.teamwearCatalogue",
      href: "/shop/teampro-2026?group=acc-teamwear-catalogue",
      hub: "teampro-2026",
      cover: "/brand/hub-teampro-2026.png",
    },
  ];
}

/**
 * Shared Accessories dropdown links (header hover + mobile) — same
 * folder-backed destinations as the accessories landing tiles.
 */
export function jomaAccessoriesLinks(): JomaAudienceLink[] {
  return jomaAccessoriesLandingTiles().map(({ label, href }) => ({ label, href }));
}

/**
 * Teams / Teamwear hub tiles — live Joma `#link=69` sports & materials grid.
 * Shown on `/teamwear` (Man/Woman → TEAMWEAR). Covers pin real catalog SKUs
 * (packshot or model gallery) so tiles never fall back to blank brand plates.
 */
export function jomaTeamsLandingTiles(): LandingTileDef[] {
  return [
    {
      label: "POLYESTER",
      labelKey: "tiles.teamPolyester",
      href: "/shop/sportswear?q=polyester",
      hub: "sportswear",
      match: "polyester|poli[eé]ster",
      prefer: "wind|jacket|breaker",
      exclude: "3/4|pants|short",
      productIds: ["5001-13-35", "5001-13-100"],
    },
    {
      label: "COTTON",
      labelKey: "tiles.teamCotton",
      href: "/shop/sportswear?q=cotton",
      hub: "sportswear",
      match: "cotton|algod[oó]n",
      prefer: "t-?shirt|sweat|hoodie|montana|lille",
      exclude: "boxer|slip|brief|underwear",
      productIds: ["100912-200", "100912-331"],
    },
    {
      label: "OUTERWEAR",
      labelKey: "tiles.teamOuterwear",
      href: "/shop/sportswear?group=jackets",
      hub: "sportswear",
      match: "jacket|anorak|puffer|park|outerwear|gala",
      prefer: "gala|anorak|park|bomb|arctic|jacket",
      exclude: "wind breaker polyester",
      productIds: ["100086-671", "100086-100"],
    },
    {
      label: "SOCCER / FUTSAL",
      labelKey: "tiles.teamSoccerFutsal",
      href: "/shop/football",
      hub: "football",
      prefer: "premier|interlock|campus|shirt|set|jersey",
      exclude: "goalkeeper|goalie|portero|\\bgk\\b|protec",
      productIds: ["104594-102", "104594-602"],
    },
    {
      label: "BASKETBALL",
      labelKey: "tiles.teamBasketball",
      href: "/shop/basketball",
      hub: "basketball",
      match: "basket",
      prefer: "sleeveless|combi basket|jersey|shirt",
      exclude: "sock|protec",
      productIds: ["101660-100", "101660-200"],
    },
    {
      label: "RUGBY",
      labelKey: "tiles.teamRugby",
      href: "/shop/rugby",
      hub: "rugby",
      prefer: "skrum|jersey|shirt",
      exclude: "protec|helmet|protection|ball",
      productIds: ["102219-602", "102219-102"],
    },
    {
      label: "VOLLEYBALL",
      labelKey: "tiles.teamVolleyball",
      href: "/shop/running-fitness?q=volley",
      hub: "running-fitness",
      match: "volley|volea|voleibol",
      prefer: "volea|shirt|jersey",
      productIds: ["105374-013", "105374-100"],
    },
    {
      label: "HANDBALL",
      labelKey: "tiles.teamHandball",
      href: "/shop/sportswear?q=handball",
      hub: "sportswear",
      match: "handball|balonmano",
      prefer: "olimpiada|shirt|jersey",
      productIds: ["103837-251", "103837-100"],
    },
    {
      label: "COACH",
      labelKey: "tiles.teamCoach",
      href: "/shop/sportswear?q=staff",
      hub: "sportswear",
      match: "staff|coach|entrenador",
      prefer: "rain jacket|polo|jacket|sweatshirt",
      exclude: "torino|pants|short",
      productIds: ["TI10201B1221", "AH10701B3121", "100027-100"],
    },
    {
      label: "REFEREE",
      labelKey: "tiles.teamReferee",
      href: "/shop/sportswear?q=referee",
      hub: "sportswear",
      match: "referee|arbitro|[aá]rbitro",
      prefer: "shirt|yellow|fluorescent|turquoise",
      exclude: "respect|short(?!\\s*sleeve)",
      productIds: ["104240-061", "104240-011", "101299-110"],
    },
    {
      label: "GOALIE",
      labelKey: "tiles.teamGoalie",
      href: "/shop/football?q=goalkeeper",
      hub: "football",
      match: "goalkeeper|goalie|portero|\\bgk\\b",
      prefer: "phoenix|set|shirt",
      exclude: "short(?!\\s*sleeve)|glove",
      productIds: ["102858-013", "102858-021", "100009-100"],
    },
    {
      label: "CRICKET",
      labelKey: "tiles.teamCricket",
      href: "/shop/cricket",
      hub: "cricket",
      match: "cricket",
      prefer: "polo|jersey|shirt",
      exclude: "pants",
      productIds: ["104443-001", "104443-200"],
    },
    {
      label: "SWIMMING",
      labelKey: "tiles.teamSwimming",
      href: "/shop/swimming",
      hub: "swimming",
      prefer: "swim short|swimsuit|santa|shark",
      productIds: ["104143-345", "103545-100"],
    },
    {
      label: "PANTS",
      labelKey: "tiles.teamPants",
      href: "/shop/sportswear?group=pants",
      hub: "sportswear",
      prefer: "long pants|nilo|montana|cuff",
      exclude: "staff|3/4|short|bermuda",
      productIds: ["100165-100", "100165-331"],
    },
  ];
}

/**
 * Official Kits hub tiles — matches header Official Kits dropdown.
 * Three equal portrait tiles on `/teamwear?view=kits`.
 */
export function jomaOfficialKitsLandingTiles(): LandingTileDef[] {
  return [
    {
      label: "SPONSOR REPLICAS",
      labelKey: "tiles.kitSponsorReplicas",
      href: "/teamwear?view=kits&group=kits-replicas",
      hub: "teampro-2026",
      cover: "/brand/hub-teampro-2026.png",
    },
    {
      label: "COMMITTEES AND FEDERATIONS",
      labelKey: "tiles.kitCommittees",
      href: "/teamwear?view=kits&group=kits-federations",
      hub: "rugby",
      productIds: ["AH10601B0101"],
    },
    {
      label: "SPECIAL EDITIONS",
      labelKey: "tiles.kitSpecialEditions",
      href: "/teamwear?view=kits&group=kits-special",
      hub: "lifestyle",
      productIds: ["RECS2776IN"],
    },
  ];
}

/**
 * Shared Official Kits dropdown links (header hover + mobile) — same
 * drill-down targets as the kits landing tiles so the two cannot drift.
 */
export function jomaOfficialKitsLinks(): JomaAudienceLink[] {
  return jomaOfficialKitsLandingTiles().map(({ label, href }) => ({ label, href }));
}

/** Outlet first-view tiles — live `#link=66` order (photo + orange category + red price). */
export type OutletLandingTileDef = {
  label: string;
  /** i18n key resolving the label at render (falls back to label). */
  labelKey?: string;
  href: string;
  /** photo = product cover; category = orange card; price = red card. */
  kind: "photo" | "category" | "price";
  /** Overlay strip on photo tiles. */
  banner?: string;
  /** i18n key resolving the banner at render (falls back to banner). */
  bannerKey?: string;
  bannerTone?: "green" | "magenta";
  /** Text drawn on the colored bar for graphic tiles (defaults to label). */
  barLabel?: string;
  /** i18n key resolving the bar label at render (falls back to barLabel). */
  barLabelKey?: string;
  hub?: string;
  /** Catalog id or code. Resolved with productCardImageUrl. Photo tiles only. */
  productIds?: string[];
};

export function jomaOutletLandingTiles(): OutletLandingTileDef[] {
  return [
    {
      label: "PROMOTIONS",
      labelKey: "tiles.promotions",
      href: "/promotions?group=outlet-promotions",
      kind: "photo",
      hub: "sportswear",
      productIds: ["101588-100"],
    },
    {
      label: "FOOTWEAR",
      labelKey: "tiles.footwear",
      href: "/shop/shoes?group=outlet-footwear",
      kind: "photo",
      hub: "shoes",
      productIds: ["FSS2402IN"],
    },
    {
      label: "Apparel of byear",
      labelKey: "tiles.apparelByear",
      href: "/promotions?group=outlet-apparel-byear",
      // No SKU is filed in this leaf.
      kind: "category",
      barLabel: "APPAREL OF BYEAR",
      barLabelKey: "tiles.apparelByear",
      hub: "swimming",
    },
    {
      label: "SWEATSHIRT / JACKET",
      labelKey: "tiles.sweatshirtJacket",
      href: "/promotions?group=outlet-sweatshirt-jacket",
      kind: "photo",
      barLabel: "SWEATSHIRT / JACKET",
      barLabelKey: "tiles.sweatshirtJacket",
      productIds: ["101589-100"],
    },
    {
      label: "T-shirt / Top",
      labelKey: "tiles.tshirtTop",
      href: "/promotions?group=outlet-tshirt-top",
      kind: "photo",
      barLabel: "T-SHIRT / TOP",
      barLabelKey: "tiles.tshirtTop",
      productIds: ["101588-200"],
    },
    {
      label: "PANTS / SHORTS",
      labelKey: "tiles.pantsShorts",
      href: "/promotions?group=outlet-pants-shorts",
      kind: "photo",
      barLabel: "PANTS / SHORTS",
      barLabelKey: "tiles.pantsShorts",
      productIds: ["102841-100"],
    },
    {
      label: "ANORAK",
      labelKey: "tiles.anorak",
      href: "/promotions?group=outlet-anorak",
      kind: "photo",
      barLabel: "ANORAK",
      barLabelKey: "tiles.anorak",
      productIds: ["500764-100"],
    },
    {
      label: "Tracksuit",
      labelKey: "tiles.tracksuit",
      href: "/promotions?group=outlet-tracksuit",
      // No tracksuit is filed on the Outlet tracksuit leaf.
      kind: "category",
      barLabel: "TRACKSUIT",
      barLabelKey: "tiles.tracksuit",
    },
    {
      label: "JUNIOR",
      labelKey: "tiles.junior",
      href: "/promotions?group=outlet-junior",
      kind: "photo",
      barLabel: "JUNIOR",
      barLabelKey: "tiles.junior",
      productIds: ["500804-435"],
    },
    {
      label: "1.99 - 2.99",
      href: "/promotions?group=outlet-price-199-299",
      kind: "photo",
      barLabel: "1.99 - 2.99",
      productIds: ["900935-027"],
    },
    {
      label: "2.99 - 3.99",
      href: "/promotions?group=outlet-price-299-399",
      kind: "price",
      barLabel: "2.99 - 3.99",
    },
    {
      label: "3.99 - 4.99",
      href: "/promotions?group=outlet-price-399-499",
      kind: "photo",
      barLabel: "3.99 - 4.99",
      productIds: ["101291-452"],
    },
    {
      label: "4.99 - 5.99",
      href: "/promotions?group=outlet-price-499-599",
      kind: "photo",
      barLabel: "4.99 - 5.99",
      productIds: ["901267-601"],
    },
    {
      label: "5.99 - 6.99",
      href: "/promotions?group=outlet-price-599-699",
      kind: "photo",
      barLabel: "5.99 - 6.99",
      productIds: ["102219-336"],
    },
    {
      label: "6.99 - 7.99",
      href: "/promotions?group=outlet-price-699-799",
      kind: "photo",
      barLabel: "6.99 - 7.99",
      productIds: ["102752-100"],
    },
    {
      label: "7.99 - 10.99",
      href: "/promotions?group=outlet-price-799-1099",
      kind: "photo",
      barLabel: "7.99 - 10.99",
      productIds: ["103908-991"],
    },
    {
      label: "10.99 - 15.99",
      href: "/promotions?group=outlet-price-1099-1599",
      kind: "photo",
      barLabel: "10.99 - 15.99",
      productIds: ["600115-426"],
    },
    {
      label: "FROM 15.99",
      labelKey: "tiles.from1599",
      href: "/promotions?group=outlet-price-from-1599",
      kind: "price",
      barLabel: "FROM 15.99",
      barLabelKey: "tiles.from1599",
    },
  ];
}

/**
 * Shared Outlet dropdown entries (header + landing destinations) — Part B
 * order/labels; non-band children open real `outlet-*` folder keys.
 */
/**
 * Old Outlet price tiles used `max` as a wholesale-EUR ceiling. Listing
 * compares `max` to NAD retail, so those links emptied the page. Map them
 * onto the Part B price-band folder keys.
 */
const LEGACY_OUTLET_MAX_GROUP: Record<string, string> = {
  "3": "outlet-price-199-299",
  "4": "outlet-price-299-399",
  "5": "outlet-price-399-499",
  "6": "outlet-price-499-599",
  "7": "outlet-price-599-699",
  "8": "outlet-price-699-799",
  "11": "outlet-price-799-1099",
  "16": "outlet-price-1099-1599",
  "999": "outlet-price-from-1599",
};

export function outletGroupForLegacyMax(max: string | undefined) {
  if (!max) return undefined;
  return LEGACY_OUTLET_MAX_GROUP[max];
}

export function jomaOutletLinks(): JomaAudienceLink[] {
  return [
    { label: "Promotions", href: "/promotions?group=outlet-promotions" },
    { label: "Footwear", href: "/shop/shoes?group=outlet-footwear" },
    { label: "Apparel of byear", href: "/promotions?group=outlet-apparel-byear" },
    { label: "Sweatshirt / Jacket", href: "/promotions?group=outlet-sweatshirt-jacket" },
    { label: "T-shirt / Top", href: "/promotions?group=outlet-tshirt-top" },
    { label: "Pants / Shorts", href: "/promotions?group=outlet-pants-shorts" },
    { label: "Anorak", href: "/promotions?group=outlet-anorak" },
    { label: "Tracksuit", href: "/promotions?group=outlet-tracksuit" },
    { label: "Junior", href: "/promotions?group=outlet-junior" },
    { label: "1.99 - 2.99", href: "/promotions?group=outlet-price-199-299" },
    { label: "2.99 - 3.99", href: "/promotions?group=outlet-price-299-399" },
    { label: "3.99 - 4.99", href: "/promotions?group=outlet-price-399-499" },
    { label: "4.99 - 5.99", href: "/promotions?group=outlet-price-499-599" },
    { label: "5.99 - 6.99", href: "/promotions?group=outlet-price-599-699" },
    { label: "6.99 - 7.99", href: "/promotions?group=outlet-price-699-799" },
    { label: "7.99 - 10.99", href: "/promotions?group=outlet-price-799-1099" },
    { label: "10.99 - 15.99", href: "/promotions?group=outlet-price-1099-1599" },
    { label: "From 15.99", href: "/promotions?group=outlet-price-from-1599" },
  ];
}
