import { PRODUCT, TX_STATUS_COPY, NAV_HINTS } from "../control-plane/policies.ts";
import type { CustomerSnapshot } from "../control-plane";

export type KnowledgeTopic =
  | "moneylead"
  | "onboarding"
  | "accounts"
  | "routing"
  | "transactions"
  | "ach"
  | "cards"
  | "fees"
  | "verification"
  | "status"
  | "navigate"
  | "support"
  | "sandbox"
  | "assistant"
  | "demo";

export const TOPICS: { id: KnowledgeTopic; title: string; hints: string[] }[] = [
  { id: "moneylead", title: "What is MONEYLEAD?", hints: ["what is", "about", "product", "who"] },
  { id: "onboarding", title: "Opening an account", hints: ["onboard", "sign up", "get started", "open account"] },
  { id: "accounts", title: "Checking accounts", hints: ["checking", "balance", "account"] },
  { id: "routing", title: "Routing and account numbers", hints: ["routing", "account number", "aba", "wire"] },
  { id: "transactions", title: "Transactions", hints: ["transaction", "posted", "pending", "history"] },
  { id: "ach", title: "ACH transfers", hints: ["ach", "transfer", "send money", "direct deposit"] },
  { id: "cards", title: "Cards", hints: ["card", "debit", "credit", "visa"] },
  { id: "fees", title: "Fees and policies", hints: ["fee", "overdraft", "interest", "policy"] },
  { id: "verification", title: "Identity verification", hints: ["kyc", "verify", "identity", "ssn", "document", "selfie"] },
  { id: "status", title: "Account status", hints: ["status", "why", "review", "hold"] },
  { id: "navigate", title: "Where to go", hints: ["where", "find", "how do i", "navigate"] },
  { id: "support", title: "Human support", hints: ["human", "agent", "escalate", "talk to"] },
  { id: "sandbox", title: "Banking program", hints: ["sandbox", "fdic", "real", "demo", "insured", "banking program", "production", "live"] },
  { id: "assistant", title: "What I can do", hints: ["assistant", "you", "ai", "help"] },
  { id: "demo", title: "Sandbox demonstration transfers", hints: ["demonstration", "demo transfer", "no funds", "failed demo"] },
];

function money(cents: number | null): string {
  if (cents == null) return "not available yet";
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

export function explainTopic(topic: KnowledgeTopic, snap: CustomerSnapshot): string {
  switch (topic) {
    case "moneylead":
      return `${PRODUCT.name} is an independent U.S. digital banking product. ${PRODUCT.tagline} Checking is the core account. Credit is optional and is not auto-approved. ${PRODUCT.assistant}`;
    case "onboarding":
      return snap.hasChecking
        ? "Your checking account is already open. You can review it on Home or Payments."
        : snap.configured
          ? `Open a checking account by finishing onboarding: phone, personal details, identity verification, then security. Identity is reviewed by the banking partner. Current step: ${snap.onboardingStep ?? "welcome"}. KYC: ${snap.kycStatus ?? "not started"}.`
          : PRODUCT.unconfigured;
    case "accounts":
      if (!snap.configured) return PRODUCT.unconfigured;
      if (!snap.hasChecking) {
        return `You do not have a checking account yet. Checking status: ${snap.checkingStatus ?? "not started"}. ${PRODUCT.checking}`;
      }
      return `Your checking available balance is ${money(snap.availableCents)} (current ${money(snap.currentCents)}). Those amounts come from the banking partner, not from this Assistant.`;
    case "routing":
      if (!snap.hasChecking) {
        return "Routing and account numbers appear only after the banking partner opens a checking account. MONEYLEAD never generates them locally.";
      }
      return `Your account number ends in ${snap.accountLast4 ?? "—"}. Routing number ends in ${snap.routingLast4 ?? "—"}. Full numbers are on Home (account card) or Receive. This Assistant never invents those digits.`;
    case "transactions":
      return `Transaction states: ${Object.entries(TX_STATUS_COPY)
        .map(([k, v]) => `${k} — ${v}`)
        .join(" ")} MONEYLEAD does not mark items complete on its own.`;
    case "ach":
      return PRODUCT.ach;
    case "cards":
      return `${PRODUCT.cards} Debit issued on this account: ${snap.debitIssued ? "a card record exists" : "not issued"}. Credit status: ${snap.creditStatus ?? "not applied"}.`;
    case "fees":
      return PRODUCT.fees;
    case "verification":
      return `${PRODUCT.kyc} Your identity status is ${snap.kycStatus ?? "not started"}.`;
    case "status":
      return [
        `Banking partner: ${snap.configured ? "Column connected" : "not configured"}.`,
        `Environment: ${snap.environment}.`,
        `KYC: ${snap.kycStatus ?? "—"}.`,
        `Checking: ${snap.checkingStatus ?? "—"}.`,
        snap.disclaimer,
      ].join(" ");
    case "navigate":
      return `Use Home, Payments, Cards, Activity, and Profile. Help lives under Support. ${NAV_HINTS.map((n) => `${n.label}: ${n.href}`).join(" · ")}`;
    case "support":
      return "I can open a case for human operations. I cannot change balances or override verification. Say that you want to escalate, and include a short description.";
    case "sandbox":
      return PRODUCT.sandbox;
    case "assistant":
      return PRODUCT.assistant;
    case "demo":
      return "Sandbox demonstration transfers show the send experience without moving money. They go pending, then fail. Your actual balance does not change. They are labeled SANDBOX / DEMONSTRATION — NO REAL FUNDS MOVED. Real ACH still goes through Column when a checking account is open.";
    default:
      return PRODUCT.assistant;
  }
}

export function suggestHref(text: string): { href: string; label: string } | null {
  const q = text.toLowerCase();
  const hit = NAV_HINTS.find((n) => n.keywords.some((k) => q.includes(k)));
  return hit ? { href: hit.href, label: hit.label } : null;
}
