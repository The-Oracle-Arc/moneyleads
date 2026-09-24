/**
 * Shared MONEYLEAD domain types. Safe for client and server.
 * Never put secrets, API keys, or raw PANs here.
 */

export const APP_NAME = "MONEYLEAD";
export const APP_TAGLINE = "Simple banking. Built for you.";

export const SANDBOX_DISCLAIMER =
  "MONEYLEAD is preparing for its production banking program and regulated banking-partner onboarding. Sandbox environment • Production banking integration pending approval. Production banking access will only be enabled after the required banking-program, compliance, underwriting, and partner approvals are completed.";

export const UNCONFIGURED_DISCLAIMER =
  "MONEYLEAD cannot open a checking account until a banking partner credential is configured. Account numbers and routing numbers are never generated locally.";

export const SESSION_LOCK_MS = 120_000;
export const DEMO_OTP_CODE = "123456";

export type AddressSuggestion = {
  line1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  label: string;
};

export type BankingEnvironment = "sandbox" | "live" | "unconfigured";

export type BankingStatusView = {
  configured: boolean;
  environment: BankingEnvironment;
  providerName: string;
  cardsAvailable: boolean;
  creditIssuerAvailable: boolean;
  simulateAvailable: boolean;
  webhookSecretConfigured: boolean;
};

export type StaffRole =
  | "viewer"
  | "support"
  | "ops"
  | "risk"
  | "compliance"
  | "finance"
  | "success"
  | "engineer"
  | "admin"
  | "ultimate_admin";

export const STAFF_ROLES: StaffRole[] = [
  "viewer",
  "support",
  "ops",
  "risk",
  "compliance",
  "finance",
  "success",
  "engineer",
  "admin",
  "ultimate_admin",
];

export function formatStaffRole(role: string | null | undefined): string {
  if (!role) return "—";
  if (role === "ultimate_admin") return "ULTIMATE_ADMIN";
  return role.replaceAll("_", " ");
}

export const ROLE_LABELS: Record<StaffRole, string> = {
  viewer: "Viewer",
  support: "Support",
  ops: "Operations",
  risk: "Risk / Fraud",
  compliance: "Compliance (KYC reviewer)",
  finance: "Finance",
  success: "Customer Success",
  engineer: "Technical",
  admin: "Administrator",
  ultimate_admin: "Ultimate Administrator",
};

/** Client-safe permission matrix. Engine enforces the same ids server-side. */
export const ROLE_CAPABILITIES: { id: string; label: string; roles: StaffRole[] }[] = [
  { id: "kyc.refresh", label: "Refresh Column identity status", roles: ["compliance", "ops", "admin", "risk", "support", "success", "ultimate_admin"] },
  { id: "kyc.review.approve", label: "Record MONEYLEAD KYC review", roles: ["compliance", "admin", "ultimate_admin"] },
  { id: "kyc.review.reject", label: "Reject MONEYLEAD KYC review", roles: ["compliance", "admin", "ultimate_admin"] },
  { id: "kyc.review.request_info", label: "Request KYC information", roles: ["compliance", "ops", "admin", "risk", "ultimate_admin"] },
  { id: "kyc.review.escalate", label: "Escalate KYC", roles: ["compliance", "ops", "admin", "risk", "ultimate_admin"] },
  { id: "dispute.resolve", label: "Resolve disputes", roles: ["risk", "ops", "admin", "support", "ultimate_admin"] },
  { id: "fraud.clear", label: "Clear fraud alerts", roles: ["risk", "admin", "ultimate_admin"] },
  { id: "support.close", label: "Close support cases", roles: ["support", "ops", "admin", "success", "ultimate_admin"] },
  { id: "support.reply", label: "Reply to support cases", roles: ["support", "ops", "admin", "success", "ultimate_admin"] },
  { id: "account.sync", label: "Sync account from partner", roles: ["ops", "admin", "risk", "compliance", "engineer", "finance", "ultimate_admin"] },
  { id: "notify.customer", label: "Notify a customer", roles: ["support", "ops", "admin", "success", "ultimate_admin"] },
  { id: "note.add", label: "Add internal customer notes", roles: ["support", "ops", "admin", "risk", "compliance", "success", "ultimate_admin"] },
  { id: "flag.set", label: "Change feature flags", roles: ["admin", "ops", "ultimate_admin"] },
  { id: "staff.invite", label: "Invite staff", roles: ["admin", "ultimate_admin"] },
  { id: "staff.revoke", label: "Revoke staff access", roles: ["admin", "ultimate_admin"] },
  { id: "staff.setRole", label: "Change staff role", roles: ["admin", "ultimate_admin"] },
  { id: "historical.ingest", label: "Ingest historical records", roles: ["ops", "finance", "admin", "compliance", "risk", "ultimate_admin"] },
  { id: "historical.correct", label: "Correct historical records", roles: ["ops", "finance", "admin", "compliance", "ultimate_admin"] },
  { id: "credit.approve", label: "Record credit decision (no invented underwriting)", roles: ["compliance", "admin", "risk", "ultimate_admin"] },
  { id: "credit.decline", label: "Decline credit application", roles: ["compliance", "admin", "risk", "ultimate_admin"] },
];


export type OnboardingStep =
  | "welcome"
  | "email"
  | "username"
  | "phone"
  | "personal"
  | "kyc"
  | "security"
  | "review"
  | "opening"
  | "funding"
  | "debit_card"
  | "complete";

export type ApplicationStatus =
  | "not_started"
  | "submitted"
  | "processing"
  | "additional_review"
  | "additional_info"
  | "approved"
  | "declined"
  | "withdrawn";

export type KycStatus =
  | "not_started"
  | "processing"
  | "pending_documents"
  | "selfie_required"
  | "manual_review"
  | "additional_info"
  | "approved"
  | "failed";

export type CardStatus =
  | "pending"
  | "shipping"
  | "needs_activation"
  | "active"
  | "frozen"
  | "locked"
  | "closed";

export type TxStatus =
  | "pending"
  | "processing"
  | "posted"
  | "completed"
  | "failed"
  | "reversed"
  | "refunded"
  | "disputed"
  | "canceled"
  | "returned";

export type TransferStatus = "pending" | "processing" | "completed" | "failed" | "canceled" | "returned" | "reversed";

export type CustomerProfile = {
  id: string;
  userId: string;
  email: string | null;
  emailVerified: boolean;
  username: string | null;
  moneyleadUserId: string | null;
  legalFirstName: string | null;
  middleName: string | null;
  legalLastName: string | null;
  preferredName: string | null;
  dob: string | null;
  citizenship: string | null;
  residencyStatus: string | null;
  ssnLast4: string | null;
  phone: string | null;
  phoneVerified: boolean;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  onboardingStep: OnboardingStep;
  onboardingStatus: ApplicationStatus;
  kycStatus: KycStatus;
  kycLabel: string;
  kycWorkflow: string | null;
  kycReviewDeadline: string | null;
  kycSubmittedAt: string | null;
  checkingStatus: ApplicationStatus;
  debitCardStatus: CardStatus | "not_started";
  creditStatus: "not_applied" | "submitted" | "processing" | "additional_review" | "additional_info" | "approved" | "declined";
  biometricsEnabled: boolean;
  twoFactorEnabled: boolean;
  passcodeSet: boolean;
  loginAlerts: boolean;
  privacyMode: boolean;
  isDemo: boolean;
  accountClosedAt: string | null;
  createdAt: string;
  providerEntityId: string | null;
};

export type BankAccountView = {
  id: string;
  name: string;
  product: "checking";
  accountNumberMasked: string;
  accountNumberFull: string;
  routingNumber: string;
  routingIsDemo: boolean;
  isSandbox: boolean;
  providerAccountId: string | null;
  currentCents: number;
  availableCents: number;
  pendingCents: number;
  status: "pending" | "open" | "frozen" | "closed";
  openedAt: string | null;
};

export type DebitCardView = {
  id: string;
  last4: string;
  expMonth: number;
  expYear: number;
  status: CardStatus;
  holderName: string;
  network: "visa";
  pinSet: boolean;
  frozen: boolean;
  shippingStatus: string | null;
  wallets: string[];
  controls: {
    online: boolean;
    atm: boolean;
    pos: boolean;
    international: boolean;
  };
};

export type CreditCardView = {
  id: string;
  last4: string;
  expMonth: number;
  expYear: number;
  status: CardStatus;
  holderName: string;
  network: "visa";
  currentBalanceCents: number;
  creditLimitCents: number;
  availableCreditCents: number;
  statementBalanceCents: number;
  minimumPaymentCents: number;
  paymentDueDate: string | null;
  autopayEnabled: boolean;
  autopayAmount: "minimum" | "statement" | "full" | null;
  frozen: boolean;
  aprPurchaseBps: number;
};

export type TransactionView = {
  id: string;
  accountId: string | null;
  cardId: string | null;
  accountLabel: string;
  merchant: string;
  description: string;
  amountCents: number;
  status: TxStatus;
  category: string;
  last4: string | null;
  createdAt: string;
  postedAt: string | null;
  isDemonstration: boolean;
};

export type TransactionDetail = TransactionView & {
  idempotencyKey: string;
  ledgerId: string | null;
  counterparty: string | null;
  disputeId: string | null;
};

export type TransferView = {
  id: string;
  direction: "inbound" | "outbound";
  method: "ach" | "direct_deposit";
  amountCents: number;
  status: TransferStatus;
  counterpartyName: string;
  counterpartyDetail: string | null;
  createdAt: string;
  estimatedSettlement: string | null;
};

export type StatementView = {
  id: string;
  product: "checking" | "credit";
  periodStart: string;
  periodEnd: string;
  openingCents: number;
  closingCents: number;
  creditsCents?: number;
  debitsCents?: number;
  feesCents?: number;
};

export type StatementDetail = StatementView & {
  transactions: TransactionView[];
  holderName?: string;
  moneyleadUserId?: string | null;
  accountLast4?: string | null;
  sandbox?: boolean;
};

export type NotificationView = {
  id: string;
  title: string;
  body: string;
  kind: string;
  readAt: string | null;
  createdAt: string;
};

export type DeviceView = {
  id: string;
  name: string;
  trusted: boolean;
  current: boolean;
  lastSeenAt: string;
  ipCity: string | null;
};

export type FraudAlertView = {
  id: string;
  title: string;
  body: string;
  severity: "low" | "medium" | "high";
  status: "open" | "acknowledged" | "cleared";
  createdAt: string;
};

export type SupportCaseView = {
  id: string;
  subject: string;
  status: "open" | "pending" | "waiting_on_customer" | "closed";
  createdAt: string;
  updatedAt: string;
};

export type SupportMessageView = {
  id: string;
  author: "customer" | "agent";
  body: string;
  createdAt: string;
};

export type StatusItem = {
  key: string;
  label: string;
  state: "complete" | "pending" | "action" | "not_started" | "blocked";
  detail: string;
};

export type FeatureFlags = {
  creditApplicationsOpen: boolean;
  assistantEnabled: boolean;
  sandboxIncomingAch: boolean;
  newSignupsOpen: boolean;
  staffCustomerMessaging: boolean;
  sandboxDemonstration: boolean;
  bankingTransfers: boolean;
  cardsProgram: boolean;
  creditProgram: boolean;
  supportMessaging: boolean;
  onboardingOpen: boolean;
};

export const FLAG_CATALOG: Record<string, string> = {
  credit_applications_open: "Allow customers to submit a credit application. Applications are stored; no issuer is connected.",
  assistant_enabled: "Show the MONEYLEAD Assistant. Banking still works if this is off.",
  sandbox_incoming_ach: "Allow sandbox incoming ACH credits through Column.",
  new_signups_open: "Allow new customer sign-ups.",
  staff_customer_messaging: "Allow operators to send in-app messages to customers.",
  sandbox_demonstration: "Allow sandbox demonstration transfers. These never move real funds or change balances.",
  banking_transfers: "Allow real ACH through the banking partner when configured.",
  cards_program: "Show the card program. Cards are not issued without a processor.",
  credit_program: "Show credit applications. Nothing is auto-approved.",
  support_messaging: "Allow customers to open support cases.",
  onboarding_open: "Allow customers to continue onboarding.",
};

export type Workspace = {
  disclaimer: string;
  isDemo: boolean;
  isSandbox: boolean;
  banking: BankingStatusView;
  providerSyncError: string | null;
  profile: CustomerProfile;
  staffRole: StaffRole | null;
  status: StatusItem[];
  checking: BankAccountView | null;
  debitCard: DebitCardView | null;
  creditCard: CreditCardView | null;
  recentTransactions: TransactionView[];
  notificationsUnread: number;
  fraudOpen: number;
  flags: FeatureFlags;
  greeting: string;
};

export type CustomerDocument = {
  id: string;
  kind: "statement" | "receipt" | "notice" | "kyc";
  title: string;
  filename: string;
  createdAt: string;
};

export type DemoTransferView = {
  id: string;
  amountCents: number;
  counterpartyName: string;
  status: "pending" | "failed";
  failureReason: string | null;
  createdAt: string;
  transactionId: string | null;
};

