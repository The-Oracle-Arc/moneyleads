import type { KycStatus, TransferStatus, TxStatus } from "../types.ts";

export type ColumnVerificationStatus = "UNVERIFIED" | "PENDING" | "MANUAL_REVIEW" | "VERIFIED" | "DENIED";

export function mapColumnVerification(status: string | null | undefined): KycStatus {
  switch ((status ?? "").toUpperCase()) {
    case "VERIFIED":
      return "approved";
    case "PENDING":
      return "processing";
    case "MANUAL_REVIEW":
      return "manual_review";
    case "DENIED":
      return "failed";
    case "UNVERIFIED":
      return "pending_documents";
    default:
      return "processing";
  }
}

export function mapColumnAccountStatus(status: string | null | undefined): "pending" | "open" | "frozen" | "closed" {
  switch ((status ?? "").toLowerCase()) {
    case "open":
      return "open";
    case "frozen":
      return "frozen";
    case "closed":
      return "closed";
    default:
      return "pending";
  }
}

export function mapColumnAchStatus(status: string | null | undefined): TransferStatus {
  switch ((status ?? "").toUpperCase()) {
    case "SETTLED":
    case "COMPLETED":
      return "completed";
    case "RETURNED":
    case "PENDING_RETURN":
    case "RETURN_DISHONORED":
    case "RETURN_DISHONORED_FUNDS_UNLOCKED":
    case "RETURN_CONTESTED":
      return "returned";
    case "REVERSED":
    case "REVERSAL":
      return "reversed";
    case "CANCELED":
    case "CANCELLED":
      return "canceled";
    case "REJECTED":
      return "failed";
    case "INITIATED":
    case "PENDING_SUBMISSION":
    case "SUBMITTED":
    case "SCHEDULED":
    case "MANUAL_REVIEW":
    case "MANUAL_REVIEW_APPROVED":
    case "PRE_REVIEW":
      return "processing";
    default:
      return "pending";
  }
}

export function mapColumnAchToTxStatus(status: string | null | undefined): TxStatus {
  const transfer = mapColumnAchStatus(status);
  if (transfer === "completed") return "posted";
  if (transfer === "returned" || transfer === "reversed") return "reversed";
  if (transfer === "failed" || transfer === "canceled") return "failed";
  return "pending";
}

export function customerMessageForColumnError(code: unknown, message: string | undefined): string {
  const text = (message ?? "").toLowerCase();
  if (text.includes("insufficient") || text.includes("available balance")) {
    return "There is not enough available balance for this transfer.";
  }
  if (text.includes("duplicate") || text.includes("idempoten")) {
    return "This request was already submitted.";
  }
  if (text.includes("entity") && (text.includes("verif") || text.includes("denied"))) {
    return "Identity verification is not complete, so a checking account cannot be opened yet.";
  }
  if (text.includes("not found")) {
    return "The banking partner could not find that record.";
  }
  if (text.includes("unauthorized") || code === 401) {
    return "The banking partner rejected this environment’s credentials.";
  }
  if (text.includes("rate") || code === 429) {
    return "The banking partner is busy. Wait a moment and try again.";
  }
  return "The banking partner could not complete this request. Try again, or contact support if it continues.";
}
