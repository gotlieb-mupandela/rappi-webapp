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

/** Sentinel for the cancel page. Visitors see the localized confirming copy instead. */
export const DPO_CANCEL_CONFIRMING = "status-confirming";

/** DPO answers that clearly mean the transaction was not paid or was cancelled. */
const DPO_MAY_CANCEL = new Set(["900", "901", "903", "904"]);

/**
 * Whether cancel may write status "cancelled".
 * 000 and 001 leave the row unchanged and the page shows the paid result.
 * A missing answer, a thrown verify, or a request-failure code (801-804, 902, 950)
 * leaves a pending row pending. Only a clear not-paid or cancelled code may cancel it.
 * A row that is already paid is never cancelled.
 */
export function dpoCancelOutcome(input: {
  localStatus: string;
  verifyResult?: string | null;
}): { writeCancelled: boolean; status: string; confirming: boolean } {
  if (input.localStatus === "paid") return { writeCancelled: false, status: "paid", confirming: false };
  const code = input.verifyResult?.trim() ?? "";
  if (code === "000" || code === "001") return { writeCancelled: false, status: "paid", confirming: false };
  if (input.localStatus !== "pending") {
    return { writeCancelled: false, status: input.localStatus, confirming: false };
  }
  if (DPO_MAY_CANCEL.has(code)) return { writeCancelled: true, status: "cancelled", confirming: false };
  return { writeCancelled: false, status: "pending", confirming: true };
}

/** Row update for a cancel. Null means the pending row is left untouched, including verify_result. */
export function dpoCancelRowUpdate(
  outcome: { writeCancelled: boolean },
  verifyResult?: string | null,
): { status: "cancelled"; verify_result: string } | null {
  if (!outcome.writeCancelled) return null;
  const code = verifyResult?.trim() ?? "";
  if (!DPO_MAY_CANCEL.has(code)) return null;
  return { status: "cancelled", verify_result: code };
}

/**
 * Runs verifyToken for a pending cancel. A throw is an unavailable answer:
 * no cancelled write and no verify_result write.
 */
export async function decideCancelAfterVerify(input: {
  localStatus: string;
  verify: () => Promise<{ result: string | null }>;
}) {
  let verifyResult: string | null = null;
  try {
    verifyResult = (await input.verify()).result ?? null;
  } catch {
    verifyResult = null;
  }
  const outcome = dpoCancelOutcome({ localStatus: input.localStatus, verifyResult });
  return { verifyResult, outcome, update: dpoCancelRowUpdate(outcome, verifyResult) };
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
