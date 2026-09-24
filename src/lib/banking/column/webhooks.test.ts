import assert from "node:assert/strict";
import test from "node:test";
import { computeColumnSignature, verifyColumnSignature } from "./signature.ts";
import { classifyColumnEventType } from "./events.ts";
import { mapColumnAchStatus, mapColumnVerification, mapColumnAchToTxStatus } from "./status.ts";
import { assertColumnKeyMatchesEnvironment, BankingConfigError, requireColumnWebhookSecret } from "../env.ts";

test("HMAC-SHA256 matches Column-Signature hex", () => {
  const secret = "whsec_test";
  const body = '{"id":"evt_1","type":"identity.verification.verified"}';
  const { hex, base64 } = computeColumnSignature(secret, body);
  assert.equal(verifyColumnSignature(body, hex, secret), true);
  assert.equal(verifyColumnSignature(body, base64, secret), true);
  assert.equal(verifyColumnSignature(body, "deadbeef", secret), false);
  assert.equal(verifyColumnSignature(body, null, secret), false);
});

test("maps Column verification statuses honestly", () => {
  assert.equal(mapColumnVerification("VERIFIED"), "approved");
  assert.equal(mapColumnVerification("MANUAL_REVIEW"), "manual_review");
  assert.equal(mapColumnVerification("DENIED"), "failed");
  assert.equal(mapColumnVerification("PENDING"), "processing");
  assert.equal(mapColumnVerification("UNVERIFIED"), "pending_documents");
});

test("maps ACH statuses without inventing completion", () => {
  assert.equal(mapColumnAchStatus("INITIATED"), "processing");
  assert.equal(mapColumnAchStatus("SETTLED"), "completed");
  assert.equal(mapColumnAchStatus("RETURNED"), "returned");
  assert.equal(mapColumnAchToTxStatus("INITIATED"), "pending");
  assert.equal(mapColumnAchToTxStatus("COMPLETED"), "posted");
});

test("rejects live keys in sandbox and sandbox keys in live", () => {
  assert.throws(() => assertColumnKeyMatchesEnvironment("live_abc", "sandbox"), BankingConfigError);
  assert.throws(() => assertColumnKeyMatchesEnvironment("test_abc", "live"), BankingConfigError);
  assert.doesNotThrow(() => assertColumnKeyMatchesEnvironment("test_abc", "sandbox"));
  assert.doesNotThrow(() => assertColumnKeyMatchesEnvironment("live_abc", "live"));
});

test("classifies documented Column event types only", () => {
  assert.equal(classifyColumnEventType("identity.created"), "identity");
  assert.equal(classifyColumnEventType("identity.verification.verified"), "identity");
  assert.equal(classifyColumnEventType("identity.verification.denied"), "identity");
  assert.equal(classifyColumnEventType("account.frozen"), "account");
  assert.equal(classifyColumnEventType("account.overdrafted"), "account");
  assert.equal(classifyColumnEventType("account.overdraft_released"), "account");
  assert.equal(classifyColumnEventType("ach.outgoing_transfer.completed"), "transfer");
  assert.equal(classifyColumnEventType("ach.incoming_transfer.settled"), "transfer");
  assert.equal(classifyColumnEventType("book.transfer.completed"), "transfer");
  assert.equal(classifyColumnEventType("entity.updated"), "ignored");
  assert.equal(classifyColumnEventType("bank_account.updated"), "ignored");
  assert.equal(classifyColumnEventType(""), "ignored");
  assert.equal(classifyColumnEventType(undefined), "ignored");
});

test("webhook without secret fails closed", () => {
  const prev = process.env.COLUMN_WEBHOOK_SECRET;
  delete process.env.COLUMN_WEBHOOK_SECRET;
  try {
    const result = requireColumnWebhookSecret();
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 503);
      assert.match(result.error, /secret/i);
    }
  } finally {
    if (prev !== undefined) process.env.COLUMN_WEBHOOK_SECRET = prev;
    else delete process.env.COLUMN_WEBHOOK_SECRET;
  }
});
