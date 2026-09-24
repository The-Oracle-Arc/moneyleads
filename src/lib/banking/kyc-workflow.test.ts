import assert from "node:assert/strict";
import test from "node:test";
import { runKycAgent } from "./kyc-workflow.ts";

const complete = {
  legalFirstName: "Colton",
  legalLastName: "Hogan",
  dob: "1990-01-01",
  addressLine1: "1 Main St",
  city: "Austin",
  state: "TX",
  postalCode: "78701",
  documentType: "license",
  partnerStatus: "processing",
  deadlinePassed: false,
  autoApprovalEnabled: false,
};

test("agent never auto-approves by default", () => {
  const r = runKycAgent({ ...complete, partnerStatus: "approved" });
  assert.equal(r.autoApprove, false);
  assert.equal(r.recommendation, "APPROVE");
});

test("missing fields request information", () => {
  const r = runKycAgent({ ...complete, legalFirstName: null, addressLine1: null });
  assert.equal(r.recommendation, "NEEDS_INFORMATION");
});

test("deadline expiry escalates instead of approving", () => {
  const r = runKycAgent({ ...complete, deadlinePassed: true, partnerStatus: "approved" });
  assert.equal(r.workflow, "ESCALATED");
  assert.equal(r.autoApprove, false);
});
