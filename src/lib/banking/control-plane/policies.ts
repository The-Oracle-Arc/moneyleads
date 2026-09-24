/**
 * Deterministic product policy. The control plane owns these rules.
 * An LLM may quote them; it may not change them.
 */

export const PRODUCT = {
  name: "MONEYLEAD",
  tagline: "Simple banking. Built for you.",
  checking: "U.S. checking accounts. Account and routing numbers come from the banking partner after identity verification.",
  cards: "Debit cards are part of the product vision. Column’s public API does not issue consumer debit cards, so debit is not issued here. Credit applications are stored; no issuer is connected, so MONEYLEAD never auto-approves credit.",
  ach: "ACH credits and debits are originated through the banking partner. Incoming ACH in sandbox is processed on Column’s schedule. MONEYLEAD does not mark a transfer complete on its own.",
  sandbox: "MONEYLEAD is preparing for its production banking program and regulated banking-partner onboarding. Sandbox environment • Production banking integration pending approval. Production banking access is enabled only after required program, compliance, underwriting, and partner approvals.",
  unconfigured: "MONEYLEAD is preparing for its production banking program. Checking accounts, routing numbers, and balances appear only after the banking partner is connected. MONEYLEAD will not invent those values.",
  kyc: "Identity verification used to open a checking account is owned by the banking partner. MONEYLEAD staff may record a separate review with SLA; that review does not fabricate Column verification or open an account.",
  fees: "MONEYLEAD does not publish a live consumer fee schedule in sandbox. There are no invented overdraft fees, ATM fees, or interest rates here.",
  assistant:
    "The MONEYLEAD Assistant is a guide. It cannot change balances, approve credit, bypass verification, or call the banking partner with unrestricted credentials.",
} as const;

export const TX_STATUS_COPY: Record<string, string> = {
  pending: "Submitted. Waiting on the banking partner.",
  processing: "The banking partner is processing this item.",
  posted: "Posted to your ledger from the banking partner.",
  completed: "The banking partner reported this as settled.",
  failed: "The banking partner reported a failure.",
  reversed: "Reversed after a later partner update.",
  refunded: "Refunded.",
  disputed: "In dispute review.",
  canceled: "Canceled before settlement.",
  returned: "Returned by the receiving institution.",
};

export const NAV_HINTS: { keywords: string[]; href: string; label: string }[] = [
  { keywords: ["home", "overview", "balance"], href: "/home", label: "Home" },
  { keywords: ["pay", "payments", "send", "receive", "add money"], href: "/payments", label: "Payments" },
  { keywords: ["bank", "checking", "routing", "account number", "details"], href: "/bank/details", label: "Account details" },
  { keywords: ["transfer", "ach"], href: "/bank/transfers", label: "Transfers" },
  { keywords: ["activity", "transaction", "history"], href: "/activity", label: "Activity" },
  { keywords: ["statement"], href: "/bank/statements", label: "Statements" },
  { keywords: ["card", "debit", "credit"], href: "/cards", label: "Cards" },
  { keywords: ["profile", "security", "privacy", "device"], href: "/profile", label: "Profile" },
  { keywords: ["support", "help", "human", "agent"], href: "/support", label: "Support" },
  { keywords: ["onboarding", "verify", "kyc", "identity"], href: "/onboarding", label: "Onboarding" },
];

export const SENSITIVE_ACTIONS = new Set([
  "transfer.send",
  "checking.submit",
  "account.close",
  "card.issue",
  "credit.apply",
  "credit.pay",
]);
