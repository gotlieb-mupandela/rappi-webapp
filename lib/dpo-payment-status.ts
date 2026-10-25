import { NextResponse } from "next/server";

export type DpoStatusAuthClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
    }>;
  };
};

export type DpoOwnedPayment = {
  status: string;
  order_id: string | null;
};

export type DpoStatusDeps = {
  createRequestClient: (request: Request) => Promise<DpoStatusAuthClient>;
  findOwnedPayment: (
    companyRef: string,
    userId: string,
  ) => Promise<{
    data: DpoOwnedPayment | null;
    error: { message: string } | null;
  }>;
};

export async function readDpoPaymentStatus(request: Request, deps: DpoStatusDeps): Promise<Response> {
  const companyRef = (new URL(request.url).searchParams.get("companyRef") ?? "").trim();
  if (!companyRef || companyRef.length > 100) {
    return NextResponse.json({ error: "Missing payment reference." }, { status: 400 });
  }

  const supabase = await deps.createRequestClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id?.trim() ?? "";
  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { data, error } = await deps.findOwnedPayment(companyRef, userId);
  if (error) {
    console.error("payment status", error.message);
    return NextResponse.json({ error: "Could not check payment." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }

  return NextResponse.json(
    { status: data.status, orderId: data.order_id },
    { headers: { "Cache-Control": "no-store" } },
  );
}
