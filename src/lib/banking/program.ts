/**
 * Banking-program status copy. Never claims FDIC insurance, partner approval,
 * or a live consumer bank unless the backend has verified it.
 *
 * SOFTWARE STATUS is independent of the banking-program relationship.
 */

import type { BankingEnvironment, BankingStatusView } from "./types";

export const ULTIMATE_ADMIN_EMAIL = "coltonhogan444@gmail.com";

export const SOFTWARE_STATUS = "PRODUCTION READY";

export const SOFTWARE_STATUS_LINE =
  "MONEYLEAD software is production-ready. The banking program follows its actual partner and regulatory status.";

export const PROGRAM_TITLE = "Banking Program Setup";

export const PROGRAM_SUMMARY =
  "MONEYLEAD is preparing for its production banking program and regulated banking-partner onboarding.";

export const PROGRAM_PRODUCTION_NOTE =
  "Production banking access will only be enabled after the required banking-program, compliance, underwriting, and partner approvals are completed.";

export const PROGRAM_CAPABILITIES = [
  "Consumer checking accounts",
  "Account and routing numbers",
  "ACH transfers",
  "Incoming ACH",
  "Account balances and transaction ledger",
  "Debit-card program",
  "Future credit-card program",
  "KYC/KYB",
  "AML and fraud controls",
  "Banking compliance",
  "Webhooks and transaction reconciliation",
] as const;

export const DEFAULT_STATUS_LINE = "Sandbox environment • Production banking integration pending approval";

export type BankingProgramView = {
  title: string;
  summary: string;
  statusLine: string;
  programStatus: "Preparing for Banking Program" | "Production banking program";
  environmentLabel: string;
  productionStatus: "Pending banking-partner onboarding" | "Live";
  productionNote: string;
  capabilities: readonly string[];
  columnConnected: boolean;
  environment: BankingEnvironment;
  programApproved: boolean;
};

export function programRelationshipApproved(
  banking?: Pick<BankingStatusView, "configured" | "environment"> | null,
  flags?: { programApproved?: boolean } | null,
): boolean {
  return Boolean(
    flags?.programApproved && banking?.configured && banking.environment === "live",
  );
}

export function programStatusLine(
  banking?: Pick<BankingStatusView, "configured" | "environment"> | null,
  flags?: { programApproved?: boolean } | null,
): string {
  if (programRelationshipApproved(banking, flags)) {
    return "Column Live • Production banking program";
  }
  if (banking?.configured && banking.environment === "live") {
    return "Banking partner connected • Production banking integration pending approval";
  }
  if (banking?.configured) return "Column Sandbox • Production banking integration pending approval";
  return DEFAULT_STATUS_LINE;
}

export function bankingProgramFromStatus(
  banking: Pick<BankingStatusView, "configured" | "environment">,
  flags?: { programApproved?: boolean } | null,
): BankingProgramView {
  const approved = programRelationshipApproved(banking, flags);
  const environmentLabel = !banking.configured
    ? "Sandbox environment"
    : banking.environment === "live"
      ? approved
        ? "Column Live"
        : "Column (production credentials present)"
      : "Column Sandbox";
  return {
    title: PROGRAM_TITLE,
    summary: PROGRAM_SUMMARY,
    statusLine: programStatusLine(banking, flags),
    programStatus: approved ? "Production banking program" : "Preparing for Banking Program",
    environmentLabel,
    productionStatus: approved ? "Live" : "Pending banking-partner onboarding",
    productionNote: PROGRAM_PRODUCTION_NOTE,
    capabilities: PROGRAM_CAPABILITIES,
    columnConnected: banking.configured,
    environment: banking.environment,
    programApproved: approved,
  };
}

export const PROGRAM_DISCLAIMER = `${PROGRAM_SUMMARY} ${PROGRAM_PRODUCTION_NOTE}`;
