export type CategoryDef = {
  slug: string;
  name: string;
  nav?: string;
  featured?: boolean;
  blurb: string;
};

export const CATEGORIES: CategoryDef[] = [
  {
    slug: "sportswear",
    name: "Sportswear",
    featured: true,
    blurb: "Tees, shorts, tracksuits, hoodies, jackets, and training layers.",
  },
  {
    slug: "football",
    name: "Football",
    featured: true,
    blurb: "Boots, sets, balls, socks, shin guards, and keeper gloves.",
  },
  {
    slug: "basketball",
    name: "Basketball",
    blurb: "Shoes, jerseys, shorts, and match sets.",
  },
  {
    slug: "netball",
    name: "Netball",
    blurb: "Dresses, skirts, and court shoes.",
  },
  {
    slug: "swimming",
    name: "Swimming",
    blurb: "Swimwear, caps, and goggles.",
  },
  {
    slug: "rugby",
    name: "Rugby",
    blurb: "Jerseys, shorts, balls, scrum caps, and protection.",
  },
  {
    slug: "cricket",
    name: "Cricket",
    blurb: "Match whites and cricket clothing.",
  },
  {
    slug: "boxing",
    name: "Boxing",
    blurb: "Combat training shorts for the gym and the ring.",
  },
  {
    slug: "hockey",
    name: "Hockey",
    blurb: "Field hockey footwear from the current catalog.",
  },
  {
    slug: "running-fitness",
    name: "Running & Fitness",
    nav: "Running",
    featured: true,
    blurb: "Running layers, gym kit, and training accessories.",
  },
  {
    slug: "brama",
    name: "Brama",
    blurb: "Brama skins, tights, and base layers.",
  },
  {
    slug: "padel",
    name: "Padel",
    blurb: "Padel apparel, court shoes, and rackets.",
  },
  {
    slug: "hiking",
    name: "Hiking",
    blurb: "Outdoor trousers, jackets, and trail footwear.",
  },
  {
    slug: "resort",
    name: "Resort",
    blurb: "Resort polos, travel layers, and easy weekend kit.",
  },
  {
    slug: "lifestyle",
    name: "Lifestyle",
    blurb: "Lifestyle sneakers and everyday court-to-street pairs.",
  },
  {
    slug: "teampro-2026",
    name: "Teampro 2026",
    nav: "Teampro",
    blurb: "2026 team and Mundial collection shirts.",
  },
  {
    slug: "shoes",
    name: "Shoes",
    featured: true,
    blurb: "Sneakers, running, court, boots, kids, sandals, and barefoot.",
  },
  {
    slug: "balls-bags",
    name: "Balls & Bags",
    blurb: "Match balls, kit bags, backpacks, and rackets.",
  },
];

export const SUBCATEGORY_LABELS: Record<string, string> = {
  "tees-men": "T-Shirts Men",
  "tees-women": "T-Shirts Women",
  "tees-kids": "Kids tees",
  tees: "T-Shirts",
  polos: "Polos",
  shorts: "Shorts",
  tracksuits: "Tracksuits",
  leggings: "Leggings",
  tights: "Tights",
  sweatpants: "Sweatpants",
  pants: "Pants",
  bras: "Sports Bras",
  hoodies: "Hoodies",
  jackets: "Jackets",
  "jackets-kids": "Kids Jackets",
  socks: "Socks",
  caps: "Caps",
  balls: "Balls",
  boots: "Boots",
  "shin-guards": "Shin Guards",
  "gk-gloves": "Goalkeeper Gloves",
  sets: "Sets",
  shoes: "Shoes",
  sneakers: "Sneakers",
  sandals: "Sandals",
  barefoot: "Barefoot",
  "running-shoes": "Running shoes",
  "court-shoes": "Court shoes",
  "kids-shoes": "Kids shoes",
  jerseys: "Jerseys",
  dresses: "Dresses",
  skirts: "Skirts",
  swimwear: "Swimwear",
  goggles: "Goggles",
  "scrum-caps": "Scrum Caps",
  protection: "Protection",
  clothing: "Clothing",
  "training-shoes": "Training Shoes",
  tops: "Tops",
  mats: "Mats",
  towels: "Towels",
  "equipment-bags": "Equipment Bags",
  bags: "Bags",
  "ball-bags": "Ball Bags",
  rackets: "Rackets",
  skins: "Skins",
  accessories: "Accessories",
  general: "More",
};

/**
 * Apparel-style folders for audience / category tiles.
 * Unmapped labeled subcategories stay as their own folder.
 * `general` is hidden — it is leftover stock, not a shop folder.
 */
export const TYPE_FOLDERS: Record<string, readonly string[]> = {
  shirts: [
    "tees",
    "tees-men",
    "tees-women",
    "tees-kids",
    "polos",
    "jerseys",
    "tops",
    "clothing",
    "sets",
  ],
  jackets: ["jackets", "jackets-kids", "hoodies"],
  shorts: ["shorts"],
  pants: ["pants", "sweatpants", "tights", "skins", "leggings", "tracksuits"],
  dresses: ["dresses"],
  skirts: ["skirts"],
  bras: ["bras"],
  swimwear: ["swimwear"],
  shoes: [
    "sneakers",
    "running-shoes",
    "court-shoes",
    "boots",
    "sandals",
    "barefoot",
    "kids-shoes",
    "training-shoes",
    "shoes",
  ],
  accessories: [
    "socks",
    "caps",
    "goggles",
    "towels",
    "mats",
    "accessories",
    "gk-gloves",
    "protection",
    "shin-guards",
    "scrum-caps",
  ],
  equipment: ["balls", "bags", "equipment-bags", "ball-bags", "rackets"],
};

/** Shop-like order: clothes first, then shoes, then extras. */
export const TYPE_FOLDER_ORDER = [
  "shirts",
  "jackets",
  "shorts",
  "pants",
  "dresses",
  "skirts",
  "bras",
  "swimwear",
  "shoes",
  "accessories",
  "equipment",
] as const;

/** Warehouse leftovers — never their own shop tiles. `sets` fold into shirts. */
export const HIDDEN_TYPE_FOLDERS = new Set(["general", "sets"]);

/** Adult women-coded families — unisex leftovers in these stay off Men. */
export const WOMEN_CODED_TYPE_FOLDERS = new Set([
  "dresses",
  "skirts",
  "bras",
  "swimwear",
]);

const SUB_TO_TYPE_FOLDER: Record<string, string> = Object.fromEntries(
  Object.entries(TYPE_FOLDERS).flatMap(([folder, slugs]) =>
    slugs.map((slug) => [slug, folder]),
  ),
);

export function typeFolderForSubcategory(sub: string) {
  return SUB_TO_TYPE_FOLDER[sub] ?? sub;
}

export function matchesTypeFolder(subcategory: string, group: string) {
  const slugs = TYPE_FOLDERS[group];
  return slugs ? slugs.includes(subcategory) : subcategory === group;
}

/** Legacy / short hub paths that should resolve to a live category slug. */
export const CATEGORY_ALIASES: Record<string, string> = {
  teampro: "teampro-2026",
};

export function resolveCategorySlug(slug: string) {
  return CATEGORY_ALIASES[slug] ?? slug;
}

export const CAMPAIGN_COLLECTIONS = [
  "padel",
  "hiking",
  "brama",
  "resort",
  "lifestyle",
  "teampro-2026",
] as const;

/** Clothing & accessories first; empty hubs (e.g. netball) are filtered at render. */
export const NAV_PRIMARY = [
  "sportswear",
  "shoes",
  "football",
  "basketball",
  "running-fitness",
  "balls-bags",
  "swimming",
] as const;

export const NAV_MORE = CATEGORIES.filter(
  (c) =>
    c.slug !== "netball" &&
    !NAV_PRIMARY.includes(c.slug as (typeof NAV_PRIMARY)[number]),
);

export function categoryBySlug(slug: string) {
  return CATEGORIES.find((c) => c.slug === resolveCategorySlug(slug));
}

export const AUDIENCES = [
  {
    slug: "men",
    name: "Men",
    blurb: "Men’s kit from the current drop — tees, shorts, shoes, and match gear.",
  },
  {
    slug: "women",
    name: "Women",
    blurb: "Women’s kit from the current drop — training layers, shoes, and court wear.",
  },
  {
    slug: "kids",
    name: "Kids",
    blurb: "Junior and kids sizes for training, school, and match day.",
  },
] as const;

export type AudienceSlug = (typeof AUDIENCES)[number]["slug"];

export function audienceBySlug(slug: string) {
  return AUDIENCES.find((a) => a.slug === slug);
}

export const DEMO_EMAIL = "shop@rappi.com";
export const DEMO_PASSWORD = "rappi123";
export const TAGLINE = "GEAR UP. SHOW UP. LEVEL UP.";
