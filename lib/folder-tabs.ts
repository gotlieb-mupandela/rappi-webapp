import tabs from "@/data/joma-folder-tabs.json";

/** Joma portal in-page tabs (Game / Replicas / Training / Walk / seasons …) per folder, portal order. */
export type FolderTab = { label: string; codes: string[] };
const TABS = tabs as Record<string, FolderTab[]>;

export function folderTabs(key: string): FolderTab[] {
  return TABS[key] ?? [];
}

export function tabSlug(label: string) {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
