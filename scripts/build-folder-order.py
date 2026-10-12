#!/usr/bin/env python3
"""Build ordered per-folder product codes from the supplier audit.

Leaf membership comes from the audit's collection comparison when the
extra/missing code lists are complete. Over-inclusive leaves whose extra
list was truncated fall back to products filed under that collection title
(`item`), plus any codes the audit named. Parent folders are not stored;
the storefront concatenates children in tree order.

Does not read or write prices, stock, or images.
"""
from __future__ import annotations

import csv
import json
import re
import sys
import unicodedata
from collections import defaultdict

ROOT_PRODUCTS = "/workspace/data/products.json"
ROOT_FOLDERS = "/workspace/data/product-folders.json"
ROOT_META = "/workspace/data/joma-folder-meta.json"
DEFAULT_AUDIT = "/home/ubuntu/.cursor/projects/workspace/uploads/audit4-nodes-2026-10-12_79e8.csv"
OUT = "/workspace/data/folder-collection-order.json"
# Audit 4 measured the storefront at this commit. Re-runs must keep using
# that keyword membership, not the file this script writes.
BASELINE_FOLDERS_REV = "eef7753"

# Woman apparel roots, same set as lib/joma-folder-meta.ts.
WOMAN_APPAREL_ROOTS = frozenset({
    "teamwear-woman",
    "running-trail-woman",
    "racket-sports-woman",
    "fitness-gym-woman",
    "lifestyle-apparel-woman",
    "underwear-brama-woman",
    "aguila-line",
    "resort",
    "beachwear",
    "athletes-combat",
    "elite-club",
    "cycling",
    "hiking-outdoor",
    "teamwear-pro-2026",
})
WOMEN_CODED_SUBS = frozenset({"dresses", "skirts", "bras", "swimwear"})
KIDS_NAME = re.compile(r"\b(junior| jr\b|kids|child|baby|youth|teen)\b", re.I)
WOMEN_NAME = re.compile(r"\b(lady|ladies|women|woman|female|womens)\b", re.I)
MEN_NAME = re.compile(r"\b(men|man|male|mens)\b", re.I)

ORPHAN_PLACEMENT = {
    # Wristband packs. Sheet collection is Accessories; no leaf is named that
    # collection, so they sit on the accessories hub (aggregated after children).
    "400245.P04": ["accessories"],
    "400300.P04": ["accessories"],
    # Hard-ground football boots, same surface as the other Soccer HG rows.
    "EVJS2617HG": ["football-fg"],
    "TOJS2603HG": ["football-fg"],
    # Indoor foot-shape pack named on the futsal collection.
    "FOTOPW2602IN": ["futsal", "se-football-futsal", "special-editions"],
    # Pickleball packs. Sibling colorways in this sheet were unplaced too.
    "PICKW2612": ["pickleball", "acc-palas-pickleball"],
    "PSTROW2601": ["pickleball", "acc-palas-pickleball"],
    "PSTROW2612": ["pickleball", "acc-palas-pickleball"],
}


def norm(value: str) -> str:
    text = unicodedata.normalize("NFD", value.lower())
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return re.sub(r"\s+", " ", text).strip()


def codes(value: str) -> list[str]:
    return [part for part in (value or "").split() if part]


def showable(product: dict) -> bool:
    if product.get("available") is False:
        return False
    return bool(product.get("imageUrl") or (product.get("images") or [None])[0])


def _walk(parent: dict[str, str | None], key: str, pred) -> bool:
    cur: str | None = key
    seen: set[str] = set()
    while cur and cur not in seen:
        if pred(cur):
            return True
        seen.add(cur)
        cur = parent.get(cur)
    return False


# Same exception as lib/audience.ts KIDS_PACK_CODES.
KIDS_PACK_CODES = frozenset({"500480.322", "500680.579", "500680.715"})


def is_kids_product(product: dict) -> bool:
    """Same rules as lib/audience.ts isKidsProduct."""
    if product.get("code") in KIDS_PACK_CODES:
        return True
    if product.get("gender") == "kids":
        return True
    if product.get("subcategory") in ("tees-kids", "jackets-kids", "kids-shoes"):
        return True
    blob = f"{product.get('displayName') or ''} {product.get('name') or ''} {product.get('item') or ''}".lower()
    if KIDS_NAME.search(blob):
        return True
    if product.get("category") != "shoes":
        return False
    if re.match(r"^J[A-Z]", product.get("code") or "", re.I):
        return True
    nums: list[float] = []
    for size in product.get("sizeOptions") or []:
        try:
            nums.append(float(size))
        except (TypeError, ValueError):
            continue
    return bool(nums) and max(nums) <= 35


def product_audience(product: dict) -> str:
    if is_kids_product(product):
        return "kids"
    blob = (
        f"{product.get('displayName') or ''} {product.get('name') or ''} "
        f"{product.get('item') or ''} {product.get('title') or ''}"
    ).lower()
    if product.get("gender") == "women" or WOMEN_NAME.search(blob):
        return "women"
    if product.get("gender") == "men" or MEN_NAME.search(blob):
        return "men"
    return "unisex"


def make_matcher(parent: dict[str, str | None]):
    """Audience check matching lib/audience.ts matchesAudienceInFolder."""

    def matches(product: dict, aud: str, key: str) -> bool:
        if not aud or aud == "all":
            return True
        resolved = product_audience(product)
        woman = _walk(parent, key, lambda cur: cur in WOMAN_APPAREL_ROOTS)
        if woman and aud in ("men", "women"):
            if resolved == "kids":
                return False
            if aud == "women":
                return resolved in ("women", "unisex")
            if _walk(parent, key, lambda cur: cur == "teamwear-pro-2026"):
                return resolved in ("men", "unisex")
        if aud == "kids":
            return resolved == "kids"
        if aud == "women":
            return resolved == "women"
        if aud == "men":
            if resolved == "men":
                return True
            return resolved == "unisex" and (product.get("subcategory") or "") not in WOMEN_CODED_SUBS
        if aud == "adult":
            return resolved != "kids"
        return True

    return matches


def main() -> None:
    audit_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_AUDIT
    import subprocess

    products = json.load(open(ROOT_PRODUCTS))
    # Keyword folders on main are the baseline the audit measured. Re-running
    # this script must not read the file it previously wrote.
    folders = json.loads(
        subprocess.check_output(
            ["git", "show", f"{BASELINE_FOLDERS_REV}:data/product-folders.json"],
            cwd="/workspace",
        )
    )
    meta = json.load(open(ROOT_META))
    rows = list(csv.DictReader(open(audit_path)))

    by_id = {product["id"]: product for product in products}
    by_code = {product["code"]: product for product in products}
    catalog_index = {product["code"]: index for index, product in enumerate(products)}

    parent: dict[str, str | None] = {}
    children: dict[str, list[str]] = defaultdict(list)
    leaves: list[str] = []
    seen_leaf: set[str] = set()
    has_children: dict[str, bool] = {}
    for row in meta:
        key = row["key"]
        has_children[key] = bool(row["hasChildren"])
        if key not in parent:
            parent[key] = row["parent"]
        if row["parent"] and key not in children[row["parent"]]:
            children[row["parent"]].append(key)
        if not row["hasChildren"] and key not in seen_leaf:
            seen_leaf.add(key)
            leaves.append(key)

    current: dict[str, list[str]] = defaultdict(list)
    for product in products:
        for key in folders.get(product["id"], []):
            current[key].append(product["code"])

    def showable_count(key: str) -> int:
        return sum(1 for code in current[key] if code in by_code and showable(by_code[code]))

    by_key: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        if row["status"] == "empty":
            continue
        by_key[row["key"]].append(row)

    def choose(key: str) -> dict | None:
        options = by_key.get(key) or []
        if not options:
            return None
        local = showable_count(key)

        def rank(row: dict) -> tuple:
            live = int(row["live_count"] or 0)
            return (abs(live - local), -float(row["jaccard"] or 0))

        return min(options, key=rank)

    leaf_lists: dict[str, list[str]] = {}
    stats = {
        "reconstructed": 0,
        "filed": 0,
        "trimmed": 0,
        "kept": 0,
    }

    def ordered_unique(seq: list[str]) -> list[str]:
        seen: set[str] = set()
        out: list[str] = []
        for code in seq:
            if code in seen or code not in by_code:
                continue
            seen.add(code)
            out.append(code)
        return out

    matches_audience = make_matcher(parent)

    def showable_len(seq: list[str]) -> int:
        return sum(1 for code in seq if showable(by_code[code]))

    def complete_target(key: str, row: dict, existing: list[str]) -> list[str] | None:
        listed_extra = codes(row["extra"])
        listed_missing = codes(row["missing"])
        if len(listed_extra) != int(row["extra_n"] or 0):
            return None
        if len(listed_missing) != int(row["missing_n"] or 0):
            return None
        extra = set(listed_extra)
        kept = []
        for code in existing:
            product = by_code.get(code)
            if not product or code in extra:
                continue
            if not matches_audience(product, row["aud"], key):
                continue
            kept.append(code)
        return ordered_unique(kept + [code for code in listed_missing if code in by_code])

    def showable_matching(seq: list[str], aud: str, key: str) -> list[str]:
        out: list[str] = []
        seen_codes: set[str] = set()
        for code in seq:
            if code in seen_codes:
                continue
            product = by_code.get(code)
            if not product or not showable(product) or not matches_audience(product, aud, key):
                continue
            seen_codes.add(code)
            out.append(code)
        return out

    def choose_membership(key: str, existing: list[str], pairs: list[tuple[dict, list[str]]]) -> list[str]:
        """Pick the code list that matches the most complete audience rows.

        A shared folder is one list filtered per audience. When two collections
        disagree on a product both audiences can see, prefer the audience that
        lets more rows match. Otherwise keep a product only when every audience
        it belongs to includes it.
        """
        targets = {row["aud"]: target for row, target in pairs}
        universe: list[str] = []
        seen_codes: set[str] = set()
        for _, target in pairs:
            for code in target:
                if code not in seen_codes:
                    seen_codes.add(code)
                    universe.append(code)
        target_sets = {aud: set(target) for aud, target in targets.items()}

        def assemble(prefer: str | None) -> list[str]:
            chosen: set[str] = set()
            for code in universe:
                product = by_code[code]
                matching = [aud for aud in targets if matches_audience(product, aud, key)]
                if not matching:
                    continue
                if prefer and prefer in matching:
                    if code in target_sets[prefer]:
                        chosen.add(code)
                    continue
                if all(code in target_sets[aud] for aud in matching):
                    chosen.add(code)
            out = [code for code in existing if code in chosen]
            have = set(out)
            for code in universe:
                if code in chosen and code not in have:
                    out.append(code)
                    have.add(code)
            return out

        def row_score(seq: list[str]) -> int:
            matched = 0
            for row, target in pairs:
                pred = showable_matching(seq, row["aud"], key)
                tgt = showable_matching(target, row["aud"], key)
                if set(pred) == set(tgt):
                    matched += 1
            return matched

        best: list[str] | None = None
        best_rank: tuple | None = None
        for prefer in [None, *targets.keys()]:
            seq = assemble(prefer)
            jaccard = 0.0
            if prefer:
                jaccard = max(
                    float(row["jaccard"] or 0) for row, _target in pairs if row["aud"] == prefer
                )
            rank = (row_score(seq), jaccard, len(seq))
            if best is None or best_rank is None or rank > best_rank:
                best = seq
                best_rank = rank
        return best or []

    for key in leaves:
        row = choose(key)
        existing = list(current.get(key, []))
        if row is None:
            leaf_lists[key] = ordered_unique(existing)
            stats["kept"] += 1
            continue

        pairs: list[tuple[dict, list[str]]] = []
        incomplete: list[dict] = []
        for option in by_key.get(key) or []:
            target = complete_target(key, option, existing)
            if target is None:
                incomplete.append(option)
            else:
                pairs.append((option, target))

        if pairs:
            seq = choose_membership(key, existing, pairs)
            covered = {option["aud"] for option, _target in pairs}
            have = set(seq)
            # Incomplete audiences keep the products the complete lists do not
            # already decide, minus the extras the audit named.
            known_extra: set[str] = set()
            known_missing: list[str] = []
            for option in incomplete:
                known_extra.update(codes(option["extra"]))
                known_missing.extend(code for code in codes(option["missing"]) if code in by_code)
            for code in existing:
                if code in have or code in known_extra:
                    continue
                product = by_code[code]
                if any(matches_audience(product, aud, key) for aud in covered):
                    continue
                seq.append(code)
                have.add(code)
            for code in known_missing:
                if code in have:
                    continue
                product = by_code[code]
                if any(matches_audience(product, aud, key) for aud in covered):
                    continue
                seq.append(code)
                have.add(code)
            leaf_lists[key] = seq
            stats["reconstructed"] += 1
            continue

        extra = set(codes(row["extra"]))
        missing = [code for code in codes(row["missing"]) if code in by_code]
        title = row["joma_title"]
        jaccard = float(row["jaccard"] or 0)
        extra_n = int(row["extra_n"] or 0)
        trimmed = ordered_unique([code for code in existing if code not in extra] + missing)
        filed: list[str] = []
        if extra_n > 30 and jaccard < 0.5 and title:
            filed = [
                product["code"]
                for product in products
                if product.get("item") == title and product["code"] not in extra
            ]
            filed = ordered_unique(filed + missing)
        target_n = int(row["joma_showable"] or 0)
        if filed and abs(showable_len(filed) - target_n) < abs(showable_len(trimmed) - target_n):
            leaf_lists[key] = filed
            stats["filed"] += 1
            continue

        leaf_lists[key] = trimmed
        stats["trimmed"] += 1

    # Explicit pack placement. Appended so an earlier reconstruction still
    # wins position when the code was already listed.
    placed_orphans: dict[str, list[str]] = {}
    for code, keys in ORPHAN_PLACEMENT.items():
        if code not in by_code:
            print("missing orphan", code)
            continue
        for key in keys:
            bucket = leaf_lists.setdefault(key, [])
            if code not in bucket:
                bucket.append(code)
                placed_orphans.setdefault(code, []).append(key)

    # Age-band folders are themselves a filing (1-4 years, 5-8, teen). Keep
    # those codes on the parent even when no child leaf owns them.
    age_families = {
        "kids-1-4": ("1-4 years",),
        "kids-6-10": ("5-8 years boy", "5-8 years girl"),
        "kids-12-14-boy": ("teen boy",),
        "kids-12-14-girl": ("teen girl",),
    }
    for key, families in age_families.items():
        wanted = {norm(family) for family in families}
        direct = [
            product["code"]
            for product in products
            if norm(re.sub(r"\s*\[\d+\]\s*$", "", product.get("item") or "")) in wanted
        ]
        if direct:
            leaf_lists[key] = ordered_unique(direct)

    # Wristbands recorded above may have been skipped if accessories was
    # created empty after ORPHAN_PLACEMENT. Re-apply those two.
    for code, keys in ORPHAN_PLACEMENT.items():
        if code not in by_code:
            continue
        for key in keys:
            bucket = leaf_lists.setdefault(key, [])
            if code not in bucket:
                bucket.append(code)

    json.dump(leaf_lists, open(OUT, "w"), separators=(",", ":"))
    open(OUT, "a").write("\n")

    # Product → folder keys (each list the code sits on, plus ancestors).
    # Parent order is derived at runtime by concatenating children.
    code_keys: dict[str, list[str]] = defaultdict(list)
    for key, seq in leaf_lists.items():
        chain: list[str] = []
        cur: str | None = key
        guard: set[str] = set()
        while cur and cur not in guard:
            guard.add(cur)
            chain.append(cur)
            cur = parent.get(cur)
        for code in seq:
            bucket = code_keys[code]
            for item in chain:
                if item not in bucket:
                    bucket.append(item)
    folder_map: dict[str, list[str]] = {}
    for product in products:
        folder_map[product["id"]] = code_keys.get(product["code"], [])
    json.dump(folder_map, open(ROOT_FOLDERS, "w"), separators=(",", ":"))
    open(ROOT_FOLDERS, "a").write("\n")

    orphan_hits = {}
    for code in ORPHAN_PLACEMENT:
        orphan_hits[code] = [
            key for key, seq in leaf_lists.items() if code in seq
        ]
    print(json.dumps({
        "leaves": len(leaf_lists),
        "stats": stats,
        "orphans": orphan_hits,
    }, indent=2))


if __name__ == "__main__":
    main()
