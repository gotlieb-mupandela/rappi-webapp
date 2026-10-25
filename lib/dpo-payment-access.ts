/**
 * Who is allowed to read or update a DPO payment.
 * "user" is the default and the strictest mode: a non-empty user id must own the row.
 * "webhook" is only for the secret-checked DPO webhook route.
 * "dpo-token" is the signed-out return path: a non-empty TransactionToken that
 * verifyToken has just confirmed with DPO. A company reference is never enough.
 */
export type DpoPaymentTrust = "webhook" | "dpo-token" | "user";

export type DpoAccessPayment = {
  user_id: string | null;
  company_ref: string;
  trans_token: string | null;
};

export type DpoTokenVerification = {
  result: string | null;
  companyRef: string | null;
};

/**
 * verifyToken transaction results. These mean DPO recognized the token.
 * 801-804, 902, and 950 are request failures and do not grant access.
 */
const VERIFIED_DPO_RESULTS = new Set([
  "000",
  "001",
  "002",
  "003",
  "005",
  "007",
  "900",
  "901",
  "903",
  "904",
]);

export function normalizeId(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function trustForCheckoutCaller(user: { id?: string | null } | null | undefined): DpoPaymentTrust {
  return user ? "user" : "dpo-token";
}

export function dpoVerificationGrantsAccess(
  verification: DpoTokenVerification | null | undefined,
  paymentCompanyRef: string,
): boolean {
  const code = verification?.result?.trim() ?? "";
  if (!VERIFIED_DPO_RESULTS.has(code)) return false;
  const echoed = normalizeId(verification?.companyRef);
  if (echoed && echoed !== paymentCompanyRef) return false;
  return true;
}

export type DpoAccessInput = {
  trusted?: DpoPaymentTrust;
  transToken?: string | null;
  companyRef?: string | null;
  userId?: string | null;
};

export async function resolveDpoPaymentAccess<
  TPayment extends DpoAccessPayment,
  TVerification extends DpoTokenVerification,
>(
  input: DpoAccessInput,
  deps: {
    loadPayment: (
      transToken: string | null,
      companyRef: string | null,
      tokenOnly: boolean,
    ) => Promise<TPayment | null>;
    verifyToken: (transToken: string) => Promise<TVerification>;
  },
): Promise<{
  payment: TPayment;
  verification: TVerification | null;
  transToken: string | null;
} | null> {
  const trusted: string = input.trusted ?? "user";
  const transToken = normalizeId(input.transToken);
  const companyRef = normalizeId(input.companyRef);
  const userId = normalizeId(input.userId);

  if (trusted === "webhook") {
    const payment = await deps.loadPayment(transToken, companyRef, false);
    if (!payment) return null;
    return { payment, verification: null, transToken };
  }

  if (trusted === "dpo-token") {
    if (!transToken) return null;
    const payment = await deps.loadPayment(transToken, null, true);
    if (!payment) return null;
    const verification = await deps.verifyToken(transToken);
    if (!dpoVerificationGrantsAccess(verification, payment.company_ref)) return null;
    return { payment, verification, transToken };
  }

  if (trusted !== "user" || !userId) return null;
  const payment = await deps.loadPayment(transToken, companyRef, false);
  if (!payment || payment.user_id !== userId) return null;
  return { payment, verification: null, transToken };
}
