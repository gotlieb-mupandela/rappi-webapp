import assert from "node:assert/strict";
import test from "node:test";
import { customerOwnsPayment } from "./dpo-ownership";

test("a missing user does not own a payment", () => {
  assert.equal(customerOwnsPayment("user-1", undefined), false);
  assert.equal(customerOwnsPayment("user-1", null), false);
  assert.equal(customerOwnsPayment("user-1", ""), false);
  assert.equal(customerOwnsPayment(null, "user-1"), false);
});

test("only the matching signed-in user owns a payment", () => {
  assert.equal(customerOwnsPayment("user-1", "user-1"), true);
  assert.equal(customerOwnsPayment("user-1", "user-2"), false);
});
