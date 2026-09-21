"use client";

import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/components/locale-provider";

export function TeamwearQuoteForm() {
  const t = useT();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSubmitting(true);
    try {
      const res = await fetch("/api/teamwear-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          organisation: data.get("organisation"),
          sport: data.get("sport"),
          players: data.get("players"),
          sizes: data.get("sizes"),
          notes: data.get("notes"),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(json.error || t("quote.failed"));
        return;
      }
      setSent(true);
      event.currentTarget.reset();
      toast.success(t("quote.sent"));
    } catch {
      toast.error(t("quote.failed"));
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8">
        <h2 className="font-[family-name:var(--font-oswald)] text-2xl uppercase">
          {t("quote.thanksTitle")}
        </h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{t("quote.thanksBody")}</p>
        <Button type="button" className="mt-6" onClick={() => setSent(false)}>
          {t("quote.another")}
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("quote.name")}>
          <Input name="name" required autoComplete="name" />
        </Field>
        <Field label={t("quote.email")}>
          <Input name="email" type="email" required autoComplete="email" />
        </Field>
        <Field label={t("quote.organisation")}>
          <Input name="organisation" required placeholder={t("quote.organisationPh")} />
        </Field>
        <Field label={t("quote.sport")}>
          <Input name="sport" placeholder={t("quote.sportPh")} />
        </Field>
        <Field label={t("quote.players")}>
          <Input name="players" inputMode="numeric" placeholder={t("quote.playersPh")} />
        </Field>
        <Field label={t("quote.sizes")}>
          <Input name="sizes" placeholder={t("quote.sizesPh")} />
        </Field>
      </div>
      <Field label={t("quote.notes")}>
        <textarea
          name="notes"
          rows={4}
          className="mt-0 h-28 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 text-sm text-ink outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
          placeholder={t("quote.notesPh")}
        />
      </Field>
      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={submitting}>
        {submitting ? t("quote.sending") : t("quote.submit")}
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <Label>{label}</Label>
      {children}
    </label>
  );
}
