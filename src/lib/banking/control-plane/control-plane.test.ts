import assert from "node:assert/strict";
import test from "node:test";
import { assertCapability, ControlPlaneError } from "./authority.ts";
import { SENSITIVE_ACTIONS } from "./policies.ts";

test("assistant cannot execute sensitive banking capabilities", () => {
  const actor = { kind: "assistant" as const, userId: "user_1" };
  assert.throws(() => assertCapability(actor, "transfer.send"), ControlPlaneError);
  assert.throws(() => assertCapability(actor, "checking.submit"), ControlPlaneError);
  assert.doesNotThrow(() => assertCapability(actor, "workspace.read"));
  assert.doesNotThrow(() => assertCapability(actor, "support.escalate"));
  assert.doesNotThrow(() => assertCapability(actor, "confirmation.create"));
});

test("sensitive actions require confirmation", () => {
  assert.equal(SENSITIVE_ACTIONS.has("transfer.send"), true);
  assert.equal(SENSITIVE_ACTIONS.has("workspace.read"), false);
});

test("customer actor is not restricted to the assistant catalog", () => {
  assert.doesNotThrow(() => assertCapability({ kind: "customer", userId: "user_1" }, "transfer.send"));
});
