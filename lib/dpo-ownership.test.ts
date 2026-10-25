import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canReadInvoice } from "./invoice-access";
import { ownsPayment, paymentStatusUserId } from "./dpo-ownership";

test("ownsPayment fails closed unless both ids are the same non-empty string", () => {
  assert.equal(ownsPayment("user-1", undefined), false);
  assert.equal(ownsPayment(undefined, undefined), false);
  assert.equal(ownsPayment("user-1", null), false);
  assert.equal(ownsPayment(null, null), false);
  assert.equal(ownsPayment("user-1", ""), false);
  assert.equal(ownsPayment("", ""), false);
  assert.equal(ownsPayment("", "user-1"), false);
  assert.equal(ownsPayment(null, "user-1"), false);
  assert.equal(ownsPayment(undefined, "user-1"), false);
  assert.equal(ownsPayment("user-1", "user-2"), false);
  assert.equal(ownsPayment("user-1", "user-1"), true);
});

test("invoice read uses the same fail-closed ownership check", () => {
  assert.equal(canReadInvoice(false, undefined, undefined), false);
  assert.equal(canReadInvoice(false, null, null), false);
  assert.equal(canReadInvoice(false, "", ""), false);
  assert.equal(canReadInvoice(false, "user-1", "user-2"), false);
  assert.equal(canReadInvoice(false, "user-1", "user-1"), true);
  assert.equal(canReadInvoice(true, undefined, undefined), true);
});

test("payment status returns no payment data without a valid user", () => {
  for (const user of [undefined, null, {}, { id: undefined }, { id: null }, { id: "" }]) {
    assert.equal(paymentStatusUserId(user), null);
  }
  assert.equal(paymentStatusUserId({ id: "user-1" }), "user-1");

  const source = readFileSync(new URL("../app/api/payments/dpo/status/route.ts", import.meta.url), "utf8");
  const gate = source.indexOf("const userId = paymentStatusUserId(user);");
  const denied = source.indexOf('return NextResponse.json({ error: "Sign in required." }, { status: 401 });');
  const query = source.indexOf('.from("payments")');
  assert.ok(gate > 0, "status route does not use paymentStatusUserId");
  assert.ok(denied > gate, "401 is not the branch for a missing user id");
  assert.ok(query > denied, "payment query runs before the 401");
  assert.match(source, /\.eq\("user_id", userId\)/);
  assert.doesNotMatch(
    source.slice(denied, denied + 90),
    /orderId|order_id|"status":/,
  );
});
