import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  dpoCancelOutcome,
  dpoVerificationGrantsAccess,
  resolveDpoPaymentAccess,
  trustForCheckoutCaller,
  type DpoAccessPayment,
  type DpoPaymentTrust,
  type DpoTokenVerification,
} from "../lib/dpo-payment-access";
import { readDpoPaymentStatus, type DpoStatusDeps } from "../lib/dpo-payment-status";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSource(relative: string) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

function payment(overrides: Partial<DpoAccessPayment> = {}): DpoAccessPayment {
  return {
    user_id: "user-1",
    company_ref: "RSH-OWNED",
    trans_token: "TOKEN-1",
    ...overrides,
  };
}

function verified(result: string | null, companyRef: string | null = "RSH-OWNED"): DpoTokenVerification {
  return { result, companyRef };
}

function tracker(row: DpoAccessPayment | null, verification: DpoTokenVerification) {
  const calls = {
    load: [] as { transToken: string | null; companyRef: string | null; tokenOnly: boolean }[],
    verify: [] as string[],
  };
  const deps = {
    async loadPayment(transToken: string | null, companyRef: string | null, tokenOnly: boolean) {
      calls.load.push({ transToken, companyRef, tokenOnly });
      if (!row) return null;
      if (transToken && transToken === row.trans_token) return row;
      if (tokenOnly) return null;
      if (companyRef && companyRef === row.company_ref) return row;
      return null;
    },
    async verifyToken(transToken: string) {
      calls.verify.push(transToken);
      return verification;
    },
  };
  return { calls, deps };
}

test("user match allows the owning user and does not call DPO", async () => {
  const row = payment();
  const { calls, deps } = tracker(row, verified("000"));
  const result = await resolveDpoPaymentAccess(
    { trusted: "user", userId: "user-1", transToken: "TOKEN-1", companyRef: "RSH-OWNED" },
    deps,
  );
  assert.equal(result?.payment, row);
  assert.equal(result?.verification, null);
  assert.deepEqual(calls.verify, []);
});

test("user mismatch denies access", async () => {
  const { calls, deps } = tracker(payment(), verified("000"));
  const result = await resolveDpoPaymentAccess(
    { trusted: "user", userId: "user-2", transToken: "TOKEN-1", companyRef: "RSH-OWNED" },
    deps,
  );
  assert.equal(result, null);
  assert.deepEqual(calls.verify, []);
});

test("undefined, null, and empty user ids fail closed in user mode", async () => {
  const userIds: Array<string | null | undefined> = [undefined, null, "", "   "];
  for (const userId of userIds) {
    const { calls, deps } = tracker(payment(), verified("000"));
    const explicit = await resolveDpoPaymentAccess(
      { trusted: "user", userId, transToken: "TOKEN-1", companyRef: "RSH-OWNED" },
      deps,
    );
    const { calls: defaultCalls, deps: defaultDeps } = tracker(payment(), verified("000"));
    const implicit = await resolveDpoPaymentAccess(
      { userId, transToken: "TOKEN-1", companyRef: "RSH-OWNED" },
      defaultDeps,
    );
    assert.equal(explicit, null, `explicit user mode allowed ${String(userId)}`);
    assert.equal(implicit, null, `default mode allowed ${String(userId)}`);
    assert.deepEqual(calls.load, []);
    assert.deepEqual(calls.verify, []);
    assert.deepEqual(defaultCalls.load, []);
    assert.deepEqual(defaultCalls.verify, []);
  }
});

test("no signed-in user with a DPO-verified token is allowed", async () => {
  const row = payment();
  const { calls, deps } = tracker(row, verified("000"));
  const userId = undefined;
  const trusted = trustForCheckoutCaller(null);
  assert.equal(trusted, "dpo-token");
  const result = await resolveDpoPaymentAccess(
    { trusted, userId, transToken: "TOKEN-1", companyRef: "RSH-OWNED" },
    deps,
  );
  assert.equal(result?.payment, row);
  assert.equal(result?.verification?.result, "000");
  assert.deepEqual(calls.verify, ["TOKEN-1"]);
  assert.deepEqual(calls.load, [{ transToken: "TOKEN-1", companyRef: null, tokenOnly: true }]);
});

test("a verified but unpaid token still opens the mobile return", async () => {
  const row = payment();
  const { calls, deps } = tracker(row, verified("900"));
  const result = await resolveDpoPaymentAccess(
    { trusted: "dpo-token", userId: undefined, transToken: "TOKEN-1", companyRef: "RSH-OWNED" },
    deps,
  );
  assert.equal(result?.payment, row);
  assert.equal(calls.verify.length, 1);
});

test("no signed-in user with only a company reference is denied", async () => {
  const { calls, deps } = tracker(payment(), verified("000"));
  const trusted = trustForCheckoutCaller(undefined);
  const result = await resolveDpoPaymentAccess(
    { trusted, userId: undefined, transToken: null, companyRef: "RSH-OWNED" },
    deps,
  );
  assert.equal(result, null);
  assert.deepEqual(calls.load, []);
  assert.deepEqual(calls.verify, []);

  const blank = tracker(payment(), verified("000"));
  const blankResult = await resolveDpoPaymentAccess(
    { trusted: "dpo-token", userId: null, transToken: "   ", companyRef: "RSH-OWNED" },
    blank.deps,
  );
  assert.equal(blankResult, null);
  assert.deepEqual(blank.calls.load, []);
  assert.deepEqual(blank.calls.verify, []);
});

test("a token DPO does not recognize is denied, including companyRef fallback", async () => {
  const denied: DpoTokenVerification[] = [
    verified("801"),
    verified("902"),
    verified("950"),
    verified(null),
    verified("000", "RSH-OTHER"),
  ];
  for (const verification of denied) {
    const { calls, deps } = tracker(payment(), verification);
    const result = await resolveDpoPaymentAccess(
      { trusted: "dpo-token", transToken: "TOKEN-1", companyRef: "RSH-OWNED", userId: undefined },
      deps,
    );
    assert.equal(result, null);
    assert.deepEqual(calls.load, [{ transToken: "TOKEN-1", companyRef: null, tokenOnly: true }]);
    assert.deepEqual(calls.verify, ["TOKEN-1"]);
  }

  const mismatchedToken = tracker(payment({ trans_token: "STORED" }), verified("000"));
  const missed = await resolveDpoPaymentAccess(
    { trusted: "dpo-token", transToken: "OTHER-TOKEN", companyRef: "RSH-OWNED" },
    mismatchedToken.deps,
  );
  assert.equal(missed, null);
  assert.deepEqual(mismatchedToken.calls.verify, []);
  assert.equal(mismatchedToken.calls.load[0]?.tokenOnly, true);
  assert.equal(mismatchedToken.calls.load[0]?.companyRef, null);
});

test("webhook mode allows a company reference without a user id", async () => {
  const row = payment();
  const { calls, deps } = tracker(row, verified("000"));
  const result = await resolveDpoPaymentAccess(
    { trusted: "webhook", transToken: null, companyRef: "RSH-OWNED", userId: undefined },
    deps,
  );
  assert.equal(result?.payment, row);
  assert.equal(result?.verification, null);
  assert.deepEqual(calls.verify, []);
  assert.deepEqual(calls.load, [{ transToken: null, companyRef: "RSH-OWNED", tokenOnly: false }]);
});

test("a signed-in caller cannot use token mode to open someone else's payment", async () => {
  const userId = "user-2";
  assert.equal(trustForCheckoutCaller({ id: userId }), "user");
  assert.equal(trustForCheckoutCaller({ id: "" }), "user");
  assert.equal(trustForCheckoutCaller({ id: "   " }), "user");
  const { calls, deps } = tracker(payment({ user_id: "user-1" }), verified("000"));
  const result = await resolveDpoPaymentAccess(
    { trusted: "user" satisfies DpoPaymentTrust, userId, transToken: "TOKEN-1", companyRef: "RSH-OWNED" },
    deps,
  );
  assert.equal(result, null);
  assert.deepEqual(calls.verify, []);
});

test("recognized DPO transaction results grant token access and request errors do not", () => {
  for (const code of ["000", "001", "002", "003", "005", "007", "900", "901", "903", "904"]) {
    assert.equal(dpoVerificationGrantsAccess(verified(code), "RSH-OWNED"), true, code);
  }
  for (const code of ["801", "802", "803", "804", "902", "950", "", "999"]) {
    assert.equal(dpoVerificationGrantsAccess(verified(code), "RSH-OWNED"), false, code);
  }
  assert.equal(dpoVerificationGrantsAccess(null, "RSH-OWNED"), false);
  assert.equal(dpoVerificationGrantsAccess(verified("000", null), "RSH-OWNED"), true);
});

test("DPO result 000 does not cancel the payment", () => {
  const outcome = dpoCancelOutcome({ localStatus: "pending", verifyResult: "000" });
  assert.equal(outcome.writeCancelled, false);
  assert.equal(outcome.status, "paid");
});

test("DPO result 001 does not cancel the payment", () => {
  const outcome = dpoCancelOutcome({ localStatus: "pending", verifyResult: "001" });
  assert.equal(outcome.writeCancelled, false);
  assert.equal(outcome.status, "paid");
});

test("a normal DPO cancel code still cancels a pending payment", () => {
  const outcome = dpoCancelOutcome({ localStatus: "pending", verifyResult: "904" });
  assert.equal(outcome.writeCancelled, true);
  assert.equal(outcome.status, "cancelled");
});

test("an already-paid payment is never moved to cancelled", () => {
  const answers = ["000", "001", "904", "900", "801", "802", "803", "804", "902", "950", null, undefined, ""];
  for (const verifyResult of answers) {
    const outcome = dpoCancelOutcome({ localStatus: "paid", verifyResult });
    assert.equal(outcome.writeCancelled, false, `cancelled a paid payment for ${String(verifyResult)}`);
    assert.equal(outcome.status, "paid");
  }
});

test("a DPO request-failure code still follows the pending cancel rule", () => {
  for (const verifyResult of ["801", "802", "803", "804", "902", "950", null]) {
    const pending = dpoCancelOutcome({ localStatus: "pending", verifyResult });
    assert.equal(pending.writeCancelled, true, String(verifyResult));
    const paid = dpoCancelOutcome({ localStatus: "paid", verifyResult });
    assert.equal(paid.writeCancelled, false, String(verifyResult));
  }
});

test("fulfill and cancel use the explicit trust decision", () => {
  const payments = readSource("lib/dpo-payments.ts");
  const webhook = readSource("app/api/payments/dpo/webhook/route.ts");
  const ret = readSource("app/checkout/return/page.tsx");
  const cancel = readSource("app/checkout/cancel/page.tsx");
  assert.equal(payments.includes("userId === undefined"), false);
  assert.equal(payments.includes("resolveDpoPaymentAccess"), true);
  assert.match(payments, /access\.verification \?\? \(await verifyToken\(token\)\)/);
  assert.match(payments, /dpoCancelOutcome/);
  assert.match(payments, /status: "cancelled"/);
  assert.match(webhook, /trusted:\s*"webhook"/);
  assert.match(webhook, /function authorized/);
  assert.match(ret, /trustForCheckoutCaller\(user\)/);
  assert.match(cancel, /trustForCheckoutCaller\(user\)/);
});

const OTHER_USER_PAYMENT = {
  companyRef: "RSH-OTHER",
  ownerId: "user-a",
  status: "paid",
  orderId: "order-secret-42",
  email: "buyer@example.com",
  amount: "1234.50",
};

function statusDeps(tokens: Record<string, string>) {
  let lookups = 0;
  const deps: DpoStatusDeps = {
    async createRequestClient(request) {
      const header = request.headers.get("authorization") ?? "";
      const match = header.match(/^Bearer\s+(\S+)/i);
      const token = match?.[1] ?? "";
      const id = token ? tokens[token] : undefined;
      return {
        auth: {
          async getUser() {
            return { data: { user: id ? { id } : null } };
          },
        },
      };
    },
    async findOwnedPayment(companyRef, userId) {
      lookups += 1;
      if (companyRef === OTHER_USER_PAYMENT.companyRef && userId === OTHER_USER_PAYMENT.ownerId) {
        return {
          data: { status: OTHER_USER_PAYMENT.status, order_id: OTHER_USER_PAYMENT.orderId },
          error: null,
        };
      }
      return { data: null, error: null };
    },
  };
  return {
    deps,
    lookups: () => lookups,
  };
}

function statusUrl(companyRef = OTHER_USER_PAYMENT.companyRef) {
  return `https://www.rappisportshub.com/api/payments/dpo/status?companyRef=${encodeURIComponent(companyRef)}`;
}

async function assertNoPaymentData(response: Response) {
  const body = (await response.json()) as Record<string, unknown>;
  const encoded = JSON.stringify(body);
  assert.equal("orderId" in body, false);
  assert.equal("status" in body, false);
  assert.equal(encoded.includes(OTHER_USER_PAYMENT.orderId), false);
  assert.equal(encoded.includes(OTHER_USER_PAYMENT.email), false);
  assert.equal(encoded.includes(OTHER_USER_PAYMENT.amount), false);
  assert.equal(encoded.includes(OTHER_USER_PAYMENT.status), false);
  return body;
}

test("GET /api/payments/dpo/status returns 401 and no payment data when the token is missing", async () => {
  const { deps, lookups } = statusDeps({ "valid-user-a": "user-a" });
  const response = await readDpoPaymentStatus(new Request(statusUrl()), deps);
  assert.equal(response.status, 401);
  const body = await assertNoPaymentData(response);
  assert.deepEqual(body, { error: "Sign in required." });
  assert.equal(lookups(), 0);
});

test("GET /api/payments/dpo/status returns 401 and no payment data for an invalid token", async () => {
  const { deps, lookups } = statusDeps({ "valid-user-a": "user-a" });
  const response = await readDpoPaymentStatus(
    new Request(statusUrl(), { headers: { Authorization: "Bearer not-a-real-jwt" } }),
    deps,
  );
  assert.equal(response.status, 401);
  const body = await assertNoPaymentData(response);
  assert.deepEqual(body, { error: "Sign in required." });
  assert.equal(lookups(), 0);
});

test("GET /api/payments/dpo/status returns 401 for an empty user id", async () => {
  const deps: DpoStatusDeps = {
    async createRequestClient() {
      return {
        auth: {
          async getUser() {
            return { data: { user: { id: "  " } } };
          },
        },
      };
    },
    async findOwnedPayment() {
      throw new Error("lookup should not run");
    },
  };
  const response = await readDpoPaymentStatus(new Request(statusUrl()), deps);
  assert.equal(response.status, 401);
  await assertNoPaymentData(response);
});

test("GET /api/payments/dpo/status returns 404 for another user's reference", async () => {
  const { deps, lookups } = statusDeps({ "valid-user-b": "user-b", "valid-user-a": "user-a" });
  const response = await readDpoPaymentStatus(
    new Request(statusUrl(), { headers: { Authorization: "Bearer valid-user-b" } }),
    deps,
  );
  assert.equal(response.status, 404);
  const body = await assertNoPaymentData(response);
  assert.deepEqual(body, { error: "Payment not found." });
  assert.equal(lookups(), 1);

  const owner = await readDpoPaymentStatus(
    new Request(statusUrl(), { headers: { Authorization: "Bearer valid-user-a" } }),
    deps,
  );
  assert.equal(owner.status, 200);
  assert.deepEqual(await owner.json(), { status: "paid", orderId: "order-secret-42" });
});

test("status route keeps the user id filter and the request client", () => {
  const route = readSource("app/api/payments/dpo/status/route.ts");
  assert.match(route, /readDpoPaymentStatus/);
  assert.match(route, /createRequestClient/);
  assert.match(route, /supabase\.auth\.getUser/);
  assert.match(route, /\.select\("status, order_id"\)/);
  assert.match(route, /\.eq\("company_ref", companyRef\)/);
  assert.match(route, /\.eq\("user_id", userId\)/);
});
