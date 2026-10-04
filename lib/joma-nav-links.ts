/** Header hover / mobile links only — keep this file free of landing-tile data. */

export type JomaAudienceLink = { href: string; label: string };

export function destinations(audience: "men" | "women") {
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

export function jomaAccessoriesLinks(): JomaAudienceLink[] {
  return [
    { label: "Balls", href: "/shop/balls-bags?group=acc-balls" },
    { label: "Gloves portero", href: "/shop/football?group=acc-gloves-portero" },
    { label: "Backpacks", href: "/shop/balls-bags?group=acc-backpacks" },
    { label: "Medias", href: "/shop/balls-bags?group=acc-medias" },
    { label: "Socks", href: "/shop/sportswear?group=acc-socks" },
    { label: "Accessories teamwear", href: "/shop/sportswear?group=acc-teamwear" },
    { label: "Accessories running", href: "/shop/running-fitness?group=acc-running" },
    { label: "Accessories of Racket", href: "/shop/sportswear?group=acc-racket" },
    { label: "Palas of pádel", href: "/shop/padel?group=acc-palas-padel" },
    { label: "Palas of Pickleball", href: "/shop/balls-bags?group=acc-palas-pickleball" },
    { label: "Accessories Outdoor", href: "/shop/hiking?group=acc-outdoor" },
    { label: "Accessories Fitness / Gym", href: "/shop/running-fitness?group=acc-fitness-gym" },
    { label: "Accessories tiendas", href: "/shop/balls-bags?group=acc-tiendas" },
    { label: "Teamwear Catalogue", href: "/shop/teampro-2026?group=acc-teamwear-catalogue" },
  ];
}

export function jomaOfficialKitsLinks(): JomaAudienceLink[] {
  return [
    { label: "SPONSOR REPLICAS", href: "/teamwear?view=kits&group=kits-replicas" },
    { label: "COMMITTEES AND FEDERATIONS", href: "/teamwear?view=kits&group=kits-federations" },
    { label: "SPECIAL EDITIONS", href: "/teamwear?view=kits&group=kits-special" },
  ];
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
