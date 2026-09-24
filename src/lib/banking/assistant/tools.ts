/**
 * Controlled assistant tools. Each tool calls the Control Plane.
 * None of these receive or return COLUMN_API_KEY.
 */

import {
  createConfirmation,
  customerSnapshot,
  escalateToSupport,
  type Actor,
} from "../control-plane";
import { explainTopic, suggestHref, type KnowledgeTopic } from "./knowledge";

export type ToolName =
  | "explain_topic"
  | "account_status"
  | "suggest_navigation"
  | "escalate_support"
  | "request_transfer";

export type ToolResult = {
  name: ToolName;
  ok: boolean;
  text: string;
  href?: string;
  confirmationId?: string;
};

export const TOOL_CATALOG: { name: ToolName; description: string }[] = [
  { name: "explain_topic", description: "Explain a MONEYLEAD topic from product policy." },
  { name: "account_status", description: "Read this customer's status and masked balances." },
  { name: "suggest_navigation", description: "Suggest an in-app screen." },
  { name: "escalate_support", description: "Open a human support case." },
  { name: "request_transfer", description: "Create a transfer confirmation. Does not send money." },
];

export async function runTool(
  actor: Actor,
  name: ToolName,
  args: Record<string, string>,
): Promise<ToolResult> {
  const snap = await customerSnapshot(actor);

  if (name === "explain_topic") {
    const topic = (args.topic as KnowledgeTopic) || "moneylead";
    return { name, ok: true, text: explainTopic(topic, snap) };
  }
  if (name === "account_status") {
    return { name, ok: true, text: explainTopic("status", snap) };
  }
  if (name === "suggest_navigation") {
    const nav = suggestHref(args.query ?? "");
    return {
      name,
      ok: true,
      text: nav ? `Open ${nav.label} in the app.` : explainTopic("navigate", snap),
      href: nav?.href,
    };
  }
  if (name === "escalate_support") {
    const result = await escalateToSupport(
      actor,
      args.subject || "Help from MONEYLEAD Assistant",
      args.body || args.query || "Customer asked to speak with operations.",
    );
    if (!result.ok) return { name, ok: false, text: result.error };
    return { name, ok: true, text: "I opened a case for human operations. You can follow it under Support." };
  }
  if (name === "request_transfer") {
    const cents = Number(args.amountCents ?? 0);
    if (!Number.isFinite(cents) || cents <= 0) {
      return {
        name,
        ok: true,
        text: "I cannot send money. Use Bank → Transfers, or tell me a dollar amount so I can create a confirmation for you to approve.",
      };
    }
    const created = await createConfirmation(actor, "transfer.send", {
      amountCents: Math.round(cents),
      routing: args.routing ?? "",
      account: args.account ?? "",
      name: args.name ?? "",
      description: args.description ?? "Assistant-requested transfer",
      idempotencyKey: `asst:${Date.now()}`,
    });
    if (!created.ok) return { name, ok: false, text: created.error };
    return {
      name,
      ok: true,
      text: created.message,
      confirmationId: created.confirmationId,
    };
  }
  return { name, ok: false, text: "That tool is not available." };
}
