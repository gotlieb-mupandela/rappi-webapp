import assert from "node:assert/strict";
import test from "node:test";
import { adminProductSearchFilter, sanitizeAdminSearchTerm } from "./product-search";

test("keeps a normal product search as three ilike clauses", () => {
  const filter = adminProductSearchFilter("  100009.100  ");
  assert.equal(
    filter,
    "code.ilike.%100009.100%,item.ilike.%100009.100%,name.ilike.%100009.100%",
  );
});

test("drops characters that would add or close a PostgREST clause", () => {
  const filter = adminProductSearchFilter('%),name.eq.secret,code.ilike.%');
  assert.equal(sanitizeAdminSearchTerm('%),name.eq.secret,code.ilike.%'), "name.eq.secretcode.ilike.");
  assert.ok(filter);
  const clauses = filter.split(",");
  assert.deepEqual(
    clauses,
    [
      "code.ilike.%name.eq.secretcode.ilike.%",
      "item.ilike.%name.eq.secretcode.ilike.%",
      "name.ilike.%name.eq.secretcode.ilike.%",
    ],
  );
  for (const clause of clauses) {
    assert.match(clause, /^(code|item|name)\.ilike\.%/);
    assert.equal(clause.includes("("), false);
    assert.equal(clause.includes(")"), false);
  }
});

test("strips percent, star, and backslash so they are not filter syntax", () => {
  assert.equal(sanitizeAdminSearchTerm("100%_off"), "100_off");
  assert.equal(sanitizeAdminSearchTerm("a\\,b*c"), "abc");
  assert.equal(adminProductSearchFilter("%"), null);
  assert.equal(adminProductSearchFilter(" * ( ) , \\"), null);
  assert.equal(adminProductSearchFilter("   "), null);
});
