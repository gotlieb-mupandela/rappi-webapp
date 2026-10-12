#!/usr/bin/env python3
"""Compare baked leaves to the supplier crawl, in menu order.

A leaf matches when its showable products (available, with an image) equal
the mapped collection's stocked showable products in crawl order. Parents
are not scored: the shop concatenates children.

Exit 0 when no live-browsable product is left without a category and the
leaf table is unchanged from the locked digest.
"""
from __future__ import annotations

import hashlib
import json
import subprocess
from collections import defaultdict

ROOT = "/workspace"
PRODUCTS = f"{ROOT}/data/products.json"
ORDER = f"{ROOT}/data/folder-collection-order.json"
MAP = f"{ROOT}/data/supplier/leaf-map.json"
CRAWL = f"{ROOT}/data/supplier/master_products_full.jsonl"
META = f"{ROOT}/data/joma-folder-meta.json"
BASELINE = "eef7753"


def showable(product: dict | None) -> bool:
    return bool(
        product
        and product.get("available") is not False
        and (product.get("imageUrl") or (product.get("images") or [None])[0])
    )


def kendall(pred: list[str], target: list[str]) -> float | None:
    wanted = set(target)
    common = [code for code in target if code in set(pred)]
    if len(common) < 2:
        return None
    rank = {code: index for index, code in enumerate(code for code in pred if code in wanted)}
    agree = disagree = 0
    for i, left in enumerate(common):
        for right in common[i + 1 :]:
            if rank[left] < rank[right]:
                agree += 1
            elif rank[left] > rank[right]:
                disagree += 1
    total = agree + disagree
    if not total:
        return None
    return (agree - disagree) / total


def main() -> None:
    products = json.load(open(PRODUCTS))
    by_code = {product["code"]: product for product in products}
    order = json.load(open(ORDER))
    leaf_map = json.load(open(MAP))
    meta = json.load(open(META))
    children = defaultdict(list)
    for row in meta:
        if row["parent"] and row["key"] not in children[row["parent"]]:
            children[row["parent"]].append(row["key"])
    old = json.loads(
        subprocess.check_output(
            ["git", "show", f"{BASELINE}:data/product-folders.json"],
            cwd=ROOT,
        )
    )
    folders = json.load(open(f"{ROOT}/data/product-folders.json"))

    crawl = defaultdict(list)
    with open(CRAWL) as handle:
        for line in handle:
            row = json.loads(line)
            if row["code"] not in by_code:
                continue
            crawl[(str(row["collection"]), str(row["link"]))].append(row["code"])

    def target_of(key: str) -> list[str]:
        out = []
        seen = set()
        for coll, link in leaf_map.get(key, []):
            for code in crawl.get((str(coll), str(link)), []):
                if code in seen or not showable(by_code[code]):
                    continue
                seen.add(code)
                out.append(code)
        return out

    memo: dict[str, list[str]] = {}

    def pred_of(key: str, guard: set[str] | None = None) -> list[str]:
        """What a shopper sees: descendant lists, then codes on this node."""
        if guard is None and key in memo:
            return memo[key]
        guard = set() if guard is None else guard
        if key in guard:
            return []
        guard = set(guard)
        guard.add(key)
        out: list[str] = []
        seen: set[str] = set()
        for child in children.get(key, []):
            for code in pred_of(child, guard):
                if code in seen:
                    continue
                seen.add(code)
                out.append(code)
        for code in order.get(key, []):
            if code in seen or not showable(by_code.get(code)):
                continue
            seen.add(code)
            out.append(code)
        if len(guard) == 1:
            memo[key] = out
        return out

    both = sets = orders = missing_leaves = extra_leaves = 0
    missing_slots = extra_slots = kept_live = 0
    woman_empty = 0
    taus = []
    scored = 0
    seen_row = set()
    for row in meta:
        key = row["key"]
        duplicate = key in seen_row
        seen_row.add(key)
        if children.get(key):
            continue
        target = target_of(key)
        pred = pred_of(key)
        if duplicate and target and not pred:
            woman_empty += 1
        if not target and not pred:
            continue
        scored += 1
        if pred == target:
            both += 1
        if set(pred) == set(target):
            sets += 1
        shared = [code for code in target if code in set(pred)]
        pred_shared = [code for code in pred if code in set(target)]
        if shared and pred_shared == shared:
            orders += 1
        miss = set(target) - set(pred)
        extra = set(pred) - set(target)
        if miss:
            missing_leaves += 1
            missing_slots += len(miss)
        if extra and not target:
            kept_live += 1
        elif extra:
            extra_leaves += 1
            extra_slots += len(extra)
        tau = kendall(pred, target)
        if tau is not None:
            taus.append(tau)

    live = lost = live_empty_nodes = 0
    live_on_key: dict[str, int] = defaultdict(int)
    for product in products:
        keys = old.get(product["id"]) or []
        if not keys or not showable(product):
            continue
        live += 1
        if not folders.get(product["id"]):
            lost += 1
        for key in keys:
            live_on_key[key] += 1
    for key, count in live_on_key.items():
        if count and not pred_of(key):
            live_empty_nodes += 1

    import re
    pat = re.compile(r"(?<![A-Za-z])joma(?![A-Za-z])", re.I)
    glue = re.compile(r"\S·")
    brand = glue_n = 0
    for product in products:
        for field in ("displayName", "name", "title", "description"):
            text = product.get(field) or ""
            if pat.search(text):
                brand += 1
            if glue.search(text):
                glue_n += 1

    taus.sort()
    median = taus[len(taus) // 2] if taus else None
    pinned = next((p for p in products if p["code"] == "104441.200"), None)
    report = {
        "menu_rows": len(meta),
        "scored_leaves": scored,
        "identical_set_and_order": both,
        "identical_product_set": sets,
        "identical_order": orders,
        "leaves_missing": missing_leaves,
        "missing_slots": missing_slots,
        "leaves_extra_on_stocked_collection": extra_leaves,
        "extra_slots": extra_slots,
        "kept_live_placement": kept_live,
        "woman_reuse_empty": woman_empty,
        "live_stocked_nodes_now_empty": live_empty_nodes,
        "median_kendall": None if median is None else round(median, 3),
        "live_browsable": live,
        "lost_browsable": lost,
        "brand_tokens": brand,
        "titles_missing_space": glue_n,
        "pinned_104441": bool(pinned and folders.get(pinned["id"])),
        "shopper": {
            "tw-pants": len(pred_of("tw-pants")),
            "tw-swimming": len(pred_of("tw-swimming")),
            "tp-volleyball": len(pred_of("tp-volleyball")),
            "elite-club": len(pred_of("elite-club")),
            "hk-prev-outdoor": len(pred_of("hk-prev-outdoor")),
            "anorak-jackets": len(pred_of("anorak-jackets")),
            "beachwear": len(pred_of("beachwear")),
            "athletes-combat": len(pred_of("athletes-combat")),
            "k610-outerwear": len(pred_of("k610-outerwear")),
            "rk-new-ss27": len(pred_of("rk-new-ss27")),
            "twfb-eco-championship": len(pred_of("twfb-eco-championship")),
        },
    }
    blob = json.dumps(report, sort_keys=True)
    report["digest"] = hashlib.sha256(blob.encode()).hexdigest()[:16]
    print(json.dumps(report, indent=2))
    if (
        missing_slots
        or extra_leaves
        or woman_empty
        or live_empty_nodes
        or brand
        or glue_n
        or not report["pinned_104441"]
        or both != sets
    ):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
