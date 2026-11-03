"use client";

import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { JomaSyncLine } from "@/lib/joma-sync";

type Preview = {
  parsed: number;
  matched: number;
  unmatched: string[];
  sample: JomaSyncLine[];
};

export function StockSyncForm() {
  const [filename, setFilename] = useState("");
  const [dump, setDump] = useState<unknown>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setFilename(file.name);
    setPreview(null);
    try {
      const text = await file.text();
      setDump(JSON.parse(text));
    } catch {
      toast.error("Could not parse JSON export.");
      setDump(null);
    }
  }

  async function post(apply: boolean) {
    if (!dump) {
      toast.error("Choose a Joma export JSON file.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/stock-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dump, filename, apply }),
      });
      const data = (await res.json()) as Preview & { error?: string; ok?: boolean };
      if (!res.ok) {
        toast.error(data.error || "Sync failed.");
        return;
      }
      if (apply) {
        toast.success(`Applied ${data.matched ?? preview?.matched ?? 0} SKUs.`);
        setPreview(null);
        setDump(null);
      } else {
        setPreview(data);
      }
    } catch {
      toast.error("Could not reach the sync API.");
    } finally {
      setBusy(false);
    }
  }

  async function onPreview(e: FormEvent) {
    e.preventDefault();
    await post(false);
  }

  return (
    <form onSubmit={onPreview} className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <label className="block space-y-1.5">
        <span className="text-xs uppercase tracking-wider text-[var(--muted)]">Joma export (.json)</span>
        <input
          type="file"
          accept="application/json,.json"
          className="block w-full text-sm"
          onChange={(e) => void onFile(e.target.files)}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || !dump}>
          {busy ? "Working…" : "Preview"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy || !preview}
          onClick={() => void post(true)}
        >
          Apply to database
        </Button>
      </div>
      {preview ? (
        <div className="space-y-2 text-sm">
          <p>
            Parsed {preview.parsed} rows · matched {preview.matched} · unmatched{" "}
            {preview.unmatched.length}
          </p>
          {preview.unmatched.length ? (
            <p className="text-[var(--muted)]">
              Unmatched: {preview.unmatched.slice(0, 20).join(", ")}
              {preview.unmatched.length > 20 ? "…" : ""}
            </p>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
