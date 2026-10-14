/** Dump our folder trees + landing tile labels (raw, before portal overrides) for scripts/joma-structure-diff.py. */
import { writeFileSync } from "fs";
process.env.JOMA_PORTAL_RAW = process.env.JOMA_PORTAL_RAW ?? "1";
async function main() {
  const T = await import("../lib/joma-tree");
  const N = await import("../lib/joma-nav");
  type F = { key: string; label: string; children?: readonly F[] };
  const conv = (fs: readonly F[]): unknown[] =>
    fs.map((f) => ({ key: f.key, label: f.label, children: f.children ? conv(f.children) : [] }));
  const kids = (list: readonly F[]) => (list[0]?.children ?? []) as readonly F[];
  const out = {
    Man: conv(T.APPAREL_FOLDERS), Woman: conv(T.WOMAN_APPAREL_FOLDERS), Children: conv(T.KIDS_APPAREL_FOLDERS),
    Footwear: conv(T.FOOTWEAR_FOLDERS), FootwearWoman: conv(T.WOMAN_FOOTWEAR_FOLDERS), FootwearJunior: conv(T.KIDS_FOOTWEAR_FOLDERS),
    Accessories: conv(kids(T.ACCESSORIES_FOLDERS)), Outlet: conv(kids(T.OUTLET_FOLDERS)),
    OfficialKits: conv(kids(T.OFFICIAL_KITS_FOLDERS)),
    landing: {
      Man: N.jomaAudienceLandingTiles("men").map((t) => t.label),
      Woman: N.jomaAudienceLandingTiles("women").map((t) => t.label),
      Children: N.jomaKidsLandingTiles().map((t) => t.label),
      Footwear: N.jomaFootwearLandingTiles().map((t) => t.label),
      Accessories: N.jomaAccessoriesLandingTiles().map((t) => t.label),
      Outlet: N.jomaOutletLandingTiles().map((t) => t.label),
      OfficialKits: N.jomaOfficialKitsLandingTiles().map((t) => t.label),
      Teams: N.jomaTeamsLandingTiles().map((t) => t.label),
    },
  };
  writeFileSync(process.argv[2] ?? "/tmp/joma-our-tree.json", JSON.stringify(out, null, 1));
}
main();
