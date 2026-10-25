import Link from "next/link";
import { cn } from "@/lib/utils";
import { tabSlug, type FolderTab } from "@/lib/folder-tabs";

/** Portal-style in-page tab strip: All + each tab, links keep the folder. */
export function FolderTabs({
  tabs,
  active,
  hrefFor,
  allLabel,
}: {
  tabs: FolderTab[];
  active: string;
  hrefFor: (tab: string) => string;
  allLabel: string;
}) {
  const items = [{ slug: "", label: allLabel }, ...tabs.map((t) => ({ slug: tabSlug(t.label), label: t.label }))];
  return (
    <nav aria-label="Folder tabs" className="mb-5 overflow-x-auto border-b border-[var(--border)]">
      <ul className="flex min-w-max gap-x-6">
        {items.map((it) => {
          const on = it.slug === active;
          return (
            <li key={it.slug || "all"}>
              <Link
                href={hrefFor(it.slug)}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "-mb-px inline-block border-b-2 py-2 text-xs font-semibold uppercase tracking-[0.12em]",
                  on ? "border-[var(--accent)] text-[var(--text)]" : "border-transparent text-[var(--muted)] hover:text-[var(--text)]",
                )}
              >
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
