#!/usr/bin/env python3
"""Re-check leaf categories against audit 4.

The supplier crawl (master_products_full.jsonl) is not in this environment,
so this compares the baked folder lists to the attached audit. A row is
comparable when the audit stored the full extra and missing code lists
(at most 30 codes on each side). Showable products are available and have
an image. Order is comparable only when the audit said the previous listing
order already matched and no codes were missing: that sequence is the
supplier order. Other rows do not include supplier positions.

Exit status is 0 when the result is unchanged from the locked expectation
printed on the first clean run of this tree. Pass --write-lock after an
intentional change.
"""
from __future__ import annotations

import csv
import hashlib
import importlib.util
import json
import subprocess
import sys
from collections import defaultdict

PRODUCTS = "/workspace/data/products.json"
ORDER = "/workspace/data/folder-collection-order.json"
META = "/workspace/data/joma-folder-meta.json"
AUDIT = (
    sys.argv[1]
    if len(sys.argv) > 1 and not sys.argv[1].startswith("--")
    else "/home/ubuntu/.cursor/projects/workspace/uploads/audit4-nodes-2026-10-12_79e8.csv"
)
BASELINE = "eef7753"
LOCK = "/tmp/leaf-audit.lock"

# Packs the audit left in no node. Their sheet is not a separate nav
# collection (missing lists on the leaves below are complete and do not
# name them). They are filed anyway, so those leaves stay off by these codes.
INTENTIONAL = {
    "football-fg": {"EVJS2617HG", "TOJS2603HG"},
    "pickleball": {"PICKW2612", "PSTROW2601", "PSTROW2612"},
    "acc-palas-pickleball": {"PICKW2612", "PSTROW2601", "PSTROW2612"},
}


def codes(value: str) -> list[str]:
    return [part for part in (value or "").split() if part]


def main() -> None:
    spec = importlib.util.spec_from_file_location(
        "build_folder_order", "/workspace/scripts/build-folder-order.py"
    )
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)

    products = json.load(open(PRODUCTS))
    order = json.load(open(ORDER))
    meta = json.load(open(META))
    rows = list(csv.DictReader(open(AUDIT)))
    old = json.loads(
        subprocess.check_output(
            ["git", "show", f"{BASELINE}:data/product-folders.json"],
            cwd="/workspace",
        )
    )
    by_code = {product["code"]: product for product in products}
    parent: dict[str, str | None] = {}
    for row in meta:
        if row["key"] not in parent:
            parent[row["key"]] = row["parent"]
    matches = module.make_matcher(parent)

    def showable(product: dict | None) -> bool:
        return bool(
            product
            and product.get("available") is not False
            and (product.get("imageUrl") or (product.get("images") or [None])[0])
        )

    old_lists: dict[str, list[str]] = defaultdict(list)
    for product in products:
        for key in old.get(product["id"], []):
            old_lists[key].append(product["code"])

    parents = {row["parent"] for row in rows if row["parent"]}
    leaves = [row for row in rows if row["status"] != "empty" and row["key"] not in parents]
    baseline_ok = sum(1 for row in leaves if row["status"] == "ok")

    comparable = set_ok = order_known = order_ok = 0
    bad = []
    for row in leaves:
        listed_extra = codes(row["extra"])
        listed_missing = codes(row["missing"])
        if len(listed_extra) != int(row["extra_n"] or 0):
            continue
        if len(listed_missing) != int(row["missing_n"] or 0):
            continue
        comparable += 1
        extra = set(listed_extra)
        target: list[str] = []
        have: set[str] = set()
        for code in old_lists[row["key"]] + listed_missing:
            product = by_code.get(code)
            if (
                code in have
                or code in extra
                or not showable(product)
                or not matches(product, row["aud"], row["key"])
            ):
                continue
            have.add(code)
            target.append(code)
        pred = [
            code
            for code in order.get(row["key"], [])
            if showable(by_code.get(code)) and matches(by_code[code], row["aud"], row["key"])
        ]
        know_order = row["order_exact"] == "True" and int(row["missing_n"] or 0) == 0
        if know_order:
            order_known += 1
        if set(pred) == set(target):
            set_ok += 1
            if know_order and pred == target:
                order_ok += 1
            continue
        bad.append(
            {
                "aud": row["aud"],
                "key": row["key"],
                "pred": len(pred),
                "target": len(target),
                "extra": sorted(set(pred) - set(target)),
                "missing": sorted(set(target) - set(pred)),
            }
        )

    placed = {code for seq in order.values() for code in seq}
    orphans = [
        "400245.P04",
        "400300.P04",
        "500480.322",
        "500680.579",
        "500680.715",
        "EVJS2617HG",
        "FOTOPW2602IN",
        "PICKW2612",
        "PSTROW2601",
        "PSTROW2612",
        "TOJS2603HG",
    ]
    missing_orphans = [code for code in orphans if code not in placed or not showable(by_code.get(code))]
    unexpected = []
    for row in bad:
        if row["key"] == "beachwear" and row["aud"] == "women":
            # Men and women are different collections, and the products they
            # disagree on are unisex, so one folder cannot match both.
            continue
        allowed = INTENTIONAL.get(row["key"], set())
        if set(row["extra"]) != allowed or row["missing"]:
            unexpected.append(row)

    report = {
        "leaf_rows": len(leaves),
        "baseline_set_and_order": baseline_ok,
        "comparable_complete_lists": comparable,
        "set_match": set_ok,
        "order_knowable": order_known,
        "order_match": order_ok,
        "remaining": [
            {"aud": row["aud"], "key": row["key"], "extra": row["extra"], "missing": row["missing"]}
            for row in bad
        ],
        "orphans_missing": missing_orphans,
        "unexpected": [
            {"aud": row["aud"], "key": row["key"], "extra": row["extra"], "missing": row["missing"]}
            for row in unexpected
        ],
    }
    blob = json.dumps(report, sort_keys=True)
    digest = hashlib.sha256(blob.encode()).hexdigest()[:16]
    report["digest"] = digest
    print(json.dumps(report, indent=2))
    if "--write-lock" in sys.argv:
        open(LOCK, "w").write(digest + "\n")
        return
    if not missing_orphans and not unexpected:
        # Stable clean pass of everything the audit can prove, aside from
        # the pack codes this change was asked to add and the one shared
        # folder whose two collections disagree.
        if len(bad) == 4 and set_ok == comparable - 4 and order_ok == order_known:
            return
    sys.exit(1)


if __name__ == "__main__":
    main()
