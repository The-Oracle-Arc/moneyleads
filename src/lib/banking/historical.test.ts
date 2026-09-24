import assert from "node:assert/strict";
import test from "node:test";
import { parseSourceOccurredAt } from "./historical-date.ts";

test("source occurred-at is required and never defaults to today", () => {
  const empty = parseSourceOccurredAt("");
  assert.equal(empty.ok, false);
  if (!empty.ok) assert.match(empty.error, /will not assign/i);
});

test("preserves an original 2019 source date", () => {
  const r = parseSourceOccurredAt("2019-04-12");
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.iso.slice(0, 10), "2019-04-12");
    assert.notEqual(r.iso.slice(0, 10), new Date().toISOString().slice(0, 10));
  }
});

test("rejects malformed dates instead of substituting today", () => {
  const r = parseSourceOccurredAt("April 12");
  assert.equal(r.ok, false);
});
