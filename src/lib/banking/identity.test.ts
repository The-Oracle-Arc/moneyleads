import assert from "node:assert/strict";
import test from "node:test";
import {
  conversationalFirstName,
  formatMoneyleadUserId,
  greetingFor,
  helloFor,
  validateUsername,
} from "./identity.ts";

test("rejects reserved and impersonating usernames", () => {
  assert.equal(validateUsername("admin").ok, false);
  assert.equal(validateUsername("StaffOps").ok, false);
  assert.equal(validateUsername("moneylead").ok, false);
  assert.equal(validateUsername("ab").ok, false);
});

test("accepts a normal unique username", () => {
  const r = validateUsername("Colton.hogan");
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.username, "colton.hogan");
});

test("formats an immutable MONEYLEAD User ID", () => {
  assert.equal(formatMoneyleadUserId(18427), "ML-00018427");
  assert.equal(formatMoneyleadUserId(7), "ML-00000007");
});

test("greets with a first name, never an email", () => {
  assert.equal(conversationalFirstName("colton@x.com"), null);
  assert.match(greetingFor("Colton", new Date("2026-08-31T08:00:00")), /Colton/);
  assert.equal(greetingFor(null, new Date("2026-08-31T08:00:00")).includes("@"), false);
  assert.equal(helloFor("Sarah"), "Hello, Sarah");
  assert.equal(helloFor("sarah@x.com"), "Hello");
});
