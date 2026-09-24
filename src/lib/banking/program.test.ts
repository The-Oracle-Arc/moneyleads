import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_STATUS_LINE,
  PROGRAM_CAPABILITIES,
  PROGRAM_PRODUCTION_NOTE,
  PROGRAM_SUMMARY,
  PROGRAM_TITLE,
  SOFTWARE_STATUS,
  SOFTWARE_STATUS_LINE,
  bankingProgramFromStatus,
  programStatusLine,
} from "./program.ts";

test("banner copy is professional program-setup language", () => {
  assert.equal(SOFTWARE_STATUS, "PRODUCTION READY");
  assert.match(SOFTWARE_STATUS_LINE, /production-ready/i);
  assert.equal(PROGRAM_TITLE, "Banking Program Setup");
  assert.equal(
    PROGRAM_SUMMARY,
    "MONEYLEAD is preparing for its production banking program and regulated banking-partner onboarding.",
  );
  assert.equal(DEFAULT_STATUS_LINE, "Sandbox environment • Production banking integration pending approval");
  assert.match(PROGRAM_PRODUCTION_NOTE, /Production banking access will only be enabled/);
});

test("status line never claims a live program without an approved relationship", () => {
  assert.equal(programStatusLine(), DEFAULT_STATUS_LINE);
  assert.equal(
    programStatusLine({ configured: true, environment: "sandbox" }),
    "Column Sandbox • Production banking integration pending approval",
  );
  assert.equal(
    programStatusLine({ configured: true, environment: "live" }),
    "Banking partner connected • Production banking integration pending approval",
  );
  assert.equal(
    programStatusLine({ configured: true, environment: "live" }, { programApproved: true }),
    "Column Live • Production banking program",
  );
});

test("program view stays pending unless the backend confirms approval", () => {
  const view = bankingProgramFromStatus({ configured: true, environment: "sandbox" });
  assert.equal(view.programStatus, "Preparing for Banking Program");
  assert.equal(view.environmentLabel, "Column Sandbox");
  assert.equal(view.productionStatus, "Pending banking-partner onboarding");
  assert.equal(view.programApproved, false);
  assert.ok(view.capabilities.includes("Consumer checking accounts"));
  assert.equal(view.capabilities.length, PROGRAM_CAPABILITIES.length);
});

test("copy does not claim FDIC insurance or a live consumer bank", () => {
  const haystack = [
    PROGRAM_TITLE,
    PROGRAM_SUMMARY,
    PROGRAM_PRODUCTION_NOTE,
    DEFAULT_STATUS_LINE,
    SOFTWARE_STATUS_LINE,
    ...PROGRAM_CAPABILITIES,
  ].join(" ");
  assert.equal(/FDIC/i.test(haystack), false);
  assert.equal(/insured/i.test(haystack), false);
  assert.equal(/approved MONEYLEAD/i.test(haystack), false);
  assert.equal(/charter/i.test(haystack), false);
});
