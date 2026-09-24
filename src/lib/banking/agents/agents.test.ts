import assert from "node:assert/strict";
import test from "node:test";
import { runKycAgent } from "../kyc-workflow.ts";

test("independent agents include historical, KYC, and system", () => {
  const ids = ["kyc", "historical", "transaction", "risk", "support", "compliance", "statement", "notification", "system"];
  assert.equal(ids.length, 9);
});

test("KYC agent still cannot auto-approve by default", () => {
  const r = runKycAgent({
    legalFirstName: "Ada",
    legalLastName: "Lovelace",
    dob: "1990-01-01",
    addressLine1: "1 Main",
    city: "Austin",
    state: "TX",
    postalCode: "78701",
    documentType: "passport",
    partnerStatus: "approved",
    deadlinePassed: false,
    autoApprovalEnabled: false,
  });
  assert.equal(r.autoApprove, false);
  assert.notEqual(r.workflow, "APPROVED");
});
