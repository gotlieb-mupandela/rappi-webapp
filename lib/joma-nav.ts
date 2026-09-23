/** Exact Joma B2B MAN / WOMAN destinations shared by header hover + audience landing. */

export type JomaAudienceLink = { href: string; label: string };

type LandingTileDef = {
  label: string;
  href: string;
  /** Catalog hub used for product-sample cover fallbacks. */
  hub: string;
  /** Preferred local brand cover when available. */
  cover?: string;
  /** Optional case-insensitive name match for product-sample covers. */
  match?: string;
};

function audienceQuery(audience: "men" | "women") {
  return `audience=${audience}`;
}

function destinations(audience: "men" | "women") {
  const q = audienceQuery(audience);
  return {
    teamwearPro: `/shop/teampro-2026?${q}`,
    teamwear: "/teamwear",
    running: `/shop/running-fitness?${q}`,
    cycling: `/shop/sportswear?${q}`,
    racket: `/shop/padel?${q}`,
    hiking: `/shop/hiking?${q}`,
    fitness: `/shop/running-fitness?${q}`,
    aguila: `/shop/football?${q}`,
    resort: `/shop/resort?${q}`,
    lifestyle: `/shop/lifestyle?${q}`,
    beachwear: `/shop/swimming?${q}`,
    brama: `/shop/brama?${q}`,
    combat: `/shop/boxing?${q}`,
    elite: "/teamwear",
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
      { label: "Cycling / Triathlon", href: d.cycling },
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
    { label: "Cycling / Triathlon", href: d.cycling },
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
  href: string;
  audience?: AudienceSlugForShoes;
  banner?: string;
};

type AudienceSlugForShoes = "men" | "women" | "kids";

/** Exact Footwear dropdown destinations shared by header + footwear landing. */
export function jomaFootwearLandingTiles(): FootwearLandingTileDef[] {
  return [
    { label: "MAN", href: "/shop/shoes?audience=men", audience: "men" },
    { label: "WOMAN", href: "/shop/shoes?audience=women", audience: "women" },
    { label: "JUNIOR", href: "/shop/shoes?audience=kids", audience: "kids" },
    {
      label: "OUTLET",
      href: "/promotions",
      banner: "SPECIAL OFFERS",
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
        href: d.teamwear,
        hub: "teampro-2026",
        cover: "/brand/audience-women-teamwear.png?v=2",
      },
      {
        label: "TEAMWEAR PRO 2026",
        href: d.teamwearPro,
        hub: "teampro-2026",
        cover: "/brand/audience-women-jersey-navy.png?v=2",
      },
      {
        label: "RUNNING / TRAIL",
        href: d.running,
        hub: "running-fitness",
        cover: "/brand/audience-women-field.png?v=2",
      },
      {
        label: "CYCLING / TRIATHLON",
        href: d.cycling,
        hub: "sportswear",
        // Man uses hub-sportswear lifestyle; Woman uses category packshots (no duplicate model).
      },
      { label: "RACKET SPORTS", href: d.racket, hub: "padel" },
      {
        label: "FITNESS / GYM",
        href: d.fitness,
        hub: "running-fitness",
        cover: "/brand/audience-women.png?v=6",
      },
      { label: "HIKING / OUTDOOR", href: d.hiking, hub: "hiking" },
      {
        label: "LIFESTYLE",
        href: d.lifestyle,
        hub: "lifestyle",
        cover: "/brand/audience-women-lifestyle.png?v=2",
      },
      { label: "ÁGUILA LINE", href: d.aguila, hub: "football" },
      { label: "RESORT", href: d.resort, hub: "resort" },
      { label: "BEACHWEAR", href: d.beachwear, hub: "swimming" },
      { label: "UNDERWEAR / BRAMA", href: d.brama, hub: "brama" },
      { label: "ATHLETES / COMBAT", href: d.combat, hub: "boxing" },
      { label: "ELITE CLUB", href: d.elite, hub: "football" },
    ];
  }
  return [
    {
      label: "TEAMWEAR",
      href: d.teamwear,
      hub: "teampro-2026",
      cover: "/brand/hub-rugby.png?v=1",
    },
    {
      label: "TEAMWEAR PRO 2026",
      href: d.teamwearPro,
      hub: "teampro-2026",
      cover: "/brand/hub-teampro-2026.png",
    },
    {
      label: "RUNNING / TRAIL",
      href: d.running,
      hub: "running-fitness",
      cover: "/brand/hero-athlete.png?v=2",
    },
    {
      label: "CYCLING / TRIATHLON",
      href: d.cycling,
      hub: "sportswear",
      cover: "/brand/hub-sportswear.png?v=5",
    },
    { label: "RACKET SPORTS", href: d.racket, hub: "padel" },
    { label: "HIKING / OUTDOOR", href: d.hiking, hub: "hiking" },
    {
      label: "FITNESS / GYM",
      href: d.fitness,
      hub: "running-fitness",
      cover: "/brand/hero-athlete.png?v=2",
    },
    {
      label: "LIFESTYLE",
      href: d.lifestyle,
      hub: "lifestyle",
      cover: "/brand/hub-lifestyle.png?v=4",
    },
    { label: "ÁGUILA LINE", href: d.aguila, hub: "football" },
    { label: "RESORT", href: d.resort, hub: "resort" },
    { label: "BEACHWEAR", href: d.beachwear, hub: "swimming" },
    { label: "UNDERWEAR / BRAMA", href: d.brama, hub: "brama" },
    { label: "ATHLETES / COMBAT", href: d.combat, hub: "boxing" },
    { label: "ELITE CLUB", href: d.elite, hub: "football" },
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
      href: "/shop/kids?age=1-4",
      hub: "sportswear",
      cover: "/brand/hub-kids.png",
    },
    {
      label: "6-10 YEARS",
      href: "/shop/kids?age=6-10",
      hub: "lifestyle",
      cover: "/brand/hub-lifestyle.png?v=4",
    },
    {
      label: "12-14 YEAR OLD BOY",
      href: "/shop/kids?age=12-14&gender=boy",
      hub: "football",
      cover: "/brand/hub-sportswear.png?v=5",
    },
    {
      label: "12-14 YEAR OLD GIRL",
      href: "/shop/kids?age=12-14&gender=girl",
      hub: "running-fitness",
      cover: "/brand/audience-women.png?v=5",
    },
  ];
}

/** Accessories first-view tiles — matches header Accessories dropdown order (incl. duplicate Socks). */
export type AccessoriesLandingTileDef = {
  label: string;
  href: string;
  /** Catalog hub used for product-sample cover fallbacks. */
  hub?: string;
  /** Prefer products with this subcategory when sampling. */
  sub?: string;
  /** Preferred local brand cover when available. */
  cover?: string;
};

export function jomaAccessoriesLandingTiles(): AccessoriesLandingTileDef[] {
  return [
    {
      label: "BALLS",
      href: "/shop/balls-bags?sub=balls",
      hub: "balls-bags",
      sub: "balls",
    },
    {
      label: "GOALKEEPER GLOVES",
      href: "/shop/football?sub=gk-gloves",
      hub: "football",
      sub: "gk-gloves",
    },
    {
      label: "BACKPACKS",
      href: "/shop/balls-bags?sub=bags",
      hub: "balls-bags",
      sub: "bags",
    },
    {
      label: "SOCKS",
      href: "/shop/balls-bags?sub=socks",
      hub: "balls-bags",
      sub: "socks",
    },
    {
      label: "SOCKS",
      href: "/shop/balls-bags?sub=socks",
      hub: "balls-bags",
      sub: "socks",
    },
    {
      label: "TEAMWEAR ACCESSORIES",
      href: "/teamwear",
      hub: "teampro-2026",
      cover: "/brand/hub-rugby.png?v=1",
    },
    {
      label: "RUNNING ACCESSORIES",
      href: "/shop/running-fitness?sub=accessories",
      hub: "running-fitness",
      sub: "accessories",
      cover: "/brand/hero-athlete.png?v=2",
    },
    {
      label: "RACKET ACCESSORIES",
      href: "/shop/balls-bags?sub=rackets",
      hub: "balls-bags",
      sub: "rackets",
    },
    {
      label: "PADEL RACKETS",
      href: "/shop/padel?sub=rackets",
      hub: "padel",
      sub: "rackets",
    },
    {
      label: "PICKLEBALL PADDLES",
      href: "/shop/balls-bags?sub=rackets",
      hub: "balls-bags",
      sub: "rackets",
    },
    {
      label: "OUTDOOR ACCESSORIES",
      href: "/shop/hiking",
      hub: "hiking",
    },
    {
      label: "FITNESS / GYM ACCESSORIES",
      href: "/shop/running-fitness",
      hub: "running-fitness",
      cover: "/brand/hero-athlete.png?v=2",
    },
    {
      label: "ACCESSORIES STORES",
      href: "/store",
    },
    {
      label: "TEAMWEAR CATALOGUE",
      href: "/shop/teampro-2026",
      hub: "teampro-2026",
      cover: "/brand/hub-teampro-2026.png",
    },
  ];
}

/**
 * Teams / Teamwear hub tiles — live Joma `#link=69` sports & materials grid.
 * Shown on `/teamwear` (Man/Woman → TEAMWEAR). Not used for Man/Woman landings.
 */
export function jomaTeamsLandingTiles(): LandingTileDef[] {
  return [
    {
      label: "POLYESTER",
      href: "/shop/sportswear?q=polyester",
      hub: "sportswear",
      match: "polyester|poli[eé]ster",
    },
    {
      label: "COTTON",
      href: "/shop/sportswear?q=cotton",
      hub: "sportswear",
      match: "cotton|algod[oó]n",
    },
    {
      label: "OUTERWEAR",
      href: "/shop/sportswear?group=jackets",
      hub: "sportswear",
      match: "jacket|anorak|puffer|park|outerwear",
      cover: "/brand/hub-sportswear.png?v=5",
    },
    {
      label: "SOCCER / FUTSAL",
      href: "/shop/football",
      hub: "football",
      match: "soccer|futsal|football|f[uú]tbol",
    },
    {
      label: "BASKETBALL",
      href: "/shop/basketball",
      hub: "basketball",
      match: "basket",
    },
    {
      label: "RUGBY",
      href: "/shop/rugby",
      hub: "rugby",
      cover: "/brand/hub-rugby.png?v=1",
    },
    {
      label: "VOLLEYBALL",
      href: "/shop/running-fitness?q=volley",
      hub: "running-fitness",
      match: "volley|voleibol",
    },
    {
      label: "HANDBALL",
      href: "/shop/sportswear?q=handball",
      hub: "sportswear",
      match: "handball|balonmano",
    },
    {
      label: "COACH",
      href: "/shop/sportswear?q=staff",
      hub: "sportswear",
      match: "staff|coach|entrenador",
    },
    {
      label: "REFEREE",
      href: "/shop/sportswear?q=referee",
      hub: "sportswear",
      match: "referee|arbitro|[aá]rbitro|respect",
    },
    {
      label: "GOALIE",
      href: "/shop/football?q=goalkeeper",
      hub: "football",
      match: "goalkeeper|goalie|portero",
    },
    {
      label: "CRICKET",
      href: "/shop/cricket",
      hub: "cricket",
      match: "cricket",
    },
    {
      label: "SWIMMING",
      href: "/shop/swimming",
      hub: "swimming",
      match: "swim|nataci[oó]n|ba[nñ]ador",
    },
    {
      label: "PANTS",
      href: "/shop/sportswear?group=pants",
      hub: "sportswear",
      match: "pants|pantalon|trouser|jogger",
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
      href: "/shop/teampro-2026",
      hub: "teampro-2026",
      cover: "/brand/hub-teampro-2026.png",
    },
    {
      label: "COMMITTEES AND FEDERATIONS",
      href: "/teamwear?view=quote",
      hub: "rugby",
      cover: "/brand/hub-rugby.png?v=1",
    },
    {
      label: "SPECIAL EDITIONS",
      href: "/promotions?view=all",
      hub: "lifestyle",
      cover: "/brand/hub-lifestyle.png?v=4",
    },
  ];
}

/** Outlet first-view tiles — live `#link=66` order (photo + orange category + red price). */
export type OutletLandingTileDef = {
  label: string;
  href: string;
  /** photo = product cover; category = orange OUTLET graphic; price = red OUTLET graphic. */
  kind: "photo" | "category" | "price";
  /** Overlay strip on photo tiles. */
  banner?: string;
  bannerTone?: "green" | "magenta";
  /** Text drawn on the colored bar for graphic tiles (defaults to label). */
  barLabel?: string;
  hub?: string;
};

export function jomaOutletLandingTiles(): OutletLandingTileDef[] {
  return [
    {
      label: "PROMOTIONS",
      href: "/promotions?view=all",
      kind: "photo",
      banner: "LIMITED TIME",
      bannerTone: "green",
      hub: "shoes",
    },
    {
      label: "FOOTWEAR",
      href: "/shop/shoes",
      kind: "photo",
      banner: "SPECIAL OFFERS",
      bannerTone: "magenta",
      hub: "shoes",
    },
    {
      label: "BEACHWEAR",
      href: "/shop/swimming",
      kind: "category",
      barLabel: "BEACHWEAR",
      hub: "swimming",
    },
    {
      label: "SWEATSHIRT / JACKET",
      href: "/shop/sportswear?group=jackets",
      kind: "category",
      barLabel: "SWEATSHIRT / JACKET",
      hub: "sportswear",
    },
    {
      label: "T-SHIRT / TOP",
      href: "/shop/sportswear?group=shirts",
      kind: "category",
      barLabel: "T-SHIRT / TOP",
      hub: "sportswear",
    },
    {
      label: "PANTS / SHORTS",
      href: "/shop/sportswear?group=shorts",
      kind: "category",
      barLabel: "PANTS / SHORTS",
      hub: "sportswear",
    },
    {
      label: "ANORAK",
      href: "/shop/sportswear?group=jackets",
      kind: "category",
      barLabel: "ANORAK",
      hub: "sportswear",
    },
    {
      label: "TRACK-SUIT",
      href: "/shop/sportswear?sub=tracksuits",
      kind: "category",
      barLabel: "TRACKSUIT",
      hub: "sportswear",
    },
    {
      label: "JUNIOR",
      href: "/shop/kids",
      kind: "category",
      barLabel: "JUNIOR",
      hub: "sportswear",
    },
    { label: "1.99 - 2.99", href: "/promotions?max=3&view=all", kind: "price", barLabel: "1.99 - 2.99" },
    { label: "2.99 - 3.99", href: "/promotions?max=4&view=all", kind: "price", barLabel: "2.99 - 3.99" },
    { label: "3.99 - 4.99", href: "/promotions?max=5&view=all", kind: "price", barLabel: "3.99 - 4.99" },
    { label: "4.99 - 5.99", href: "/promotions?max=6&view=all", kind: "price", barLabel: "4.99 - 5.99" },
    { label: "5.99 - 6.99", href: "/promotions?max=7&view=all", kind: "price", barLabel: "5.99 - 6.99" },
    { label: "6.99 - 7.99", href: "/promotions?max=8&view=all", kind: "price", barLabel: "6.99 - 7.99" },
    { label: "7.99 - 10.99", href: "/promotions?max=11&view=all", kind: "price", barLabel: "7.99 - 10.99" },
    { label: "10.99 - 15.99", href: "/promotions?max=16&view=all", kind: "price", barLabel: "10.99 - 15.99" },
    { label: "FROM 15.99", href: "/promotions?max=999&view=all", kind: "price", barLabel: "FROM 15.99" },
  ];
}

/** Shared Outlet dropdown entries (header + landing destinations). */
export function jomaOutletLinks(): JomaAudienceLink[] {
  return [
    { label: "Promotions", href: "/promotions?view=all" },
    { label: "Footwear", href: "/shop/shoes" },
    { label: "Sweatshirt / Jacket", href: "/shop/sportswear?group=jackets" },
    { label: "Swimwear", href: "/shop/swimming" },
    { label: "T-shirt / Top", href: "/shop/sportswear?group=shirts" },
    { label: "Pants / Shorts", href: "/shop/sportswear?group=shorts" },
    { label: "Anorak", href: "/shop/sportswear?group=jackets" },
    { label: "Track-suit", href: "/shop/sportswear?sub=tracksuits" },
    { label: "Junior", href: "/shop/kids" },
    { label: "1.99 - 2.99", href: "/promotions?max=3&view=all" },
    { label: "2.99 - 3.99", href: "/promotions?max=4&view=all" },
    { label: "3.99 - 4.99", href: "/promotions?max=5&view=all" },
    { label: "4.99 - 5.99", href: "/promotions?max=6&view=all" },
    { label: "5.99 - 6.99", href: "/promotions?max=7&view=all" },
    { label: "6.99 - 7.99", href: "/promotions?max=8&view=all" },
    { label: "7.99 - 10.99", href: "/promotions?max=11&view=all" },
    { label: "10.99 - 15.99", href: "/promotions?max=16&view=all" },
    { label: "From 15.99", href: "/promotions?max=999&view=all" },
  ];
}
