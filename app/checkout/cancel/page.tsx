import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Button } from "@/components/ui/button";
import { cancelDpoPayment } from "@/lib/dpo-payments";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Payment cancelled",
  robots: { index: false, follow: false },
};

export default async function CheckoutCancelPage({
  searchParams,
}: {
  searchParams: Promise<{
    TransactionToken?: string;
    TransToken?: string;
    TransID?: string;
    CompanyRef?: string;
  }>;
}) {
  const params = await searchParams;
  const transToken = params.TransactionToken || params.TransToken || params.TransID || null;
  const companyRef = params.CompanyRef || null;

  let body = "Checkout was closed before payment. Your bag is still saved.";
  if (transToken || companyRef) {
    try {
      const result = await cancelDpoPayment({ transToken, companyRef });
      if (result.status === "paid") {
        body = "This payment was already verified as paid.";
      } else if (result.payment) {
        body = `Payment ${result.payment.company_ref} is ${result.status}.`;
      }
    } catch (err) {
      body = err instanceof Error ? err.message : "Could not update the cancelled payment.";
    }
  }

  return (
    <div className="page-shell py-8">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/checkout", label: "Checkout" },
          { label: "Cancelled" },
        ]}
      />
      <p className="mt-6 text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Payment</p>
      <h1 className="mt-2 font-[family-name:var(--font-oswald)] text-3xl uppercase sm:text-4xl">
        Payment cancelled
      </h1>
      <p className="mt-3 max-w-xl text-sm text-[var(--muted)]">{body}</p>
      <Button asChild className="mt-8">
        <Link href="/checkout">Back to checkout</Link>
      </Button>
    </div>
  );
}
