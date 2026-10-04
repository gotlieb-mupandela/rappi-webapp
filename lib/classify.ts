import { BIB_PACK_PRICE_NAD, applyInferredSurtidoAssortments, isFixedBibPack } from "@/lib/assortment";
import { productDescription } from "@/lib/copy";
import { roundNad } from "@/lib/format";
import { isSportHub, jomaLeafHub, productInHub } from "@/lib/hub-membership";
import { hasUsableProductImage, withProductImages } from "@/lib/media";
import { withCatalogSizes } from "@/lib/sizes";
import type { Product } from "@/lib/types";

function textBlob(product: Product) {
  return [
    product.item,
    product.sheetCategory,
    product.displayName,
    product.name,
    product.title,
    product.subcategory,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function itemFamily(item: string) {
  return item.replace(/\s*\[\d+\]\s*$/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

function word(hay: string, ...needles: string[]) {
  return needles.some((n) => new RegExp(`\\b${n}\\b`, "i").test(hay));
}

/** Combat training shorts are the closest Joma stand-in for the boxing hub. */
function isCombatBoxingShort(name: string) {
  if (!word(name, "combat")) return false;
  if (/(swim|beach|brief|sleeve|shirt|tee|tight|legging|bra|jacket|hoodie|sweat)/.test(name)) {
    return false;
  }
  return word(name, "short", "shorts", "bermuda");
}

function isFootwearFamily(family: string) {
  return /^(sneaker|sandal|barefoot|summer shoe|footwear|junior sandal|comfort sandal)/.test(
    family,
  );
}

/** Running / court shoe families that are almost all footwear, not apparel. */
function isDedicatedShoeFamily(family: string) {
  return /^(running man|running woman|junior running|trail running|trail man|trail woman|tennis|tennis - padel|padel junior|volley woman|sport|sports|gym|comfort|comfort man|comfort woman|fashion|lifestyle|junior fashion|schoolwear|schoolboy|outdoor)$/.test(
    family,
  );
}

function isFootballBootFamily(family: string) {
  return /^(futsal|turf|semi-dry|artificial grass|soccer|junior football|soft ground|football \/ futsal)/.test(
    family,
  );
}

const APPAREL_RE =
  /\b(t-shirts?|tshirts?|shirts?|polo|shorts?|bermuda|hoodie|jackets?|anorak|raincoat|windbreaker|sweatshirts?|tracksuits?|pants?|trousers?|tights?|leggings?|bras?|socks?|dresses?|skirts?|gloves?|caps?|hats?|visor|bib|set|singlet|tanks?|vests?|sleeveless|crop(?:ped)?)\b/i;
const HARD_FOOTWEAR_RE = /\b(shoe|sneaker|boot|sandal)\b/i;
const FOOTWEAR_NAME_RE =
  /\b(sneaker|sandal|barefoot|shoe|boot|cleat|spike|trainer|footwear)\b/i;
const BAG_RE =
  /\b(backpack|shoe bag|sport bags?|sports bag|kit bag|ball bag|waist bag|drawstring|mochila|paddle bag|training bag|duffel|bag)\b/i;
const BALL_RE = /\b(ball|balón|balon)\b/i;
const RACKET_RE = /\b(racket|paddle|p\u00e1del|padel racket|pickleball)\b/i;

function isBagName(name: string) {
  return BAG_RE.test(name);
}

function isApparelName(name: string) {
  const cleaned = name.replace(/\btop flex\b/gi, " ");
  if (APPAREL_RE.test(cleaned)) return true;
  // Training tops, not "Top Flex" football boots.
  return /\btop\b/i.test(cleaned) && !FOOTWEAR_NAME_RE.test(cleaned);
}

function isApparelOnly(name: string) {
  return isApparelName(name) && !HARD_FOOTWEAR_RE.test(name);
}

function isFootwearName(name: string) {
  if (isBagName(name)) return false;
  if (isApparelOnly(name)) return false;
  return FOOTWEAR_NAME_RE.test(name);
}

/** Joma Hook shorts are the rugby short line (names omit "rugby"). */
function isRugbyHookShort(name: string) {
  if (!/\bhook\b/.test(name)) return false;
  if (isFootwearName(name) || isBagName(name)) return false;
  return word(name, "short", "shorts", "bermuda");
}

function isFootballBootName(name: string) {
  if (isApparelName(name) && !/\bboot\b/.test(name)) return false;
  return /\b(turf|firm ground|soft ground|artificial grass|futsal| fg\b| ag\b| sg\b|indoor)\b/.test(
    name,
  ) && (FOOTWEAR_NAME_RE.test(name) || /\b(aguila|cancha|caneta|gol |regate|top flex|evolution|drive)\b/.test(name) || /\b(turf|firm ground|soft ground|artificial grass)\b/.test(name));
}

function isSwimPiece(name: string, family: string) {
  if (/\b(goggle|googels|swimsuit|swim cap|swimming cap|swim brief|swim boxer)\b/.test(name)) {
    return true;
  }
  if (/\b(swimwear|swimsuit|goggle|swimming)\b/.test(family)) return true;
  if (/\bswimsuit\b/.test(name)) return true;
  return false;
}

function isVolleyBall(name: string) {
  return /\b(volley|volleyball)\b/.test(name) && BALL_RE.test(name);
}

/** Garment title only — ignore Joma sheet families such as "Pants & Tights". */
function garmentName(product: Product) {
  return `${product.displayName} ${product.name}`.toLowerCase();
}

function withoutSleeveWords(name: string) {
  return name.replace(/short[- ]sleeved?\b/gi, " ").replace(/\s+/g, " ").trim();
}

/** Trail / training shorts that are not compression tights or short-sleeve shirts. */
function isNamedShortNotTight(name: string) {
  return isNamedShortsGarment(name) && !/\b(tights?|leggings?)\b/.test(name);
}

function isNamedShortsGarment(name: string) {
  const cleaned = withoutSleeveWords(name);
  if (/\b(tights?|leggings?)\b/.test(cleaned)) return false;
  if (
    /\b(shirt|jersey|tee|t-shirt|tshirt|top)\b/.test(cleaned) &&
    !/\b(shorts|bermuda)\b/.test(cleaned)
  ) {
    return false;
  }
  return /\b(shorts|bermuda)\b/.test(cleaned) || /\bshort\b/.test(cleaned);
}

/**
 * Re-home Joma B2B rows that landed in a catch-all (usually sportswear)
 * onto the storefront hub they belong to.
 * Keeps the PR #3 remaps (cricket / hockey / rugby / boxing / footwear families)
 * and extends them so clothing, shoes, and bags/balls land in coherent hubs.
 */
export function classifyStorefrontCategory(product: Product): string {
  const blob = textBlob(product);
  const family = itemFamily(product.item || "");
  const name = `${product.displayName} ${product.name}`.toLowerCase();

  if (word(blob, "cricket") || family === "cricket") return "cricket";
  if (word(blob, "hockey") || family === "hockey") return "hockey";
  const leafHub = jomaLeafHub(product.code);
  if (leafHub) return leafHub;
  if (
    word(blob, "rugby", "skrum", "scrum") ||
    family === "rugby" ||
    family === "skrum" ||
    isRugbyHookShort(name)
  ) {
    return "rugby";
  }
  if (word(blob, "brama") || family === "brama" || family === "brama line") return "brama";
  if (
    family.includes("mundial 2026") ||
    family === "montreal 2026" ||
    /\b(mundial 2026|montreal 2026|world cup 2026|teampro)\b/.test(blob)
  ) {
    return "teampro-2026";
  }
  if (word(blob, "resort") || family === "resort") return "resort";
  if (family === "lifestyle") return "lifestyle";
  if (
    family === "outdoor" ||
    family.startsWith("outdoor") ||
    word(blob, "hiking", "trek", "trekking")
  ) {
    return "hiking";
  }
  if (word(blob, "padel") || family.includes("padel")) return "padel";
  if (isCombatBoxingShort(name)) return "boxing";

  if (isSwimPiece(name, family)) return "swimming";

  if (isBagName(name) || family === "backpacks" || family === "bag") {
    return "balls-bags";
  }
  if (isVolleyBall(name) || (family === "balls" && product.category !== "football")) {
    return "balls-bags";
  }
  if (
    (/\b(racket|pickleball paddle)\b/.test(name) ||
      family.includes("paddle racket") ||
      family.includes("pickleball paddle")) &&
    !isBagName(name) &&
    !isApparelName(name)
  ) {
    return "balls-bags";
  }

  if (isFootballBootFamily(family) || isFootballBootName(name)) {
    return "football";
  }

  if (
    !isApparelOnly(name) &&
    (isFootwearFamily(family) || isDedicatedShoeFamily(family) || isFootwearName(name))
  ) {
    if (/\bbasket\b/.test(family) || /\bbasketball\b/.test(name)) return "basketball";
    return "shoes";
  }

  // Mixed Joma families: only move the footwear rows, leave apparel in place.
  if (
    (family === "running" ||
      family === "padel" ||
      family === "volleyball" ||
      family === "football") &&
    !isApparelOnly(name) &&
    !isBagName(name) &&
    !BALL_RE.test(name)
  ) {
    if (family === "football" || isFootballBootName(name)) return "football";
    return "shoes";
  }

  // Accessories dump in balls-bags that are actually apparel.
  if (product.category === "balls-bags") {
    if (isBagName(name) || BALL_RE.test(name) || RACKET_RE.test(name)) {
      return "balls-bags";
    }
    if (/\bshin guards?\b/.test(name)) return "football";
    if (/\b(socks?|caps?|hats?|visor|gloves?|bib|shirts?|shorts?|jackets?)\b/.test(name)) {
      return "sportswear";
    }
  }

  return product.category;
}

const SUB_RULES: Array<{ slug: string; test: (name: string, family: string) => boolean }> = [
  {
    slug: "bags",
    test: (name, family) =>
      isBagName(name) || family === "backpacks" || family === "bag" || family.includes("equipment bag"),
  },
  {
    slug: "balls",
    test: (name, family) =>
      (BALL_RE.test(name) || family === "balls") && !/long pants ball/.test(name),
  },
  {
    slug: "rackets",
    test: (name, family) =>
      /\b(racket|paddle)\b/.test(name) && !isBagName(name) || family.includes("racket") || family.includes("paddle"),
  },
  {
    slug: "goggles",
    test: (name) => /\b(goggle|googels)\b/.test(name),
  },
  {
    slug: "swimwear",
    test: (name, family) =>
      /\b(swimsuit|swimwear|swim brief|swim boxer|swim short)\b/.test(name) ||
      family === "swimwear" ||
      family === "swimsuits" ||
      family === "swimming",
  },
  {
    slug: "scrum-caps",
    test: (name) => /\b(scrum cap|skrum)\b/.test(name),
  },
  {
    slug: "protection",
    test: (name) => /\b(shoulder protection|shin guard|protection)\b/.test(name),
  },
  {
    slug: "shin-guards",
    test: (name) => /\bshin guard/.test(name),
  },
  {
    slug: "gk-gloves",
    test: (name, family) => /\b(goalkeeper glove|gk glove)\b/.test(name) || family === "gloves",
  },
  {
    slug: "futsal",
    test: (name, family) =>
      family === "futsal" ||
      family === "football / futsal" ||
      (/\bfutsal\b/.test(`${name} ${family}`) && !isApparelName(name)),
  },
  {
    slug: "turf",
    test: (name, family) =>
      family === "turf" || (/\bturf\b/.test(`${name} ${family}`) && !isApparelName(name)),
  },
  {
    slug: "football-fg",
    test: (name, family) =>
      /semi-dry|hard terrain|firm ground/.test(family) ||
      (/\b(semi[- ]?dry|firm ground|\bfg\b)\b/.test(name) &&
        (isFootballBootName(name) || FOOTWEAR_NAME_RE.test(name))),
  },
  {
    slug: "football-ag",
    test: (name, family) =>
      family === "artificial grass" ||
      (/\b(artificial grass|\bag\b)\b/.test(`${name} ${family}`) && !isApparelName(name)),
  },
  {
    slug: "football-sg",
    test: (name, family) =>
      family === "soft ground" ||
      (/\b(soft ground|\bsg\b)\b/.test(`${name} ${family}`) && !isApparelName(name)),
  },
  {
    slug: "boots",
    test: (name, family) =>
      isFootballBootFamily(family) ||
      isFootballBootName(name) ||
      /\bboot\b/.test(name),
  },
  {
    slug: "kids-shoes",
    test: (name, family) =>
      (isFootwearName(name) || isFootwearFamily(family) || isDedicatedShoeFamily(family)) &&
      /\b(junior| jr\b|kids|child|baby)\b/.test(`${name} ${family}`),
  },
  {
    slug: "barefoot",
    test: (name, family) => /\bbarefoot\b/.test(`${name} ${family}`),
  },
  {
    slug: "sandals",
    test: (name, family) => /\b(sandal|summer shoe|playa|s\.playa|s\.costa)\b/.test(`${name} ${family}`),
  },
  {
    slug: "trail-running",
    test: (name, family) => {
      // Item family "r-trail" is also the apparel line (R-Trail shirts and pants).
      if (isApparelName(name)) return false;
      return (
        /^(trail running|trail man|trail woman|r-trail)/.test(family) ||
        /\b(trail running|r-trail)\b/.test(`${name} ${family}`)
      );
    },
  },
  {
    slug: "tennis-shoes",
    test: (name, family) =>
      family === "tennis" ||
      (/\btennis\b/.test(`${name} ${family}`) && !isApparelName(name) && !/\bpadel\b/.test(family)),
  },
  {
    slug: "padel-shoes",
    test: (name, family) => {
      if (isApparelName(name)) return false;
      return /padel/.test(family) || /\b(padel|p[aá]del)\b/.test(`${name} ${family}`);
    },
  },
  {
    slug: "pickleball-shoes",
    test: (name, family) =>
      /\bpickleball\b/.test(`${name} ${family}`) && !isApparelName(name),
  },
  {
    slug: "handball-shoes",
    test: (name, family) =>
      family === "handball" ||
      (/\bhandball\b/.test(`${name} ${family}`) && !isApparelName(name)),
  },
  {
    slug: "badminton-shoes",
    test: (name, family) =>
      /\bbadminton\b/.test(`${name} ${family}`) && !isApparelName(name),
  },
  {
    slug: "basketball-shoes",
    test: (name, family) => {
      if (isApparelName(name)) return false;
      return (
        /^(basketball|basket)$/.test(family) ||
        /\bbasket(ball)?\b/.test(`${name} ${family}`)
      );
    },
  },
  {
    slug: "outdoor-shoes",
    test: (name, family) => {
      if (isApparelName(name) || /\b(fleece|soft-?shell|overall)\b/.test(name)) return false;
      return family === "outdoor";
    },
  },
  {
    slug: "hockey-shoes",
    test: (name, family) => {
      if (isApparelName(name)) return false;
      return family === "hockey" || /\bhockey\b/.test(`${name} ${family}`);
    },
  },
  {
    slug: "volleyball-shoes",
    test: (name, family) =>
      /volley/.test(family) ||
      (/\bvolley(ball)?\b/.test(`${name} ${family}`) && !isApparelName(name)),
  },
  {
    slug: "comfort-shoes",
    test: (name, family) =>
      /^(comfort|comfort man|comfort woman|confort)/.test(family) ||
      (/\b(comfort|confort)\b/.test(family) && !isApparelName(name)),
  },
  {
    slug: "joma-flow",
    test: (name, family) => /\bjoma flow\b/.test(`${name} ${family}`),
  },
  {
    slug: "summer-shoes",
    test: (name, family) =>
      /\bsummer shoes?\b/.test(`${name} ${family}`) && !/\bsandal\b/.test(name),
  },
  {
    slug: "forloz",
    test: (name, family) => /\bforloz\b/.test(`${name} ${family}`),
  },
  {
    slug: "court-shoes",
    test: (name, family) =>
      /\b(tennis|padel|volley|indoor|court|cancha)\b/.test(`${name} ${family}`) &&
      !isApparelName(name),
  },
  {
    slug: "running-shoes",
    test: (name, family) =>
      /\b(running|trainer|r-city|r-night|r-nature)\b/.test(`${name} ${family}`) &&
      !isApparelName(name) &&
      !/\btrail\b/.test(family),
  },
  {
    slug: "training-shoes",
    test: (name, family) => {
      // Item family "Training" is also the Eagle Pro apparel line.
      if (isApparelName(name)) return false;
      if (/^(training|gym|sport|sports)$/.test(family)) return true;
      return (
        /\b(training|gym)\b/.test(family) &&
        (isFootwearName(name) || isDedicatedShoeFamily(family))
      );
    },
  },
  {
    slug: "sneakers",
    test: (name, family) =>
      isFootwearName(name) || isFootwearFamily(family) || isDedicatedShoeFamily(family),
  },
  {
    slug: "bras",
    test: (name, family) => /\b(bra|sport bra)\b/.test(name) || family.includes("bra"),
  },
  {
    slug: "leggings",
    test: (name, family) => /\blegging/.test(name) || family === "leggings",
  },
  {
    slug: "tights",
    // Sheet families like "Pants & Tights" must not override a shorts title.
    test: (name, family) => {
      const garment = name.replace(/pants\s*&\s*tights/gi, " ");
      if (isNamedShortNotTight(garment)) return false;
      return /\btights?\b/.test(garment) || family === "tights";
    },
  },
  {
    slug: "dresses",
    test: (name, family) => /\bdress/.test(name) || family.includes("dress"),
  },
  {
    slug: "skirts",
    test: (name, family) => /\bskirt/.test(name) || family.includes("skirt"),
  },
  {
    slug: "tracksuits",
    test: (name, family) => /\b(tracksuit|track suite|chandal)\b/.test(name) || family.includes("tracksuit"),
  },
  {
    slug: "hoodies",
    test: (name, family) =>
      /\b(hoodie|sweatshirt)\b/.test(name) || family.includes("hoodie") || family.includes("sweatshirt"),
  },
  {
    slug: "jackets",
    test: (name, family) =>
      /\b(jacket|anorak|raincoat|windbreaker|soft[- ]?shell|fleece|overall|parka)\b/.test(name) ||
      family.includes("jacket") ||
      family.includes("anorak") ||
      family.includes("raincoat") ||
      family.includes("fleece") ||
      family.includes("softshell") ||
      family.includes("soft shell"),
  },
  {
    slug: "sets",
    test: (name, family) => /\bset\b/.test(name) || family.includes("set"),
  },
  {
    slug: "polos",
    test: (name) => /\bpolo\b/.test(name),
  },
  {
    slug: "shorts",
    test: (name, family) => {
      if (isNamedShortsGarment(name)) return true;
      const fam = withoutSleeveWords(family);
      return fam === "shorts" || (fam.includes("short") && !/\b(shirt|tee|top)\b/.test(fam));
    },
  },
  {
    slug: "pants",
    test: (name, family) =>
      /\b(pants?|trousers?|sweatpants?)\b/.test(name) ||
      family.includes("pant") ||
      family.includes("trouser"),
  },
  {
    slug: "accessories",
    test: (name) => /\bbib\b/.test(name) && !/\b(shorts?|bermuda)\b/.test(name),
  },
  {
    slug: "socks",
    test: (name, family) => /\bsock/.test(name) || family === "socks",
  },
  {
    slug: "caps",
    test: (name, family) =>
      /\b(cap|hat|visor|beanie)\b/.test(name) || family === "caps",
  },
  {
    slug: "jerseys",
    test: (name, family) => /\b(jersey|match shirt)\b/.test(name) || family.includes("jersey"),
  },
  {
    slug: "tees-kids",
    test: (name, family) =>
      /\b(junior| jr\b|kids|child|baby|teen)\b/.test(`${name} ${family}`) &&
      /\b(t-shirt|tshirt|shirt|tee|top)\b/.test(name),
  },
  {
    slug: "tees",
    test: (name, family) =>
      /\b(t-shirts?|tshirts?|tee|sleeveless shirts?|short[- ]sleeve|long[- ]sleeved?|shirts?)\b/.test(
        name,
      ) ||
      family.includes("t-shirt") ||
      family.includes("tshirt"),
  },
  {
    slug: "tops",
    test: (name) => /\b(top|tank)\b/.test(name),
  },
];

export function classifyStorefrontSubcategory(
  product: Product,
  category = product.category,
): string {
  const family = itemFamily(product.item || "");
  const garment = garmentName(product);
  const name = `${product.displayName} ${product.name} ${product.item}`.toLowerCase();

  if (category === "brama") {
    if (/\b(leggings?|tights?)\b/.test(name)) {
      if (/\bshort\b/.test(name) && !/\blong\b/.test(name)) return "shorts";
      return "tights";
    }
    if (/\bshorts?\b/.test(name) && !/\b(shirt|jersey)\b/.test(name)) return "shorts";
    return "skins";
  }

  if (category === "rugby") {
    if (/\b(helmet|protection|protec|scrum cap)\b/.test(name)) return "protection";
    if (BALL_RE.test(name)) return "balls";
    if (/\bshorts?\b|\bbermuda\b/.test(name) && !/\b(shirt|jersey|tee)\b/.test(name)) {
      return "shorts";
    }
    return "jerseys";
  }

  if (isNamedShortNotTight(garment)) return "shorts";
  if (/\bbib\b/.test(garment) && !/\b(shorts?|bermuda)\b/.test(garment)) {
    return "accessories";
  }

  for (const rule of SUB_RULES) {
    if (rule.test(name, family)) {
      const shoeOnly = new Set([
        "sneakers",
        "kids-shoes",
        "barefoot",
        "sandals",
        "court-shoes",
        "running-shoes",
        "trail-running",
        "training-shoes",
        "tennis-shoes",
        "padel-shoes",
        "pickleball-shoes",
        "handball-shoes",
        "badminton-shoes",
        "basketball-shoes",
        "outdoor-shoes",
        "hockey-shoes",
        "volleyball-shoes",
        "comfort-shoes",
        "joma-flow",
        "summer-shoes",
        "forloz",
        "futsal",
        "turf",
        "football-fg",
        "football-ag",
        "football-sg",
      ]);
      if (shoeOnly.has(rule.slug) && category !== "shoes" && category !== "football") {
        const sportShoeHubs: Record<string, readonly string[]> = {
          "hockey-shoes": ["hockey"],
          "padel-shoes": ["padel"],
          "outdoor-shoes": ["hiking"],
          "basketball-shoes": ["basketball"],
          "running-shoes": ["running-fitness"],
          "trail-running": ["running-fitness", "hiking"],
          "training-shoes": ["running-fitness"],
          sneakers: ["lifestyle"],
          "tennis-shoes": ["padel"],
        };
        const allowedOnHub = sportShoeHubs[rule.slug]?.includes(category);
        if (!allowedOnHub) {
          if (rule.slug.startsWith("football") || rule.slug === "futsal" || rule.slug === "turf") {
            if (category !== "football" && category !== "shoes") continue;
          } else if (category !== "shoes") {
            continue;
          }
        }
      }
      if (rule.slug === "boots" && category !== "football" && category !== "shoes") continue;
      return rule.slug;
    }
  }
  return "general";
}

function isCatalogBall(name: string) {
  if (isBagName(name)) return false;
  if (/long pants ball/.test(name)) return false;
  if (/\b(pants?|trousers?)\b/.test(name)) return false;
  return BALL_RE.test(name);
}

function isCatalogRacket(name: string, family: string) {
  if (isBagName(name) || isApparelName(name)) return false;
  return (
    /\b(racket|pickleball paddle)\b/.test(name) ||
    family.includes("paddle racket") ||
    family.includes("pickleball paddle")
  );
}

function isCatalogApparel(name: string) {
  if (isBagName(name) || isCatalogBall(name) || isFootwearName(name)) return false;
  if (/\b(helmet|shin guard|goggle|racket)\b/.test(name)) return false;
  return isApparelName(name);
}

function isRunningFootwear(name: string, family: string, subcategory?: string) {
  if (subcategory === "running-shoes" || subcategory === "training-shoes") return true;
  if (/^(running man|running woman|junior running|trail running|trail man|trail woman)$/.test(family)) {
    return true;
  }
  return /\brunning\b/.test(name) && isFootwearName(name);
}

/**
 * Sport / campaign hub this SKU belongs to, independent of type hubs.
 * Used so a football boot still lists on Football when Shoes is also tagged.
 */
export function classifySportHub(product: Product): string | undefined {
  const blob = textBlob(product);
  const family = itemFamily(product.item || "");
  const name = `${product.displayName} ${product.name}`.toLowerCase();

  if (word(blob, "cricket") || family === "cricket") return "cricket";
  if (word(blob, "hockey") || family === "hockey") return "hockey";
  const leafHub = jomaLeafHub(product.code);
  if (leafHub) return leafHub;
  if (
    word(blob, "rugby", "skrum", "scrum") ||
    family === "rugby" ||
    family === "skrum" ||
    isRugbyHookShort(name)
  ) {
    return "rugby";
  }
  if (word(blob, "brama") || family === "brama" || family === "brama line") return "brama";
  if (
    family.includes("mundial 2026") ||
    family === "montreal 2026" ||
    /\b(mundial 2026|montreal 2026|world cup 2026|teampro)\b/.test(blob)
  ) {
    return "teampro-2026";
  }
  if (word(blob, "resort") || family === "resort") return "resort";
  if (family === "lifestyle") return "lifestyle";
  if (
    family === "outdoor" ||
    family.startsWith("outdoor") ||
    word(blob, "hiking", "trek", "trekking")
  ) {
    return "hiking";
  }
  if (word(blob, "padel") || family.includes("padel")) return "padel";
  if (isCombatBoxingShort(name)) return "boxing";
  if (isSwimPiece(name, family)) return "swimming";
  if (word(blob, "netball") || family === "netball") return "netball";
  if (word(blob, "basketball") || /\bbasket\b/.test(family)) return "basketball";
  if (
    isFootballBootFamily(family) ||
    isFootballBootName(name) ||
    word(blob, "football", "soccer") ||
    family === "football"
  ) {
    return "football";
  }
  if (isRunningFootwear(name, family, product.subcategory)) return "running-fitness";
  return undefined;
}

/**
 * Extra hubs besides `category` so sport kit still appears on type hubs
 * (Shoes / Balls & Bags / Sportswear) and type-primary SKUs still appear
 * on their sport hub (Football boots on Football AND Shoes, etc.).
 */
export function classifyExtraHubs(product: Product, category = product.category): string[] {
  const family = itemFamily(product.item || "");
  const name = `${product.displayName} ${product.name}`.toLowerCase();
  const extra = new Set<string>();

  if (isCatalogBall(name) && category !== "balls-bags") extra.add("balls-bags");
  if (
    (isBagName(name) || family === "backpacks" || family === "bag" || isCatalogRacket(name, family)) &&
    category !== "balls-bags"
  ) {
    extra.add("balls-bags");
  }
  if (isStorefrontFootwear({ ...product, category }) && category !== "shoes") extra.add("shoes");
  if (isCatalogApparel(name) && category !== "sportswear" && isSportHub(category)) {
    extra.add("sportswear");
  }

  const sport = classifySportHub(product);
  if (sport && sport !== category) extra.add(sport);

  extra.delete(category);
  return [...extra];
}

export { hasUsableProductImage };

export function withStorefrontCategory<T extends Product>(product: T): T {
  return withStorefrontMerchandising(product);
}

function applyRetailPrice<T extends Product>(product: T): T {
  if (isFixedBibPack(product)) {
    if (product.price === BIB_PACK_PRICE_NAD && product.unitPrice === BIB_PACK_PRICE_NAD) {
      return product;
    }
    return { ...product, price: BIB_PACK_PRICE_NAD, unitPrice: BIB_PACK_PRICE_NAD };
  }
  const rounded = roundNad(Number(product.unitPrice) || Number(product.price));
  if (rounded === product.price && rounded === product.unitPrice) return product;
  return { ...product, price: rounded, unitPrice: rounded };
}

/** Remove a previously baked trailing pack suffix from display fields. */
function stripPackSuffix<T extends Product>(product: T): T {
  const strip = (s: string) =>
    s
      .replace(/\s*·\s*pack of \d+\s*$/i, "")
      .replace(/\s*·\s*assortment pack\s*$/i, "")
      .replace(/\s*·\s*multipack\s*$/i, "")
      .replace(/\s*·\s*pack\s*$/i, "")
      .trim();
  const displayName = strip(product.displayName);
  const title = strip(product.title);
  if (displayName === product.displayName && title === product.title) return product;
  return { ...product, displayName, title };
}

function applyPackTitle<T extends Product>(product: T): T {
  // Bake stores locale-neutral base names only: strip any previously baked
  // pack suffix so FR/EN render paths (packTitleSuffix) own the wording.
  // Idempotent across repeated bakes.
  return stripPackSuffix(product);
}


export function withStorefrontMerchandising<T extends Product>(product: T): T {
  const category = classifyStorefrontCategory(product);
  const classified = category === product.category ? product : { ...product, category };
  const subcategory = classifyStorefrontSubcategory(classified, category);
  const hubs = classifyExtraHubs(classified, category);
  const withoutHubs = { ...product };
  delete withoutHubs.hubs;
  let next = {
    ...withoutHubs,
    category,
    subcategory,
    ...(hubs.length ? { hubs } : {}),
  } as T;
  next = applyRetailPrice(next);
  next = applyPackTitle(next);
  next = withCatalogSizes(next);
  next = withProductImages(next);
  const description = productDescription(next);
  if (next.description === description) return next;
  return { ...next, description };
}

export function withStorefrontCategories<T extends Product>(catalog: T[]): T[] {
  applyInferredSurtidoAssortments(catalog);
  return catalog.map(withStorefrontMerchandising);
}

/** True when the SKU is actual footwear — never clothing, socks, or bags. */
export function isStorefrontFootwear(product: Product) {
  const family = itemFamily(product.item || "");
  const name = `${product.displayName} ${product.name}`.toLowerCase();
  if (isBagName(name) || isApparelOnly(name)) return false;
  if (
    product.subcategory === "boots" ||
    product.subcategory === "kids-shoes" ||
    product.subcategory === "futsal" ||
    product.subcategory === "turf" ||
    product.subcategory === "football-fg" ||
    product.subcategory === "football-ag" ||
    product.subcategory === "football-sg" ||
    product.subcategory === "trail-running" ||
    product.subcategory === "tennis-shoes" ||
    product.subcategory === "padel-shoes" ||
    product.subcategory === "pickleball-shoes" ||
    product.subcategory === "handball-shoes" ||
    product.subcategory === "badminton-shoes" ||
    product.subcategory === "basketball-shoes" ||
    product.subcategory === "outdoor-shoes" ||
    product.subcategory === "hockey-shoes" ||
    product.subcategory === "volleyball-shoes" ||
    product.subcategory === "comfort-shoes" ||
    product.subcategory === "joma-flow" ||
    product.subcategory === "summer-shoes" ||
    product.subcategory === "forloz"
  ) {
    return true;
  }
  if (product.category === "shoes") return true;
  return (
    isFootwearFamily(family) ||
    isDedicatedShoeFamily(family) ||
    isFootwearName(name) ||
    isFootballBootFamily(family) ||
    isFootballBootName(name)
  );
}

function sampleScore(product: Product, slug?: string) {
  const n = `${product.displayName} ${product.item}`.toLowerCase();
  let score = 1;
  if (/\b(jersey|shirt|polo|short|bermuda|dress|sneaker|shoe|swim|boot|bag|ball)\b/.test(n)) {
    score += 4;
  }
  if (/\b(helmet|nail|gps)\b/.test(n)) score -= 4;
  // Prefer lighter/colourful shots so dark tiles do not look empty.
  if (/\b(white|yellow|red|green|blue|navy|royal|orange|pink)\b/.test(n)) score += 3;
  if (/\bblack\b/.test(n) && !/\b(white|yellow|red|green)\b/.test(n)) score -= 2;

  if (slug === "shoes") {
    if (!isStorefrontFootwear(product) || isApparelOnly(n)) score -= 30;
    if (HARD_FOOTWEAR_RE.test(n) || /\b(sneaker|barefoot|cleat|trainer)\b/.test(n)) score += 10;
    if (/\b(junior| jr\b|kids|baby)\b/.test(n)) score -= 8;
    if (/\bsneaker\b/.test(n) || /^sneaker/.test(itemFamily(product.item || ""))) score += 8;
    if (/\bboot\b/.test(n) || product.subcategory === "boots") score -= 6;
    if (/^barefoot/.test(itemFamily(product.item || ""))) score -= 4;
  }
  if (slug === "rugby") {
    if (/\b(helmet|protection|protec)\b/.test(n)) score -= 12;
    if (/\b(skrum|stone rugby|olimpiada rugby|hook)\b/.test(n)) score += 8;
    if (/\b(jersey|shirt|short)\b/.test(n)) score += 4;
  }
  if (slug === "brama") {
    if (!/\bbrama\b/.test(n)) score -= 8;
    if (/\b(tights?|leggings?|skin|fleece|base)\b/.test(n)) score += 8;
    if (/\bshorts?\b/.test(n) && !/\b(tights?|leggings?)\b/.test(n)) score -= 4;
  }
  if (slug === "padel") {
    if (isBagName(n)) score -= 12;
    if (/\b(shirt|polo|short|shoe|sneaker|racket)\b/.test(n)) score += 8;
  }
  if (slug === "hiking") {
    if (/\b(explorer|outdoor|jacket|trouser|trek)\b/.test(n)) score += 6;
    if (/\b(trail running)\b/.test(n)) score -= 4;
  }
  if (slug === "lifestyle") {
    if (!isStorefrontFootwear(product) || isApparelOnly(n)) score -= 20;
    if (/\b(sneaker|shoe)\b/.test(n) || /^lifestyle/.test(itemFamily(product.item || ""))) {
      score += 10;
    }
  }
  if (slug === "resort") {
    if (/\bresort\b/.test(n) && /\b(polo|shirt|sweat|jacket)\b/.test(n)) score += 8;
  }
  if (slug === "teampro-2026") {
    if (/\b(montreal|mundial|2026)\b/.test(n) && /\b(shirt|polo|tee)\b/.test(n)) score += 8;
  }
  return score;
}

export function sampleFromList(list: Product[], slug?: string): Product | undefined {
  const pool = list.filter(hasUsableProductImage);
  if (!pool.length) return undefined;
  return [...pool].sort((a, b) => sampleScore(b, slug) - sampleScore(a, slug))[0];
}

/** Prefer an in-hub SKU with a real photo; skip empty-image placeholders. */
export function sampleForCategory(
  catalog: Product[],
  slug: string,
): Product | undefined {
  let bySlug = sampleCategoryCache.get(catalog);
  if (!bySlug) {
    bySlug = new Map();
    sampleCategoryCache.set(catalog, bySlug);
  }
  if (bySlug.has(slug)) return bySlug.get(slug);

  let inHub = catalog.filter((p) => productInHub(p, slug) && hasUsableProductImage(p));
  if (slug === "shoes") {
    inHub = inHub.filter(isStorefrontFootwear);
  }
  const sample = inHub.length ? sampleFromList(inHub, slug) : undefined;
  bySlug.set(slug, sample);
  return sample;
}

const sampleCategoryCache = new WeakMap<Product[], Map<string, Product | undefined>>();

export function firstImagedProduct(list: Product[]) {
  return list.find(hasUsableProductImage);
}

export type TaxonomySub = { slug: string; name: string; count: number };
export type Taxonomy = Record<string, TaxonomySub[]>;
