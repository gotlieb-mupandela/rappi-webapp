import { readAdminSearchParam, sanitizeAdminProductSearch } from "../lib/admin-search";

function fail(msg: string) {
  console.error(`FAIL ${msg}`);
  process.exitCode = 1;
}

type Case = {
  name: string;
  input: string;
  expected: string;
};

const cases: Case[] = [
  {
    name: "normal text unchanged",
    input: "Alpha 9.beta-gamma_delta",
    expected: "Alpha 9.beta-gamma_delta",
  },
  {
    name: "comma parentheses and percent cleaned",
    input: "jacket, (blue) 50%",
    expected: "jacket blue 50",
  },
  {
    name: "filter injection has no comma or parenthesis",
    input: "x),code.eq.1,(y",
    expected: "xcode.eq.1y",
  },
  {
    name: "empty input returns empty",
    input: "",
    expected: "",
  },
  {
    name: "only special input returns empty",
    input: ',()%*\\"',
    expected: "",
  },
  {
    name: "long input is capped",
    input: `  ${"n".repeat(90)}  `,
    expected: "n".repeat(80),
  },
  {
    name: "TEAM/14 unchanged",
    input: "TEAM/14",
    expected: "TEAM/14",
  },
  {
    name: "709/101 unchanged",
    input: "709/101",
    expected: "709/101",
  },
  {
    name: "catalogue code comma is dropped",
    input: "946,001",
    expected: "946001",
  },
  {
    name: "whitespace collapsed and trimmed",
    input: "  a   b  ",
    expected: "a b",
  },
  {
    name: "strip comma",
    input: "ab,cd",
    expected: "abcd",
  },
  {
    name: "strip left paren",
    input: "ab(cd",
    expected: "abcd",
  },
  {
    name: "strip right paren",
    input: "ab)cd",
    expected: "abcd",
  },
  {
    name: "strip percent",
    input: "ab%cd",
    expected: "abcd",
  },
  {
    name: "strip asterisk",
    input: "ab*cd",
    expected: "abcd",
  },
  {
    name: "strip double quote",
    input: 'ab"cd',
    expected: "abcd",
  },
  {
    name: "strip backslash",
    input: "ab\\cd",
    expected: "abcd",
  },
  {
    name: "strip control character",
    input: "ab\u0001cd",
    expected: "abcd",
  },
];

const forbidden = /[,()%*\\"\p{Cc}]/u;

for (const testCase of cases) {
  const actual = sanitizeAdminProductSearch(testCase.input);
  if (actual !== testCase.expected) {
    fail(
      `${testCase.name}: expected ${JSON.stringify(testCase.expected)} got ${JSON.stringify(actual)}`,
    );
    continue;
  }
  if (forbidden.test(actual)) {
    fail(`${testCase.name}: forbidden character remains in ${JSON.stringify(actual)}`);
    continue;
  }
  if (Array.from(actual).length > 80) {
    fail(`${testCase.name}: length ${Array.from(actual).length} exceeds 80`);
    continue;
  }
  console.log(`ok ${testCase.name}`);
}

const injection = sanitizeAdminProductSearch("x),code.eq.1,(y");
if (injection.includes(",") || injection.includes("(") || injection.includes(")")) {
  fail(`filter injection still has a comma or parenthesis: ${JSON.stringify(injection)}`);
}

const readArray = readAdminSearchParam(["a", "b"]);
const readString = readAdminSearchParam("abc");
const readMissing = readAdminSearchParam(undefined);
if (readArray !== "" || readString !== "abc" || readMissing !== "") {
  fail(
    `read search param: expected ["a","b"] -> "", "abc" -> "abc", undefined -> "", got ${JSON.stringify(readArray)}, ${JSON.stringify(readString)}, ${JSON.stringify(readMissing)}`,
  );
} else {
  console.log("ok read search param");
}

if (!process.exitCode) console.log("admin search checks ok");
