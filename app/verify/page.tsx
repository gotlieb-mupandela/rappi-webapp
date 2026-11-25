import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Verify a document",
  description: "Check that a RAPPI Sports Hub receipt, invoice or quotation is genuine.",
  robots: { index: false, follow: true },
};

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  const typed = code?.trim().replace(/\s+/g, "");
  if (typed) redirect(`/verify/${encodeURIComponent(typed.toUpperCase())}`);

  return (
    <div className="page-shell max-w-xl py-10">
      <h1 className="font-[family-name:var(--font-display)] text-3xl uppercase">Verify a document</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Check that a receipt, invoice or quotation from RAPPI Sports Hub is genuine. Enter the code printed next to the
        QR code at the bottom of the document.
      </p>
      <form action="/verify" method="get" className="mt-6 flex flex-col gap-3 sm:flex-row">
        <label htmlFor="verify-code" className="sr-only">
          Verification code
        </label>
        <input
          id="verify-code"
          name="code"
          required
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="e.g. RSH6F2B0EA6-7K3PQ2"
          className="h-11 flex-1 rounded-[var(--radius)] border border-[var(--border-strong)] px-3 font-mono text-sm uppercase"
        />
        <button
          type="submit"
          className="h-11 rounded-[var(--radius)] bg-[var(--accent)] px-5 text-sm font-bold text-[var(--on-accent)]"
        >
          Check document
        </button>
      </form>
    </div>
  );
}
