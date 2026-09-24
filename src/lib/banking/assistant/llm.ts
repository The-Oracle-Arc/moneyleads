/**
 * Optional natural-language layer. Banking never depends on this.
 * Failures fall back to deterministic replies. COLUMN_API_KEY is never sent.
 * MONEYLEAD is not coupled to a specific LLM vendor.
 */

import { getAiProvider } from "@/lib/ai/provider";
import { TOOL_CATALOG } from "./tools";
import type { CustomerSnapshot } from "../control-plane";

export type LlmPlan = {
  tool?: "explain_topic" | "account_status" | "suggest_navigation" | "escalate_support" | "request_transfer";
  args?: Record<string, string>;
  say?: string;
};

export function llmAvailable(): boolean {
  return getAiProvider().configured;
}

export async function planWithLlm(input: {
  message: string;
  snapshot: CustomerSnapshot;
}): Promise<LlmPlan | null> {
  const provider = getAiProvider();
  if (!provider.configured) return null;

  const facts = {
    configured: input.snapshot.configured,
    environment: input.snapshot.environment,
    kycStatus: input.snapshot.kycStatus,
    checkingStatus: input.snapshot.checkingStatus,
    onboardingStep: input.snapshot.onboardingStep,
    hasChecking: input.snapshot.hasChecking,
    availableCents: input.snapshot.availableCents,
    accountLast4: input.snapshot.accountLast4,
    routingLast4: input.snapshot.routingLast4,
    debitIssued: input.snapshot.debitIssued,
    creditStatus: input.snapshot.creditStatus,
  };

  const raw = await provider.complete({
    system: [
      "You are the MONEYLEAD Assistant, a customer guide inside a banking app.",
      "You are not a banker of record. You cannot change balances, approve credit, bypass KYC, or invent account numbers.",
      "Use only the provided customer facts. If a fact is missing, say you do not have it.",
      "Never claim FDIC insurance or that a banking partner has approved MONEYLEAD.",
      "Never mention API keys, provider credentials, or internal vendor names.",
      "Reply with JSON only: {\"tool\": one of " +
        TOOL_CATALOG.map((t) => t.name).join("|") +
        " or omit, \"args\": optional object, \"say\": short customer-facing sentence}.",
    ].join(" "),
    user: JSON.stringify({ facts, message: input.message.slice(0, 800) }),
    maxTokens: 400,
  });
  if (!raw) return null;
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as LlmPlan;
    if (parsed.tool && !TOOL_CATALOG.some((t) => t.name === parsed.tool)) {
      parsed.tool = undefined;
    }
    return parsed;
  } catch {
    return null;
  }
}
