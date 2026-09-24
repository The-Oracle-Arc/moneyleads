import assert from "node:assert/strict";
import test from "node:test";
import { formatUsd, formatUsdPlain, parseUsdToCents } from "./money.ts";

test("lists keep comma grouping; hero display uses spaced thousands", () => {
  assert.equal(formatUsd(2543130), "$25,431.30");
  assert.equal(formatUsdPlain(2543130), "25\u202F431.30");
  assert.equal(formatUsdPlain(10000), "100.00");
  assert.equal(formatUsdPlain(100), "1.00");
  assert.equal(formatUsdPlain(0), "0.00");
  assert.equal(formatUsdPlain(100000000), "1\u202F000\u202F000.00");
});

test("parseUsdToCents accepts spaces and commas", () => {
  assert.equal(parseUsdToCents("25 431.30"), 2543130);
  assert.equal(parseUsdToCents("$25,431.30"), 2543130);
  assert.equal(parseUsdToCents("1.00"), 100);
});
