/**
 * Deterministic KYC workflow and agent. Not an LLM.
 * Column remains the banking-partner source of truth for identity used to open accounts.
 * MONEYLEAD review records completeness and SLA. Staff cannot fabricate Column verification.
 */

export const KYC_WORKFLOW_STATES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "SUBMITTED",
  "UNDER_REVIEW",
  "NEEDS_INFORMATION",
  "ESCALATED",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
  "REVIEW_REQUIRED",
] as const;

export type KycWorkflowState = (typeof KYC_WORKFLOW_STATES)[number];

export type KycAgentInput = {
  legalFirstName: string | null;
  legalLastName: string | null;
  dob: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  documentType: string | null;
  partnerStatus: string | null;
  deadlinePassed: boolean;
  autoApprovalEnabled: boolean;
};

export type KycAgentResult = {
  recommendation: "APPROVE" | "REJECT" | "NEEDS_INFORMATION" | "ESCALATE" | "HUMAN_REVIEW" | "AUTO_APPROVAL_ELIGIBLE";
  workflow: KycWorkflowState;
  reason: string;
  autoApprove: boolean;
};

export function mapPartnerToWorkflow(partner: string | null | undefined): KycWorkflowState {
  switch (partner) {
    case "approved":
      return "APPROVED";
    case "failed":
      return "REJECTED";
    case "additional_info":
    case "pending_documents":
    case "selfie_required":
      return "NEEDS_INFORMATION";
    case "manual_review":
      return "UNDER_REVIEW";
    case "processing":
      return "SUBMITTED";
    default:
      return "NOT_STARTED";
  }
}

export function customerKycLabel(partner: string | null | undefined, workflow?: string | null): string {
  const w = (workflow ?? "").toUpperCase();
  if (w === "EXPIRED") return "Expired";
  if (w === "ESCALATED") return "Review required";
  switch (partner) {
    case "approved":
      return "Verified";
    case "failed":
      return "Failed";
    case "additional_info":
    case "pending_documents":
    case "selfie_required":
      return "Needs attention";
    case "manual_review":
      return "Under review";
    case "processing":
      return "Pending";
    default:
      return "Not started";
  }
}

export function runKycAgent(input: KycAgentInput): KycAgentResult {
  const missing: string[] = [];
  if (!input.legalFirstName || !input.legalLastName) missing.push("legal name");
  if (!input.dob) missing.push("date of birth");
  if (!input.addressLine1 || !input.city || !input.state || !input.postalCode) missing.push("residential address");
  if (missing.length) {
    return {
      recommendation: "NEEDS_INFORMATION",
      workflow: "NEEDS_INFORMATION",
      reason: `Required information missing: ${missing.join(", ")}.`,
      autoApprove: false,
    };
  }
  if (input.deadlinePassed) {
    return {
      recommendation: "ESCALATE",
      workflow: "ESCALATED",
      reason: "The review deadline passed without a decision.",
      autoApprove: false,
    };
  }
  const partner = (input.partnerStatus ?? "").toLowerCase();
  if (partner === "failed") {
    return {
      recommendation: "REJECT",
      workflow: "REVIEW_REQUIRED",
      reason: "The verification provider reported a failed result. Human review is required.",
      autoApprove: false,
    };
  }
  if (partner === "manual_review") {
    return {
      recommendation: "HUMAN_REVIEW",
      workflow: "UNDER_REVIEW",
      reason: "The banking partner has the identity in review.",
      autoApprove: false,
    };
  }
  if (!input.documentType && partner !== "approved") {
    return {
      recommendation: "NEEDS_INFORMATION",
      workflow: "NEEDS_INFORMATION",
      reason: "A document type has not been recorded.",
      autoApprove: false,
    };
  }
  if (partner === "approved") {
    const auto = input.autoApprovalEnabled;
    return {
      recommendation: auto ? "AUTO_APPROVAL_ELIGIBLE" : "APPROVE",
      workflow: auto ? "APPROVED" : "UNDER_REVIEW",
      reason: auto
        ? "Partner verified and automated approval is enabled by policy."
        : "Partner verified. Authorized human review is still required by default policy.",
      autoApprove: auto,
    };
  }
  return {
    recommendation: "HUMAN_REVIEW",
    workflow: "UNDER_REVIEW",
    reason: "Application is complete enough for human review. The agent will not approve it.",
    autoApprove: false,
  };
}

export function kycDeadline(from: Date, slaHours: number): Date {
  const hours = Number.isFinite(slaHours) && slaHours > 0 ? slaHours : 24;
  return new Date(from.getTime() + hours * 60 * 60 * 1000);
}
