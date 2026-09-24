import assert from "node:assert/strict";
import test from "node:test";
import { matchIntent } from "./intent.ts";

test("explains routing without treating it as a transfer", () => {
  const intent = matchIntent("Where do routing numbers come from?");
  assert.equal(intent.kind, "explain");
  if (intent.kind === "explain") assert.equal(intent.topic, "routing");
});

test("escalates to human support", () => {
  const intent = matchIntent("I need to talk to a person");
  assert.equal(intent.kind, "escalate");
});

test("does not execute send money — it requests confirmation", () => {
  const intent = matchIntent("send money to my landlord");
  assert.equal(intent.kind, "confirm_transfer");
});

test("sandbox questions stay on sandbox policy", () => {
  const intent = matchIntent("Is this FDIC insured?");
  assert.equal(intent.kind, "explain");
  if (intent.kind === "explain") assert.equal(intent.topic, "sandbox");
});
