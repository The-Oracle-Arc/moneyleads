/**
 * Deterministic authorization for the control plane.
 * Isolated from database imports so unit tests can run without a TS path alias.
 */

import type { StaffRole } from "../types";

export type Actor =
  | { kind: "customer"; userId: string }
  | { kind: "assistant"; userId: string }
  | { kind: "staff"; userId: string; role: StaffRole };

export class ControlPlaneError extends Error {
  readonly code: string;
  constructor(message: string, code = "denied") {
    super(message);
    this.name = "ControlPlaneError";
    this.code = code;
  }
}

const ASSISTANT_CAPABILITIES = new Set([
  "workspace.read",
  "explain.read",
  "support.escalate",
  "confirmation.create",
  "confirmation.list",
]);

function capsFor(actor: Actor): Set<string> | "all" {
  if (actor.kind === "assistant") return ASSISTANT_CAPABILITIES;
  if (actor.kind === "customer") return "all";
  return "all";
}

export function assertCapability(actor: Actor, capability: string) {
  const caps = capsFor(actor);
  if (caps !== "all" && !caps.has(capability)) {
    throw new ControlPlaneError(
      "The Assistant cannot perform this action. Use the app screens, or confirm a request that operations has authorized.",
    );
  }
}
