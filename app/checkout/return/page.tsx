import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Button } from "@/components/ui/button";
import { ClearCartOnPaid } from "@/components/clear-cart-on-paid";
import { fulfillDpoPayment } from "@/lib/dpo-payments";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Payment confirmation",
  robots: { index: false, follow: false },
};

export default async function CheckoutReturnPage({
  searchParams,
}: {
  searchParams: Promise<{
    TransactionToken?: string;
    TransToken?: string;
    CompanyRef?: string;
  }>;
}) {
  const params = await searchParams;
  const transToken = params.TransactionToken || params.TransToken || null;
  const companyRef = params.CompanyRef || null;

  let heading = "Payment not verified";
  let body = "Missing transaction token. Return to checkout and try again.";
  let paid = false;
  let ref: string | null = companyRef;
  let orderId: string | null = null;
  let amount: string | null = null;

  if (transToken || companyRef) {
    try {
      const result = await fulfillDpoPayment({ transToken, companyRef });
      paid = result.ok && result.status === "paid";
      heading = paid ? "Payment received" : "Payment not complete";
      body = result.message;
      ref = result.payment?.company_ref ?? companyRef;
      orderId = result.orderId;
      if (result.payment) {
        amount = formatPrice(Number(result.payment.amount));
      }
    } catch (err) {
      heading = "Payment not verified";
      body = err instanceof Error ? err.message : "Could not verify the payment.";
    }
  }

  return (
    <div className="page-shell py-8">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/checkout", label: "Checkout" },
          { label: "Return" },
        ]}
      />
      <ClearCartOnPaid paid={paid} />
      <p className="mt-6 text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
        {paid ? "Verified" : "Pending"}
      </p>
      <h1 className="mt-2 font-[family-name:var(--font-oswald)] text-3xl uppercase sm:text-4xl">
        {heading}
      </h1>
      <p className="mt-3 max-w-xl text-sm text-[var(--muted)]">{body}</p>
      {(ref || amount || orderId) && (
        <section className="mt-8 max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm">
          {orderId && (
            <p className="flex justify-between gap-4">
              <span>Order</span>
              <span className="break-all font-medium">{orderId}</span>
            </p>
          )}
          {ref && (
            <p className="mt-2 flex justify-between gap-4">
              <span>Reference</span>
              <span className="break-all font-medium">{ref}</span>
            </p>
          )}
          {amount && (
            <p className="mt-2 flex justify-between">
              <span>Amount</span>
              <span className="font-semibold">{amount}</span>
            </p>
          )}
        </section>
      )}
      <div className="mt-8 flex flex-wrap gap-3">
        {paid ? (
          <>
            <Button asChild>
              <Link href="/account/orders">View orders</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/">Continue shopping</Link>
            </Button>
          </>
        ) : (
          <Button asChild>
            <Link href="/checkout">Back to checkout</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
