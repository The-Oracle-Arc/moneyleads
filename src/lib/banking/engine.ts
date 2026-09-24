import { getSql, dbSource, type Sql } from "@/lib/db";
import { publicBankingStatus, resolvedBankingEnvironment, serverEnv } from "./env";
import { sha256, safeEqual } from "./hash";
import { newId, toE164Us } from "./ids";
import { providers } from "./providers";
import { mapColumnAchStatus } from "./column/status";
import { ColumnApiError } from "./column/client";
import { BankingConfigError } from "./env";
import { syncColumnAccount } from "./sync";
import { resolveStaffRole, inviteStaff, revokeStaff, listStaff } from "./staff";
import { STAFF_ROLES, FLAG_CATALOG } from "./types";
import { bankingProgramFromStatus } from "./program";
import { aiProviderStatus, emailProviderConfigured } from "@/lib/ai/provider";
import { formatMoneyleadUserId, greetingFor, validateUsername, DEMO_WATERMARK } from "./identity";
import { customerKycLabel, kycDeadline, mapPartnerToWorkflow, runKycAgent } from "./kyc-workflow";
import { buildPdf, uint8ToBase64 } from "./pdf";
import { buildZip } from "./zip";
import {
  APP_NAME,
  SANDBOX_DISCLAIMER,
  UNCONFIGURED_DISCLAIMER,
  type AddressSuggestion,
  type ApplicationStatus,
  type BankAccountView,
  type CardStatus,
  type CreditCardView,
  type CustomerProfile,
  type DebitCardView,
  type DeviceView,
  type FeatureFlags,
  type FraudAlertView,
  type KycStatus,
  type NotificationView,
  type OnboardingStep,
  type StaffRole,
  ROLE_CAPABILITIES,
  type StatementDetail,
  type StatementView,
  type StatusItem,
  type SupportCaseView,
  type SupportMessageView,
  type TransactionDetail,
  type TransactionView,
  type TransferView,
  type TxStatus,
  type Workspace,
} from "./types";

function columnError(err: unknown, fallback: string): string {
  if (err instanceof BankingConfigError) return err.message;
  if (err instanceof ColumnApiError) return err.customerMessage;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function partnerMissing(): string {
  return "Banking partner is not configured. MONEYLEAD will not invent account numbers, routing numbers, or balances.";
}

function isSandboxEnv(): boolean {
  return resolvedBankingEnvironment() !== "live";
}

type Row = Record<string, unknown>;

export function iso(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

export function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string" && v !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
  }
  return 0;
}

export function bool(v: unknown): boolean {
  return v === true || v === "t" || v === "true";
}

export async function db(): Promise<Sql> {
  return getSql();
}

export async function writeAudit(
  sql: Sql,
  p: {
    actorUserId?: string | null;
    actorRole?: string | null;
    action: string;
    entityType?: string;
    entityId?: string;
    metadata?: unknown;
  },
) {
  await sql`insert into audit_logs (id, actor_user_id, actor_role, action, entity_type, entity_id, metadata)
    values (${newId("aud")}, ${p.actorUserId ?? null}, ${p.actorRole ?? null}, ${p.action}, ${p.entityType ?? null}, ${p.entityId ?? null}, ${p.metadata ? JSON.stringify(p.metadata) : null})`;
}

export async function pushNotification(
  sql: Sql,
  p: { userId: string; title: string; body: string; kind: string },
) {
  await sql`insert into notifications (id, user_id, title, body, kind)
    values (${newId("ntf")}, ${p.userId}, ${p.title}, ${p.body}, ${p.kind})`;
  const prefs = await sql<Row>`select * from notification_preferences where user_id = ${p.userId} limit 1`;
  const emailOn = !prefs[0] || bool(prefs[0].email_enabled);
  const pushOn = !prefs[0] || bool(prefs[0].push_enabled);
  const smsOn = prefs[0] ? bool(prefs[0].sms_enabled) : false;
  if (emailOn) await providers.notify.sendEmail("demo@local", p.title, p.body);
  if (pushOn) await providers.notify.sendPush(p.userId, p.title, p.body);
  if (smsOn) await providers.notify.sendSms("12025550188", `${p.title}: ${p.body}`);
}

async function hitRateLimit(sql: Sql, key: string, max: number, windowMs: number): Promise<boolean> {
  const rows = await sql<Row>`select count, window_start from rate_limits where key = ${key}`;
  const now = Date.now();
  const start = rows[0] ? new Date(String(rows[0].window_start)).getTime() : 0;
  if (!rows[0] || now - start > windowMs) {
    await sql`insert into rate_limits (key, count, window_start) values (${key}, 1, now())
      on conflict (key) do update set count = 1, window_start = now()`;
    return true;
  }
  if (num(rows[0].count) >= max) return false;
  await sql`update rate_limits set count = count + 1 where key = ${key}`;
  return true;
}

export async function authEmail(sql: Sql, userId: string): Promise<{ email: string | null; verified: boolean }> {
  try {
    const rows = await sql<Row>`select email, "emailVerified" as email_verified from "user" where id = ${userId} limit 1`;
    if (!rows[0]) return { email: null, verified: false };
    return { email: rows[0].email ? String(rows[0].email) : null, verified: bool(rows[0].email_verified) };
  } catch {
    return { email: null, verified: false };
  }
}

export async function ensureProfile(sql: Sql, userId: string): Promise<Row> {
  const existing = await sql<Row>`select * from customer_profiles where user_id = ${userId} limit 1`;
  const identity = await authEmail(sql, userId);
  if (existing[0]) {
    if (identity.email && !existing[0].email) {
      await sql`update customer_profiles set email = ${identity.email}, updated_at = now() where user_id = ${userId}`;
      existing[0].email = identity.email;
    }
    if (identity.verified && !existing[0].email_verified_at) {
      await sql`update customer_profiles set email_verified_at = now(),
        onboarding_step = case when onboarding_step in ('welcome','email') then 'username' else onboarding_step end,
        updated_at = now() where user_id = ${userId}`;
      existing[0].email_verified_at = new Date().toISOString();
      existing[0].onboarding_step = existing[0].onboarding_step === "welcome" || existing[0].onboarding_step === "email" ? "username" : existing[0].onboarding_step;
    }
    if (!existing[0].username && ["welcome", "email", "phone"].includes(String(existing[0].onboarding_step))) {
      await sql`update customer_profiles set onboarding_step = 'username', updated_at = now() where user_id = ${userId}`;
      existing[0].onboarding_step = "username";
    }
    if (!existing[0].moneylead_user_id) {
      await ensureMoneyleadUserId(sql, userId);
      const refreshed = await sql<Row>`select * from customer_profiles where user_id = ${userId} limit 1`;
      return refreshed[0] ?? existing[0];
    }
    return existing[0];
  }
  const id = newId("cus");
  const initialStep = identity.verified ? "username" : "email";
  await sql`insert into customer_profiles (id, user_id, email, email_verified_at, onboarding_step, is_demo)
    values (${id}, ${userId}, ${identity.email}, ${identity.verified ? new Date().toISOString() : null}, ${initialStep}, false)`;
  await sql`insert into notification_preferences (user_id) values (${userId}) on conflict (user_id) do nothing`;
  await sql`insert into devices (id, user_id, name, trusted, current_flag, ip_city)
    values (${newId("dev")}, ${userId}, 'This browser', true, true, 'Unknown')`;
  await writeAudit(sql, {
    actorUserId: userId,
    action: "profile.created",
    entityType: "customer_profile",
    entityId: id,
    metadata: { created: true },
  });
  const created = await sql<Row>`select * from customer_profiles where id = ${id}`;
  const row = created[0]!;
  await ensureMoneyleadUserId(sql, userId);
  const fresh = await sql<Row>`select * from customer_profiles where id = ${id}`;
  return fresh[0] ?? row;
}

async function ensureMoneyleadUserId(sql: Sql, userId: string) {
  try {
    const existing = await sql<Row>`select moneylead_user_id from customer_profiles where user_id = ${userId} limit 1`;
    if (existing[0]?.moneylead_user_id) return String(existing[0].moneylead_user_id);
    const next = await sql<{ value: number }>`
      update identity_counters set value = value + 1 where name = 'moneylead_user' returning value
    `;
    const n = num(next[0]?.value) || 18427;
    const mlid = formatMoneyleadUserId(n);
    await sql`update customer_profiles set moneylead_user_id = ${mlid} where user_id = ${userId} and moneylead_user_id is null`;
    return mlid;
  } catch {
    return null;
  }
}

function latestAddress(rows: Row[]): Row | null {
  return rows[0] ?? null;
}

export function mapProfile(row: Row, address: Row | null): CustomerProfile {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    email: row.email ? String(row.email) : null,
    emailVerified: Boolean(row.email_verified_at),
    username: row.username ? String(row.username) : null,
    moneyleadUserId: row.moneylead_user_id ? String(row.moneylead_user_id) : null,
    legalFirstName: row.legal_first_name ? String(row.legal_first_name) : null,
    middleName: row.middle_name ? String(row.middle_name) : null,
    legalLastName: row.legal_last_name ? String(row.legal_last_name) : null,
    preferredName: row.preferred_name ? String(row.preferred_name) : null,
    dob: row.dob ? String(row.dob).slice(0, 10) : null,
    citizenship: row.citizenship ? String(row.citizenship) : null,
    residencyStatus: row.residency_status ? String(row.residency_status) : null,
    ssnLast4: row.ssn_last4 ? String(row.ssn_last4) : null,
    phone: row.phone ? String(row.phone) : null,
    phoneVerified: Boolean(row.phone_verified_at),
    addressLine1: address?.line1 ? String(address.line1) : null,
    addressLine2: address?.line2 ? String(address.line2) : null,
    city: address?.city ? String(address.city) : null,
    state: address?.state ? String(address.state) : null,
    postalCode: address?.postal_code ? String(address.postal_code) : null,
    onboardingStep: String(row.onboarding_step) as OnboardingStep,
    onboardingStatus: String(row.onboarding_status) as ApplicationStatus,
    kycStatus: String(row.kyc_status) as KycStatus,
    kycLabel: customerKycLabel(String(row.kyc_status)),
    kycWorkflow: null,
    kycReviewDeadline: null,
    kycSubmittedAt: null,
    checkingStatus: String(row.checking_status) as ApplicationStatus,
    debitCardStatus: String(row.debit_card_status) as CardStatus | "not_started",
    creditStatus: String(row.credit_status) as CustomerProfile["creditStatus"],
    biometricsEnabled: bool(row.biometrics_enabled),
    twoFactorEnabled: bool(row.two_factor_enabled),
    passcodeSet: Boolean(row.passcode_hash),
    loginAlerts: bool(row.login_alerts),
    privacyMode: bool(row.privacy_mode),
    isDemo: bool(row.is_demo),
    accountClosedAt: iso(row.account_closed_at),
    createdAt: iso(row.created_at) ?? "",
    providerEntityId: row.provider_entity_id ? String(row.provider_entity_id) : null,
  };
}

export function holderName(profile: CustomerProfile): string {
  const parts = [profile.legalFirstName, profile.legalLastName].filter(Boolean);
  if (parts.length) return parts.join(" ");
  if (profile.email) return profile.email.split("@")[0] ?? APP_NAME;
  return "Cardholder";
}

function maskAccount(numStr: string): string {
  const digits = numStr.replace(/\D/g, "");
  return `••••${digits.slice(-4)}`;
}

function last4Digits(value: unknown): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : "";
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  creditApplicationsOpen: true,
  assistantEnabled: true,
  sandboxIncomingAch: true,
  newSignupsOpen: true,
  staffCustomerMessaging: true,
  sandboxDemonstration: true,
  bankingTransfers: true,
  cardsProgram: true,
  creditProgram: true,
  supportMessaging: true,
  onboardingOpen: true,
};

const FLAG_KEYS = new Set(Object.keys(FLAG_CATALOG));

export function mapFlags(raw: Record<string, boolean>): FeatureFlags {
  return {
    creditApplicationsOpen: raw.credit_applications_open !== false,
    assistantEnabled: raw.assistant_enabled !== false,
    sandboxIncomingAch: raw.sandbox_incoming_ach !== false,
    newSignupsOpen: raw.new_signups_open !== false,
    staffCustomerMessaging: raw.staff_customer_messaging !== false,
    sandboxDemonstration: raw.sandbox_demonstration !== false,
    bankingTransfers: raw.banking_transfers !== false,
    cardsProgram: raw.cards_program !== false,
    creditProgram: raw.credit_program !== false,
    supportMessaging: raw.support_messaging !== false,
    onboardingOpen: raw.onboarding_open !== false,
  };
}

export async function loadFeatureFlags(): Promise<FeatureFlags> {
  try {
    const sql = await db();
    const rows = await sql<{ key: string; enabled: boolean | string }>`select key, enabled from feature_flags`;
    const raw: Record<string, boolean> = {
      credit_applications_open: true,
      assistant_enabled: true,
      sandbox_incoming_ach: true,
      new_signups_open: true,
      staff_customer_messaging: true,
      sandbox_demonstration: true,
      banking_transfers: true,
      cards_program: true,
      credit_program: true,
      support_messaging: true,
      onboarding_open: true,
    };
    for (const row of rows) raw[row.key] = bool(row.enabled);
    return mapFlags(raw);
  } catch {
    return { ...DEFAULT_FEATURE_FLAGS };
  }
}


export function buildStatus(profile: CustomerProfile, debit: DebitCardView | null): StatusItem[] {
  const item = (
    key: string,
    label: string,
    done: boolean,
    pending: boolean,
    detail: string,
    notStarted = !done && !pending,
  ): StatusItem => ({
    key,
    label,
    state: done ? "complete" : pending ? "pending" : notStarted ? "not_started" : "action",
    detail,
  });
  return [
    item("email", "Email", profile.emailVerified, false, profile.emailVerified ? "Verified" : "Verify email"),
    item("phone", "Phone", profile.phoneVerified, false, profile.phoneVerified ? "Verified" : "Verify phone"),
    item(
      "identity",
      "Identity",
      profile.kycStatus === "approved",
      ["processing", "pending_documents", "selfie_required", "manual_review"].includes(profile.kycStatus),
      profile.kycStatus === "approved"
        ? "Verified"
        : profile.kycStatus === "manual_review"
          ? "In review"
          : "Verify identity",
    ),
    item(
      "checking",
      "Checking",
      profile.checkingStatus === "approved",
      ["submitted", "processing", "additional_review"].includes(profile.checkingStatus),
      profile.checkingStatus === "approved" ? "Open" : "Open account",
    ),
    item(
      "debit",
      "Debit card",
      debit?.status === "active",
      Boolean(debit && debit.status !== "active" && debit.status !== "closed"),
      !debit
        ? "Not issued"
        : debit.status === "shipping"
          ? "Shipping"
          : debit.status === "needs_activation"
            ? "Activate"
            : debit.status === "active"
              ? "Active"
              : debit.status,
    ),
    item(
      "credit",
      "Credit card",
      profile.creditStatus === "approved",
      ["submitted", "processing", "additional_review", "additional_info"].includes(profile.creditStatus),
      profile.creditStatus === "not_applied"
        ? "Not applied"
        : profile.creditStatus === "approved"
          ? "Open"
          : profile.creditStatus === "declined"
            ? "Declined"
            : "In review",
    ),
  ];
}

function mapTx(row: Row): TransactionView {
  return {
    id: String(row.id),
    accountId: row.account_id ? String(row.account_id) : null,
    cardId: row.card_id ? String(row.card_id) : null,
    accountLabel: String(row.account_label ?? "Account"),
    merchant: String(row.merchant),
    description: String(row.description),
    amountCents: num(row.amount_cents),
    status: String(row.status) as TxStatus,
    category: String(row.category ?? "other"),
    last4: row.last4 ? String(row.last4) : null,
    createdAt: iso(row.occurred_at) ?? iso(row.created_at) ?? "",
    postedAt: iso(row.posted_at),
    isDemonstration: bool(row.is_demonstration),
  };
}

function mapChecking(acc: Row, bal: Row | null): BankAccountView {
  const sandbox = bool(acc.is_demo) || isSandboxEnv();
  return {
    id: String(acc.id),
    name: String(acc.name ?? "Checking"),
    product: "checking",
    accountNumberMasked: maskAccount(String(acc.account_number)),
    accountNumberFull: String(acc.account_number),
    routingNumber: String(acc.routing_number),
    routingIsDemo: sandbox,
    isSandbox: sandbox,
    providerAccountId: acc.provider_account_id ? String(acc.provider_account_id) : null,
    currentCents: num(bal?.current_cents),
    availableCents: num(bal?.available_cents),
    pendingCents: num(bal?.pending_cents),
    status: String(acc.status) as BankAccountView["status"],
    openedAt: iso(acc.opened_at),
  };
}

function mapDebit(row: Row): DebitCardView {
  return {
    id: String(row.id),
    last4: String(row.last4),
    expMonth: num(row.exp_month),
    expYear: num(row.exp_year),
    status: String(row.status) as CardStatus,
    holderName: String(row.holder_name),
    network: "visa",
    pinSet: Boolean(row.pin_hash),
    frozen: bool(row.frozen),
    shippingStatus: row.shipping_status ? String(row.shipping_status) : null,
    wallets: [],
    controls: {
      online: bool(row.online_enabled),
      atm: bool(row.atm_enabled),
      pos: bool(row.pos_enabled),
      international: bool(row.international_enabled),
    },
  };
}

function mapCredit(row: Row, pendingCents: number): CreditCardView {
  const limit = num(row.credit_limit_cents);
  const current = num(row.current_balance_cents);
  return {
    id: String(row.id),
    last4: String(row.last4),
    expMonth: num(row.exp_month),
    expYear: num(row.exp_year),
    status: String(row.status) as CardStatus,
    holderName: String(row.holder_name),
    network: "visa",
    currentBalanceCents: current,
    creditLimitCents: limit,
    availableCreditCents: Math.max(0, limit - current - pendingCents),
    statementBalanceCents: num(row.statement_balance_cents),
    minimumPaymentCents: num(row.minimum_payment_cents),
    paymentDueDate: row.payment_due_date ? String(row.payment_due_date).slice(0, 10) : null,
    autopayEnabled: bool(row.autopay_enabled),
    autopayAmount: (row.autopay_amount ? String(row.autopay_amount) : null) as CreditCardView["autopayAmount"],
    frozen: bool(row.frozen),
    aprPurchaseBps: num(row.apr_purchase_bps),
  };
}

export async function getWorkspace(userId: string): Promise<Workspace> {
  const sql = await db();
  const banking = publicBankingStatus();
  const profileRow = await ensureProfile(sql, userId);
  const addresses = await sql<Row>`select * from addresses where user_id = ${userId} order by created_at desc limit 1`;
  let profile = mapProfile(profileRow, latestAddress(addresses));
  const staffRole = await resolveStaffRole(sql, userId);
  const accounts = await sql<Row>`select * from bank_accounts where user_id = ${userId} and product = 'checking' order by created_at desc limit 1`;
  let providerSyncError: string | null = null;
  if (accounts[0]?.provider_account_id && providers.columnBanking) {
    const synced = await syncColumnAccount(sql, accounts[0]);
    if (synced.error) providerSyncError = synced.error;
  }
  if (profile.providerEntityId && providers.columnKyc && profile.kycStatus !== "approved" && profile.kycStatus !== "failed") {
    try {
      const entity = await providers.columnKyc.getPerson(profile.providerEntityId);
      await sql`update customer_profiles
        set kyc_status = ${entity.verificationStatus},
            provider_verification_status = ${entity.providerStatus},
            updated_at = now()
        where user_id = ${userId}`;
      await sql`update column_entities
        set verification_status = ${entity.providerStatus},
            review_reasons = ${JSON.stringify(entity.reviewReasons)},
            last_synced_at = now(),
            updated_at = now()
        where user_id = ${userId}`;
      profile = { ...profile, kycStatus: entity.verificationStatus };
    } catch (err) {
      providerSyncError = providerSyncError ?? columnError(err, "Could not refresh identity status.");
    }
  }
  const freshAccounts = await sql<Row>`select * from bank_accounts where user_id = ${userId} and product = 'checking' order by created_at desc limit 1`;
  let checking: BankAccountView | null = null;
  if (freshAccounts[0]) {
    const bal = await sql<Row>`select * from bank_account_balances where account_id = ${String(freshAccounts[0].id)}`;
    checking = mapChecking(freshAccounts[0], bal[0] ?? null);
  }
  const debitRows = await sql<Row>`select * from debit_cards where user_id = ${userId} order by created_at desc limit 1`;
  const debit = debitRows[0] ? mapDebit(debitRows[0]) : null;
  const creditRows = await sql<Row>`select * from credit_cards where user_id = ${userId} order by created_at desc limit 1`;
  let credit: CreditCardView | null = null;
  if (creditRows[0]) {
    const pending = await sql<Row>`select coalesce(sum(amount_cents),0) as s from transactions where user_id = ${userId} and card_id = ${String(creditRows[0].id)} and status = 'pending' and amount_cents < 0`;
    credit = mapCredit(creditRows[0], Math.abs(num(pending[0]?.s)));
  }
  const tx = await sql<Row>`
    select t.*, coalesce(b.name, case when t.card_id is not null then 'Card' else 'Account' end) as account_label
    from transactions t
    left join bank_accounts b on b.id = t.account_id
    where t.user_id = ${userId}
    order by t.created_at desc
    limit 8`;
  const unread = await sql<Row>`select count(*) as c from notifications where user_id = ${userId} and read_at is null`;
  const fraud = await sql<Row>`select count(*) as c from fraud_alerts where user_id = ${userId} and status = 'open'`;
  try {
    await sql`update customer_profiles set last_activity_at = now() where user_id = ${userId}`;
  } catch {
    /* last_activity_at added in 0007 */
  }
  try {
    const kycRow = await sql<Row>`
      select workflow_status, review_deadline, submitted_at from identity_verifications
      where user_id = ${userId} order by created_at desc limit 1`;
    if (kycRow[0]) {
      profile = {
        ...profile,
        kycLabel: customerKycLabel(profile.kycStatus, kycRow[0].workflow_status ? String(kycRow[0].workflow_status) : null),
        kycWorkflow: kycRow[0].workflow_status ? String(kycRow[0].workflow_status) : null,
        kycReviewDeadline: iso(kycRow[0].review_deadline),
        kycSubmittedAt: iso(kycRow[0].submitted_at),
      };
    }
  } catch {
    /* workflow columns added in 0007 */
  }
  try {
    await settleDueDemoTransfers(sql, userId);
  } catch {
    /* table may not exist until migration */
  }
  const device = await sql<Row>`select id from devices where user_id = ${userId} and current_flag = true limit 1`;
  if (device[0]) {
    const sess = await sql<Row>`select id from app_sessions where user_id = ${userId} and device_id = ${String(device[0].id)} and revoked_at is null limit 1`;
    if (!sess[0]) {
      await sql`insert into app_sessions (id, user_id, device_id, ip_city)
        values (${newId("ses")}, ${userId}, ${String(device[0].id)}, 'Unknown')`;
      if (bool(profileRow.login_alerts)) {
        await pushNotification(sql, {
          userId,
          title: "New session",
          body: "A sign-in from this browser was recorded.",
          kind: "security",
        });
      }
    } else {
      await sql`update app_sessions set last_seen_at = now() where id = ${String(sess[0].id)}`;
    }
  }
  const sandbox = banking.environment !== "live";
  return {
    disclaimer: banking.configured ? SANDBOX_DISCLAIMER : UNCONFIGURED_DISCLAIMER,
    isDemo: sandbox,
    isSandbox: sandbox,
    banking,
    providerSyncError,
    profile,
    staffRole,
    status: buildStatus(profile, debit),
    checking,
    debitCard: debit,
    creditCard: credit,
    recentTransactions: tx.map(mapTx),
    notificationsUnread: num(unread[0]?.c),
    fraudOpen: num(fraud[0]?.c),
    flags: await loadFeatureFlags(),
    greeting: greetingFor(profile.preferredName || profile.legalFirstName),
  };
}

export async function postMovement(
  _sql: Sql,
  _p: {
    userId: string;
    accountId: string;
    amountCents: number;
    availableDelta: number;
    currentDelta: number;
    merchant: string;
    description: string;
    status: TxStatus;
    category: string;
    idempotencyKey: string;
    cardId?: string | null;
    counterparty?: string | null;
    last4?: string | null;
  },
): Promise<{ transactionId: string; ledgerId: string; duplicate: boolean }> {
  throw new Error("Local ledger movements are not allowed. Checking balances come from Column.");
}

export async function startOtp(
  userId: string,
  destination: string,
  method: "sms" | "voice" | "email",
): Promise<
  | { ok: true; method: string; delivered: boolean; previewCode?: string }
  | { ok: false; error: string }
> {
  const sql = await db();
  const allowed = await hitRateLimit(sql, `otp:${userId}`, 8, 10 * 60 * 1000);
  if (!allowed) return { ok: false, error: "Too many attempts. Wait a few minutes and retry." };
  const dest = destination.trim();
  if (method === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dest)) return { ok: false, error: "Enter a valid email." };
  } else if (!/^\+?1?\d{10}$/.test(dest.replace(/[\s()-]/g, ""))) {
    return { ok: false, error: "Enter a valid U.S. phone number." };
  }
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = sha256(`${userId}:${code}`);
  const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  await sql`insert into phone_challenges (id, user_id, phone, method, code_hash, expires_at)
    values (${newId("otp")}, ${userId}, ${dest}, ${method}, ${codeHash}, ${expires})`;
  const message = `Your MONEYLEAD verification code is ${code}. It expires in 5 minutes.`;
  let delivered = false;
  try {
    if (method === "sms") await providers.notify.sendSms(dest, message);
    if (method === "voice") await providers.notify.sendVoice(dest, `Your MONEYLEAD code is ${code.split("").join(" ")}`);
    if (method === "email") await providers.notify.sendEmail(dest, "Your MONEYLEAD verification code", message);
    delivered = providers.notify.configured;
  } catch {
    delivered = false;
  }
  await writeAudit(sql, {
    actorUserId: userId,
    action: `otp.sent.${method}`,
    metadata: { delivered, provider: providers.notify.name },
  });
  if (providers.notify.configured && !delivered) {
    return { ok: false, error: "We couldn't complete that request. Please try again shortly." };
  }
  return {
    ok: true,
    method,
    delivered,
    previewCode: delivered ? undefined : code,
  };
}

export async function verifyOtp(
  userId: string,
  code: string,
  method: "sms" | "voice" | "email",
): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
  const sql = await db();
  const rows = await sql<Row>`
    select * from phone_challenges
    where user_id = ${userId} and method = ${method} and consumed_at is null
    order by created_at desc limit 1`;
  const row = rows[0];
  if (!row) return { ok: false, error: "No verification in progress. Send a new code.", code: "missing" };
  if (iso(row.expires_at) && new Date(String(row.expires_at)).getTime() < Date.now()) {
    return { ok: false, error: "That code expired. Send a new one.", code: "expired" };
  }
  if (num(row.attempts) >= 5) return { ok: false, error: "Too many incorrect attempts. Send a new code.", code: "locked" };
  const expected = String(row.code_hash);
  const incoming = sha256(`${userId}:${code.trim()}`);
  if (!safeEqual(expected, incoming)) {
    await sql`update phone_challenges set attempts = attempts + 1 where id = ${String(row.id)}`;
    return { ok: false, error: "Incorrect code. Try again.", code: "incorrect" };
  }
  await sql`update phone_challenges set consumed_at = now() where id = ${String(row.id)}`;
  if (method === "email") {
    await sql`update customer_profiles set email = ${String(row.phone)}, email_verified_at = now(),
      onboarding_step = case
        when onboarding_step in ('welcome','email') and username is not null then 'phone'
        when onboarding_step in ('welcome','email') then 'username'
        else onboarding_step
      end,
      updated_at = now() where user_id = ${userId}`;
  } else {
    await sql`update customer_profiles set phone = ${String(row.phone)}, phone_verified_at = now(),
      onboarding_step = case when onboarding_step in ('welcome','email','phone') then 'personal' else onboarding_step end,
      updated_at = now() where user_id = ${userId}`;
  }
  await writeAudit(sql, { actorUserId: userId, action: `otp.verified.${method}` });
  await pushNotification(sql, {
    userId,
    title: method === "email" ? "Email verified" : "Phone verified",
    body: "This confirms control of the contact method. It is not identity verification.",
    kind: "security",
  });
  return { ok: true };
}

export async function savePersonal(
  userId: string,
  input: {
    legalFirstName: string;
    middleName?: string;
    legalLastName: string;
    preferredName?: string;
    dob: string;
    citizenship: string;
    residencyStatus: string;
    ssn: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sql = await db();
  const existingProfile = await ensureProfile(sql, userId);
  const first = input.legalFirstName.trim();
  const last = input.legalLastName.trim();
  const preferred = input.preferredName?.trim() || null;
  if (preferred && !/^[A-Za-z][A-Za-z'\- ]{0,39}$/.test(preferred)) {
    return { ok: false, error: "Preferred name can only use letters, spaces, apostrophes, or hyphens." };
  }
  const ssnDigits = input.ssn.replace(/\D/g, "");
  if (!first || !last) return { ok: false, error: "Legal first and last name are required." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dob)) return { ok: false, error: "Enter date of birth as YYYY-MM-DD." };
  const birth = new Date(input.dob + "T00:00:00Z");
  const age = (Date.now() - birth.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (age < 18) return { ok: false, error: "You must be at least 18." };
  if (ssnDigits.length !== 9) return { ok: false, error: "Enter a 9-digit Social Security number." };
  if (!input.line1.trim() || !input.city.trim() || !/^[A-Za-z]{2}$/.test(input.state) || !/^\d{5}(-\d{4})?$/.test(input.postalCode)) {
    return { ok: false, error: "Enter a complete U.S. residential address." };
  }
  const last4 = ssnDigits.slice(-4);
  const token = `ssn_${sha256(`${userId}:${ssnDigits}`).slice(0, 24)}`;
  await sql`update customer_profiles set
    legal_first_name = ${first},
    middle_name = ${input.middleName?.trim() || null},
    legal_last_name = ${last},
    dob = ${input.dob},
    citizenship = ${input.citizenship},
    residency_status = ${input.residencyStatus},
    ssn_last4 = ${last4},
    ssn_token = ${token},
    onboarding_step = case when onboarding_step in ('welcome','email','phone','personal') then 'kyc' else onboarding_step end,
    onboarding_status = 'in_progress',
    updated_at = now()
    where user_id = ${userId}`;
  try {
    await sql`update customer_profiles set preferred_name = ${preferred}, updated_at = now() where user_id = ${userId}`;
  } catch {
    /* preferred_name added in 0008 */
  }
  await sql`insert into addresses (id, user_id, kind, line1, line2, city, state, postal_code)
    values (${newId("adr")}, ${userId}, 'residential', ${input.line1.trim()}, ${input.line2?.trim() || null}, ${input.city.trim()}, ${input.state.toUpperCase()}, ${input.postalCode})`;
  await writeAudit(sql, { actorUserId: userId, action: "profile.personal_saved", metadata: { ssnLast4: last4 } });

  if (providers.columnKyc) {
    try {
      const already = existingProfile.provider_entity_id ? String(existingProfile.provider_entity_id) : "";
      let entity;
      if (already) {
        entity = await providers.columnKyc.getPerson(already);
      } else {
        const phone = toE164Us(String(existingProfile.phone ?? ""));
        entity = await providers.columnKyc.createPerson(
          {
            firstName: first,
            middleName: input.middleName?.trim() || undefined,
            lastName: last,
            dateOfBirth: input.dob,
            email: existingProfile.email ? String(existingProfile.email) : undefined,
            phoneE164: phone,
            ssn: ssnDigits,
            citizenship: input.citizenship === "US" ? "US" : undefined,
            address: {
              line1: input.line1.trim(),
              line2: input.line2?.trim() || undefined,
              city: input.city.trim(),
              state: input.state.toUpperCase(),
              postalCode: input.postalCode,
              countryCode: "US",
            },
          },
          `person:${userId}`,
        );
      }
      await sql`update customer_profiles set
        provider = 'column',
        provider_entity_id = ${entity.entityId},
        provider_verification_status = ${entity.providerStatus},
        kyc_status = ${entity.verificationStatus},
        onboarding_step = 'kyc',
        updated_at = now()
        where user_id = ${userId}`;
      await sql`insert into column_entities (id, user_id, provider_entity_id, verification_status, review_reasons)
        values (${newId("ent")}, ${userId}, ${entity.entityId}, ${entity.providerStatus}, ${JSON.stringify(entity.reviewReasons)})
        on conflict (user_id) do update set
          provider_entity_id = excluded.provider_entity_id,
          verification_status = excluded.verification_status,
          review_reasons = excluded.review_reasons,
          last_synced_at = now(),
          updated_at = now()`;
      await sql`insert into identity_verifications (id, user_id, provider, provider_ref, status, provider_verification_status)
        values (${newId("kyc")}, ${userId}, 'column', ${entity.entityId}, ${entity.verificationStatus}, ${entity.providerStatus})`;
      await writeAudit(sql, {
        actorUserId: userId,
        action: "kyc.entity_created",
        metadata: { provider: "column", status: entity.providerStatus },
      });
    } catch (err) {
      await sql`update customer_profiles set kyc_status = 'not_started', onboarding_step = 'personal', updated_at = now() where user_id = ${userId}`;
      return { ok: false, error: columnError(err, "Identity could not be submitted to the banking partner.") };
    }
  }

  return { ok: true };
}

export async function kycStart(userId: string) {
  const sql = await db();
  const profileRow = await ensureProfile(sql, userId);
  const entityId = profileRow.provider_entity_id ? String(profileRow.provider_entity_id) : "";
  if (!providers.columnKyc) {
    return { ok: false as const, error: partnerMissing(), status: "not_started" as const };
  }
  if (!entityId) {
    return { ok: false as const, error: "Enter personal information first so we can submit identity to the banking partner." };
  }
  try {
    const entity = await providers.columnKyc.getPerson(entityId);
    await sql`insert into identity_verifications (id, user_id, provider, provider_ref, status, provider_verification_status, workflow_status)
      values (${newId("kyc")}, ${userId}, 'column', ${entity.entityId}, ${entity.verificationStatus}, ${entity.providerStatus}, 'IN_PROGRESS')`;
    await sql`update customer_profiles set kyc_status = ${entity.verificationStatus}, provider_verification_status = ${entity.providerStatus}, updated_at = now() where user_id = ${userId}`;
    await writeAudit(sql, { actorUserId: userId, action: "kyc.refreshed", metadata: { status: entity.providerStatus } });
    await stampKycSubmission(userId);
    return { ok: true as const, status: entity.verificationStatus };
  } catch (err) {
    return { ok: false as const, error: columnError(err, "Could not refresh identity status.") };
  }
}

export async function kycSubmitDocument(userId: string, documentType: string) {
  const sql = await db();
  const rows = await sql<Row>`select * from identity_verifications where user_id = ${userId} order by created_at desc limit 1`;
  if (!rows[0]) return { ok: false as const, error: "Start verification first." };
  await sql`update identity_verifications set document_type = ${documentType}, updated_at = now() where id = ${String(rows[0].id)}`;
  if (providers.columnKyc && rows[0].provider_ref) {
    try {
      const entity = await providers.columnKyc.getPerson(String(rows[0].provider_ref));
      await sql`update identity_verifications set status = ${entity.verificationStatus}, provider_verification_status = ${entity.providerStatus}, updated_at = now() where id = ${String(rows[0].id)}`;
      await sql`update customer_profiles set kyc_status = ${entity.verificationStatus}, updated_at = now() where user_id = ${userId}`;
      await writeAudit(sql, { actorUserId: userId, action: "kyc.document_recorded", metadata: { documentType, status: entity.providerStatus } });
      return { ok: true as const, status: entity.verificationStatus };
    } catch (err) {
      return { ok: false as const, error: columnError(err, "Could not refresh identity status.") };
    }
  }
  return { ok: false as const, error: partnerMissing() };
}

export async function kycSubmitSelfie(userId: string) {
  const sql = await db();
  const rows = await sql<Row>`select * from identity_verifications where user_id = ${userId} order by created_at desc limit 1`;
  if (!rows[0]) return { ok: false as const, error: "Start verification first." };
  try {
    await sql`insert into kyc_capture_sessions (id, user_id, status, prompts_completed, camera_available, provider_required, completed_at)
      values (${newId("cap")}, ${userId}, 'completed', 5, true, ${Boolean(providers.columnKyc)}, now())`;
  } catch {
    /* table added in 0008 */
  }
  if (providers.columnKyc && rows[0].provider_ref) {
    try {
      const entity = await providers.columnKyc.getPerson(String(rows[0].provider_ref));
      await sql`update identity_verifications set status = ${entity.verificationStatus}, provider_verification_status = ${entity.providerStatus}, updated_at = now() where id = ${String(rows[0].id)}`;
      await sql`update customer_profiles set kyc_status = ${entity.verificationStatus},
        onboarding_step = case when ${entity.verificationStatus} = 'approved' then 'security' else onboarding_step end,
        updated_at = now() where user_id = ${userId}`;
      await writeAudit(sql, { actorUserId: userId, action: "kyc.selfie_recorded", metadata: { status: entity.providerStatus, capture: true } });
      return { ok: true as const, status: entity.verificationStatus };
    } catch (err) {
      return { ok: false as const, error: columnError(err, "Could not refresh identity status.") };
    }
  }
  return { ok: false as const, error: partnerMissing() };
}

export async function saveSecurity(
  userId: string,
  input: { passcode?: string; biometrics?: boolean; twoFactor?: boolean; loginAlerts?: boolean; trustedDevice?: boolean },
) {
  const sql = await db();
  if (input.passcode != null && input.passcode !== "") {
    if (!/^\d{6}$/.test(input.passcode)) return { ok: false as const, error: "Passcode must be 6 digits." };
  }
  const profile = await ensureProfile(sql, userId);
  const nextHash =
    input.passcode && /^\d{6}$/.test(input.passcode)
      ? sha256(`${userId}:pass:${input.passcode}`)
      : (profile.passcode_hash ? String(profile.passcode_hash) : null);
  if (input.passcode && !nextHash) return { ok: false as const, error: "Passcode must be 6 digits." };
  const advancing = Boolean(input.passcode) && !profile.passcode_hash;
  await sql`update customer_profiles set
    passcode_hash = coalesce(${nextHash}, passcode_hash),
    biometrics_enabled = coalesce(${input.biometrics ?? null}, biometrics_enabled),
    two_factor_enabled = coalesce(${input.twoFactor ?? null}, two_factor_enabled),
    login_alerts = coalesce(${input.loginAlerts ?? null}, login_alerts),
    onboarding_step = case when ${advancing} and onboarding_step in ('welcome','email','phone','personal','kyc','security') then 'review' else onboarding_step end,
    updated_at = now()
    where user_id = ${userId}`;
  if (input.trustedDevice) {
    await sql`update devices set trusted = true, last_seen_at = now() where user_id = ${userId} and current_flag = true`;
  }
  await writeAudit(sql, { actorUserId: userId, action: "security.setup", metadata: { twoFactor: input.twoFactor ?? null } });
  return { ok: true as const };
}

export async function submitCheckingApplication(userId: string) {
  const sql = await db();
  const addresses = await sql<Row>`select * from addresses where user_id = ${userId} order by created_at desc limit 1`;
  const profile = mapProfile(await ensureProfile(sql, userId), addresses[0] ?? null);
  if (!profile.phoneVerified) return { ok: false as const, error: "Verify your phone first." };
  if (!providers.columnBanking || !providers.columnKyc) {
    return { ok: false as const, error: partnerMissing() };
  }
  if (!profile.providerEntityId) {
    return { ok: false as const, error: "Identity has not been submitted to the banking partner yet." };
  }
  try {
    const entity = await providers.columnKyc.getPerson(profile.providerEntityId);
    await sql`update customer_profiles set kyc_status = ${entity.verificationStatus}, provider_verification_status = ${entity.providerStatus}, updated_at = now() where user_id = ${userId}`;
    if (entity.verificationStatus === "manual_review") {
      const appId = newId("app");
      await sql`insert into applications (id, user_id, product, status, submitted_at)
        values (${appId}, ${userId}, 'checking', 'additional_review', now())`;
      await sql`update customer_profiles set checking_status = 'additional_review', onboarding_status = 'additional_review', onboarding_step = 'opening', updated_at = now() where user_id = ${userId}`;
      return { ok: true as const, status: "additional_review" as const, reason: "Identity is in review at the banking partner." };
    }
    if (entity.verificationStatus !== "approved") {
      return { ok: false as const, error: "Identity verification must be complete before a checking account can be opened." };
    }
  } catch (err) {
    return { ok: false as const, error: columnError(err, "Could not confirm identity status.") };
  }

  const existingAcc = await sql<Row>`select * from bank_accounts where user_id = ${userId} and product = 'checking' limit 1`;
  if (existingAcc[0]?.provider_account_id) {
    await sql`update customer_profiles set checking_status = 'approved', onboarding_status = 'approved', onboarding_step = 'opening', updated_at = now() where user_id = ${userId}`;
    return { ok: true as const, status: "approved" as const };
  }

  const appId = newId("app");
  await sql`insert into applications (id, user_id, product, status, submitted_at)
    values (${appId}, ${userId}, 'checking', 'submitted', now())`;
  await sql`update customer_profiles set checking_status = 'submitted', onboarding_status = 'submitted', onboarding_step = 'opening', updated_at = now() where user_id = ${userId}`;

  try {
    const opened = await providers.columnBanking.openCheckingAccount({
      entityId: profile.providerEntityId,
      description: "MONEYLEAD Checking",
      idempotencyKey: `checking:${userId}`,
    });
    if (!opened.accountNumber || !opened.routingNumber) {
      throw new Error("The banking partner did not return account numbers.");
    }
    const accountId = newId("acc");
    const sandbox = isSandboxEnv();
    await sql`insert into bank_accounts (
        id, user_id, product, name, account_number, routing_number, status, is_demo, opened_at,
        provider, provider_account_id, provider_account_number_id
      ) values (
        ${accountId}, ${userId}, 'checking', 'Checking', ${opened.accountNumber}, ${opened.routingNumber}, ${opened.status},
        ${sandbox}, now(), 'column', ${opened.providerAccountId}, ${opened.providerAccountNumberId}
      )`;
    await sql`insert into bank_account_balances (account_id, current_cents, available_cents, pending_cents, holding_cents, locked_cents, last_provider_sync_at)
      values (${accountId}, ${opened.currentCents}, ${opened.availableCents}, ${opened.pendingCents}, ${opened.holdingCents}, ${opened.lockedCents}, now())`;
    await sql`update applications set status = 'approved', decision_at = now(), decision_reason = ${`Column ${opened.status}`} where id = ${appId}`;
    await sql`update customer_profiles set checking_status = 'approved', onboarding_status = 'approved', onboarding_step = 'opening', is_demo = ${sandbox}, updated_at = now() where user_id = ${userId}`;
    await pushNotification(sql, {
      userId,
      title: "Checking account opened",
      body: sandbox
        ? "Your checking account is open in the Column Sandbox environment. Production banking access is pending partner onboarding."
        : "Your checking account is open.",
      kind: "account",
    });
    await writeAudit(sql, {
      actorUserId: userId,
      action: "checking.opened",
      entityType: "bank_account",
      entityId: accountId,
      metadata: { providerAccountId: opened.providerAccountId, sandbox },
    });
    return { ok: true as const, status: "approved" as const };
  } catch (err) {
    await sql`update applications set status = 'additional_review', decision_at = now(), decision_reason = ${columnError(err, "Account creation failed.")} where id = ${appId}`;
    await sql`update customer_profiles set checking_status = 'additional_review', onboarding_status = 'additional_review', updated_at = now() where user_id = ${userId}`;
    return { ok: false as const, error: columnError(err, "The banking partner could not open a checking account.") };
  }
}

export async function fundAccount(
  userId: string,
  input: { method: "ach" | "direct_deposit"; amountCents: number; counterparty: string; idempotencyKey: string },
) {
  const sql = await db();
  if (input.amountCents < 100 || input.amountCents > 25_000_00) {
    return { ok: false as const, error: "Enter an amount between $1.00 and $25,000.00." };
  }
  const flags = await loadFeatureFlags();
  if (!flags.sandboxIncomingAch) {
    return { ok: false as const, error: "Sandbox incoming ACH is turned off." };
  }
  if (!providers.columnPayments || !providers.columnBanking) {
    return { ok: false as const, error: partnerMissing() };
  }
  if (resolvedBankingEnvironment() !== "sandbox") {
    return { ok: false as const, error: "Incoming test deposits are only available in sandbox." };
  }
  const acc = await sql<Row>`select * from bank_accounts where user_id = ${userId} and status = 'open' limit 1`;
  if (!acc[0]?.provider_account_id || !acc[0].provider_account_number_id) {
    return { ok: false as const, error: "No open checking account with the banking partner." };
  }
  const existing = await sql<Row>`select id from transfers where idempotency_key = ${input.idempotencyKey} limit 1`;
  if (existing[0]) return { ok: true as const };
  try {
    await providers.columnPayments.simulateIncomingAchCredit({
      destinationAccountNumberId: String(acc[0].provider_account_number_id),
      amountCents: input.amountCents,
    });
    // Incoming ACH is processed hourly in Column sandbox. Settle simulation is outgoing-only.
    let providerTransferId: string | null = null;
    let providerStatus = "INITIATED";
    try {
      const incoming = await providers.columnPayments.listIncomingAch(String(acc[0].provider_account_id));
      const match = incoming.find((row) => Math.abs(Number(row.amount ?? 0)) === input.amountCents);
      if (match?.id) {
        providerTransferId = match.id;
        providerStatus = match.status ?? "INITIATED";
      }
    } catch {
      /* Column may not list the credit until it processes the hourly ACH window. */
    }
    await sql`insert into transfers (
        id, user_id, account_id, direction, method, amount_cents, status, counterparty_name, idempotency_key,
        provider, provider_transfer_id, provider_status, estimated_settlement
      ) values (
        ${newId("trf")}, ${userId}, ${String(acc[0].id)}, 'inbound', ${input.method}, ${input.amountCents},
        ${mapColumnAchStatus(providerStatus)}, ${input.counterparty}, ${input.idempotencyKey},
        'column', ${providerTransferId}, ${providerStatus}, now()
      )
      on conflict (idempotency_key) do nothing`;
    await syncColumnAccount(sql, acc[0]);
    await sql`update customer_profiles set onboarding_step = case when onboarding_step = 'funding' then 'debit_card' else onboarding_step end, updated_at = now() where user_id = ${userId}`;
    await writeAudit(sql, { actorUserId: userId, action: "funding.inbound", metadata: { amountCents: input.amountCents, method: input.method } });
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: columnError(err, "The banking partner did not accept this incoming transfer.") };
  }
}

export async function sendMoney(
  userId: string,
  input: {
    amountCents: number;
    name: string;
    routing: string;
    account: string;
    memo?: string;
    idempotencyKey: string;
    authorized: boolean;
  },
) {
  const sql = await db();
  if (!input.authorized) return { ok: false as const, error: "Authorize this ACH debit to continue." };
  const flags = await loadFeatureFlags();
  if (!flags.bankingTransfers) return { ok: false as const, error: "Transfers are paused." };
  if (input.amountCents < 100) return { ok: false as const, error: "Minimum transfer is $1.00." };
  const routing = input.routing.replace(/\D/g, "");
  const account = input.account.replace(/\D/g, "");
  if (!/^\d{9}$/.test(routing)) return { ok: false as const, error: "Enter a 9-digit routing number." };
  if (account.length < 4 || account.length > 17) return { ok: false as const, error: "Enter a valid account number." };
  const allowed = await hitRateLimit(sql, `xfer:${userId}`, 10, 10 * 60 * 1000);
  if (!allowed) return { ok: false as const, error: "Too many transfers. Wait a few minutes and retry." };
  if (!providers.columnPayments) return { ok: false as const, error: partnerMissing() };
  const acc = await sql<Row>`select * from bank_accounts where user_id = ${userId} and status = 'open' limit 1`;
  if (!acc[0]?.provider_account_id) return { ok: false as const, error: "No open checking account with the banking partner." };
  const existing = await sql<Row>`select id from transfers where idempotency_key = ${input.idempotencyKey} limit 1`;
  if (existing[0]) return { ok: true as const };
  try {
    const counterparty = await providers.columnPayments.createCounterparty({
      name: input.name.trim(),
      accountNumber: account,
      routingNumber: routing,
      idempotencyKey: `cpty:${userId}:${routing}:${account}`,
    });
    const ach = await providers.columnPayments.createAchTransfer({
      bankAccountId: String(acc[0].provider_account_id),
      accountNumberId: acc[0].provider_account_number_id ? String(acc[0].provider_account_number_id) : undefined,
      counterpartyId: counterparty.id,
      amountCents: input.amountCents,
      description: input.memo?.trim() || "MONEYLEAD transfer",
      receiverName: input.name.trim(),
      idempotencyKey: input.idempotencyKey,
    });
    const providerStatus = ach.status ?? "INITIATED";
    const localStatus = providerStatus === "SETTLED" || providerStatus === "COMPLETED" ? "completed" : "processing";
    await sql`insert into transfers (
        id, user_id, account_id, direction, method, amount_cents, status, counterparty_name, counterparty_detail,
        idempotency_key, provider, provider_transfer_id, provider_counterparty_id, provider_status, estimated_settlement
      ) values (
        ${newId("trf")}, ${userId}, ${String(acc[0].id)}, 'outbound', 'ach', ${input.amountCents}, ${localStatus},
        ${input.name.trim()}, ${`${routing} ••••${account.slice(-4)}`}, ${input.idempotencyKey},
        'column', ${ach.id}, ${counterparty.id}, ${providerStatus}, now()
      )
      on conflict (idempotency_key) do nothing`;
    await sql`insert into transactions (
        id, user_id, account_id, amount_cents, status, category, merchant, description, counterparty,
        idempotency_key, provider, provider_transfer_id, provider_status, is_incoming
      ) values (
        ${newId("txn")}, ${userId}, ${String(acc[0].id)}, ${-input.amountCents}, ${localStatus === "completed" ? "posted" : "pending"},
        'transfer', ${input.name.trim()}, ${input.memo?.trim() || "ACH transfer"}, ${`${routing} ••••${account.slice(-4)}`},
        ${input.idempotencyKey}, 'column', ${ach.id}, ${providerStatus}, false
      )
      on conflict (idempotency_key) do nothing`;
    await syncColumnAccount(sql, acc[0]);
    await pushNotification(sql, {
      userId,
      title: "Transfer submitted",
      body: "The banking partner accepted this ACH transfer. Status updates when Column confirms it.",
      kind: "transfer",
    });
    await writeAudit(sql, { actorUserId: userId, action: "transfer.outbound", metadata: { amountCents: input.amountCents, providerTransferId: ach.id } });
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: columnError(err, "The banking partner declined this transfer.") };
  }
}

export async function issueDebitCard(userId: string) {
  const sql = await db();
  const acc = await sql<Row>`select * from bank_accounts where user_id = ${userId} and status = 'open' limit 1`;
  if (!acc[0]) return { ok: false as const, error: "Open a checking account first." };
  await sql`update customer_profiles set onboarding_step = 'complete', onboarding_status = 'approved', debit_card_status = 'not_started', updated_at = now() where user_id = ${userId}`;
  return { ok: true as const, already: false, unavailable: true as const };
}

export async function activateDebit(userId: string, last4: string) {
  const sql = await db();
  const rows = await sql<Row>`select * from debit_cards where user_id = ${userId} order by created_at desc limit 1`;
  if (!rows[0]) return { ok: false as const, error: "No debit card on file." };
  if (String(rows[0].last4) !== last4.trim()) return { ok: false as const, error: "Last four digits do not match." };
  await sql`update debit_cards set status = 'active', shipping_status = 'delivered', updated_at = now() where id = ${String(rows[0].id)} and user_id = ${userId}`;
  await sql`update customer_profiles set debit_card_status = 'active', updated_at = now() where user_id = ${userId}`;
  await writeAudit(sql, { actorUserId: userId, action: "debit.activated", entityId: String(rows[0].id) });
  return { ok: true as const };
}

export async function setDebitPin(userId: string, pin: string) {
  const sql = await db();
  if (!/^\d{4}$/.test(pin)) return { ok: false as const, error: "PIN must be 4 digits." };
  const rows = await sql<Row>`select id from debit_cards where user_id = ${userId} order by created_at desc limit 1`;
  if (!rows[0]) return { ok: false as const, error: "No debit card on file." };
  await sql`update debit_cards set pin_hash = ${sha256(`${userId}:pin:${pin}`)}, updated_at = now() where id = ${String(rows[0].id)} and user_id = ${userId}`;
  await writeAudit(sql, { actorUserId: userId, action: "debit.pin_set" });
  return { ok: true as const };
}

export async function updateDebit(
  userId: string,
  patch: {
    frozen?: boolean;
    lostStolen?: "lost" | "stolen";
    replace?: boolean;
    reason?: string;
    controls?: DebitCardView["controls"];
  },
) {
  const sql = await db();
  const rows = await sql<Row>`select * from debit_cards where user_id = ${userId} order by created_at desc limit 1`;
  if (!rows[0]) return { ok: false as const, error: "No debit card on file." };
  if (typeof patch.frozen === "boolean" || patch.lostStolen || patch.replace) {
    return {
      ok: false as const,
      error: "Debit cards are not issued in this environment. Column’s public API does not issue consumer debit cards.",
    };
  }
  const id = String(rows[0].id);
  if (patch.controls) {
    await sql`update debit_cards set online_enabled = ${patch.controls.online}, atm_enabled = ${patch.controls.atm}, pos_enabled = ${patch.controls.pos}, international_enabled = ${patch.controls.international}, updated_at = now() where id = ${id} and user_id = ${userId}`;
  }
  await writeAudit(sql, { actorUserId: userId, action: "debit.updated", entityId: id, metadata: patch });
  return { ok: true as const };
}

export async function applyCredit(
  userId: string,
  input: {
    employmentStatus: string;
    annualIncomeCents: number;
    housingStatus: string;
    housingPaymentCents: number;
  },
) {
  const sql = await db();
  const flags = await loadFeatureFlags();
  if (!flags.creditApplicationsOpen) {
    return { ok: false as const, error: "Credit applications are not open." };
  }
  const acc = await sql<Row>`select id from bank_accounts where user_id = ${userId} and status = 'open' limit 1`;
  if (!acc[0]) return { ok: false as const, error: "Open a checking account before applying for credit." };
  const appId = newId("cap");
  await sql`insert into credit_applications (id, user_id, status, employment_status, annual_income_cents, housing_status, housing_payment_cents, submitted_at)
    values (${appId}, ${userId}, 'submitted', ${input.employmentStatus}, ${input.annualIncomeCents}, ${input.housingStatus}, ${input.housingPaymentCents}, now())`;
  await sql`update customer_profiles set credit_status = 'submitted', updated_at = now() where user_id = ${userId}`;
  const decision = await providers.credit.underwrite({
    customerId: userId,
    annualIncomeCents: input.annualIncomeCents,
    employmentStatus: input.employmentStatus,
    housingStatus: input.housingStatus,
    housingPaymentCents: input.housingPaymentCents,
  });
  await sql`update credit_applications set status = ${decision.status}, decision_reason = ${decision.reason}, adverse_action = ${decision.adverseAction ?? null}, decided_at = now() where id = ${appId}`;
  await sql`update customer_profiles set credit_status = ${decision.status}, updated_at = now() where user_id = ${userId}`;
  await writeAudit(sql, {
    actorUserId: userId,
    action: "credit.application",
    entityId: appId,
    metadata: { status: decision.status },
  });
  return { ok: true as const, status: decision.status, reason: decision.reason, adverseAction: decision.adverseAction };
}

export async function payCredit(
  _userId: string,
  input: { amountCents: number; idempotencyKey: string },
) {
  if (input.amountCents < 100) return { ok: false as const, error: "Minimum payment is $1.00." };
  return {
    ok: false as const,
    error: "No credit-card issuer is connected. MONEYLEAD will not debit your Column checking account for a demonstration payment.",
  };
}

export async function updateCredit(
  userId: string,
  patch: {
    frozen?: boolean;
    replace?: boolean;
    lostStolen?: "lost" | "stolen";
    autopayEnabled?: boolean;
    autopayAmount?: "minimum" | "statement" | "full" | null;
  },
) {
  const sql = await db();
  const rows = await sql<Row>`select * from credit_cards where user_id = ${userId} order by created_at desc limit 1`;
  if (!rows[0]) return { ok: false as const, error: "No credit card on file." };
  const id = String(rows[0].id);
  if (typeof patch.frozen === "boolean") {
    await sql`update credit_cards set frozen = ${patch.frozen}, status = ${patch.frozen ? "frozen" : "active"}, updated_at = now() where id = ${id} and user_id = ${userId}`;
  }
  if (typeof patch.autopayEnabled === "boolean") {
    await sql`update credit_cards set autopay_enabled = ${patch.autopayEnabled}, autopay_amount = ${patch.autopayAmount ?? rows[0].autopay_amount}, updated_at = now() where id = ${id} and user_id = ${userId}`;
  }
  if (patch.lostStolen || patch.replace) {
    return {
      ok: false as const,
      error: "No credit-card issuer is connected. MONEYLEAD will not invent a replacement card number.",
    };
  }
  await writeAudit(sql, { actorUserId: userId, action: "credit.updated", entityId: id, metadata: patch });
  return { ok: true as const };
}

export async function listTransactions(userId: string, filter?: { status?: string; query?: string }) {
  const sql = await db();
  try {
    await settleDueDemoTransfers(sql, userId);
  } catch {
    /* demo_transfers added in 0007 */
  }
  const rows = await sql<Row>`
    select t.*, coalesce(b.name, 'Account') as account_label
    from transactions t
    left join bank_accounts b on b.id = t.account_id
    where t.user_id = ${userId}
    order by t.created_at desc
    limit 80`;
  let list = rows.map(mapTx);
  if (filter?.status) list = list.filter((t) => t.status === filter.status);
  if (filter?.query) {
    const q = filter.query.toLowerCase();
    list = list.filter((t) => t.merchant.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
  }
  return list;
}

export async function getTransaction(userId: string, id: string): Promise<TransactionDetail | null> {
  const sql = await db();
  try {
    await settleDueDemoTransfers(sql, userId);
  } catch {
    /* demo_transfers added in 0007 */
  }
  const rows = await sql<Row>`
    select t.*, coalesce(b.name, 'Account') as account_label
    from transactions t
    left join bank_accounts b on b.id = t.account_id
    where t.user_id = ${userId} and t.id = ${id}
    limit 1`;
  if (!rows[0]) return null;
  const d = await sql<Row>`select id from disputes where user_id = ${userId} and transaction_id = ${id} order by created_at desc limit 1`;
  const base = mapTx(rows[0]);
  return {
    ...base,
    idempotencyKey: String(rows[0].idempotency_key),
    ledgerId: rows[0].ledger_id ? String(rows[0].ledger_id) : null,
    counterparty: rows[0].counterparty ? String(rows[0].counterparty) : null,
    last4: rows[0].last4 ? String(rows[0].last4) : null,
    disputeId: d[0] ? String(d[0].id) : null,
  };
}

export async function disputeTransaction(userId: string, transactionId: string, reason: string, details: string) {
  const sql = await db();
  const tx = await sql<Row>`select * from transactions where user_id = ${userId} and id = ${transactionId} limit 1`;
  if (!tx[0]) return { ok: false as const, error: "Transaction not found." };
  const id = newId("dsp");
  await sql`insert into disputes (id, user_id, transaction_id, reason, details, status)
    values (${id}, ${userId}, ${transactionId}, ${reason}, ${details}, 'open')`;
  await sql`update transactions set status = 'disputed', updated_at = now() where id = ${transactionId} and user_id = ${userId}`;
  await writeAudit(sql, { actorUserId: userId, action: "transaction.disputed", entityId: transactionId, metadata: { reason } });
  return { ok: true as const, id };
}

export async function listTransfers(userId: string): Promise<TransferView[]> {
  const sql = await db();
  const acc = await sql<Row>`select * from bank_accounts where user_id = ${userId} and status = 'open' limit 1`;
  if (acc[0]?.provider_account_id && providers.columnBanking) {
    await syncColumnAccount(sql, acc[0]);
  }
  const rows = await sql<Row>`select * from transfers where user_id = ${userId} order by created_at desc limit 50`;
  return rows.map((row) => ({
    id: String(row.id),
    direction: String(row.direction) as TransferView["direction"],
    method: String(row.method) as TransferView["method"],
    amountCents: num(row.amount_cents),
    status: String(row.status) as TransferView["status"],
    counterpartyName: String(row.counterparty_name),
    counterpartyDetail: row.counterparty_detail ? String(row.counterparty_detail) : null,
    createdAt: iso(row.created_at) ?? "",
    estimatedSettlement: iso(row.estimated_settlement),
  }));
}

export async function listStatements(userId: string): Promise<StatementView[]> {
  const sql = await db();
  const rows = await sql<Row>`select * from statements where user_id = ${userId} order by period_end desc`;
  return rows.map((row) => ({
    id: String(row.id),
    product: String(row.product) as StatementView["product"],
    periodStart: String(row.period_start).slice(0, 10),
    periodEnd: String(row.period_end).slice(0, 10),
    openingCents: num(row.opening_cents),
    closingCents: num(row.closing_cents),
  }));
}

export async function getStatement(userId: string, id: string): Promise<StatementDetail | null> {
  const sql = await db();
  const rows = await sql<Row>`select * from statements where id = ${id} and user_id = ${userId} limit 1`;
  if (!rows[0]) return null;
  const periodStart = String(rows[0].period_start).slice(0, 10);
  const periodEnd = String(rows[0].period_end).slice(0, 10);
  const product = String(rows[0].product) as StatementView["product"];
  const start = Date.parse(`${periodStart}T00:00:00Z`);
  const end = Date.parse(`${periodEnd}T23:59:59Z`);
  const txs = await listTransactions(userId);
  const transactions = txs.filter((t) => {
    const ts = Date.parse(t.createdAt);
    if (!Number.isFinite(ts) || ts < start || ts > end) return false;
    if (t.isDemonstration) return false;
    if (product === "credit") return Boolean(t.cardId) && !t.accountId;
    return Boolean(t.accountId) || t.category === "historical";
  });
  try {
    const hist = await sql<Row>`
      select * from historical_records
      where user_id = ${userId} and superseded_by is null
        and source_occurred_at >= ${periodStart} and source_occurred_at <= ${periodEnd + "T23:59:59.000Z"}
      order by source_occurred_at asc`;
    for (const h of hist) {
      const occurred = iso(h.source_occurred_at) ?? "";
      transactions.push({
        id: String(h.id),
        accountId: null,
        cardId: null,
        accountLabel: "Historical",
        merchant: String(h.description),
        description: `${String(h.source_name)} · ${String(h.kind)}`,
        amountCents: h.amount_cents == null ? 0 : num(h.amount_cents),
        status: "posted",
        category: "historical",
        last4: null,
        createdAt: occurred,
        postedAt: occurred,
        isDemonstration: false,
      });
    }
  } catch {
    /* historical_records added in 0008 */
  }
  transactions.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return {
    id: String(rows[0].id),
    product,
    periodStart,
    periodEnd,
    openingCents: num(rows[0].opening_cents),
    closingCents: num(rows[0].closing_cents),
    transactions,
  };
}

export async function listNotifications(userId: string): Promise<NotificationView[]> {
  const sql = await db();
  const rows = await sql<Row>`select * from notifications where user_id = ${userId} order by created_at desc limit 40`;
  return rows.map((row) => ({
    id: String(row.id),
    title: String(row.title),
    body: String(row.body),
    kind: String(row.kind),
    readAt: iso(row.read_at),
    createdAt: iso(row.created_at) ?? "",
  }));
}

export async function markNotificationsRead(userId: string) {
  const sql = await db();
  await sql`update notifications set read_at = now() where user_id = ${userId} and read_at is null`;
  return { ok: true as const };
}

export async function listDevices(userId: string): Promise<DeviceView[]> {
  const sql = await db();
  const rows = await sql<Row>`select * from devices where user_id = ${userId} order by last_seen_at desc`;
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    trusted: bool(row.trusted),
    current: bool(row.current_flag),
    lastSeenAt: iso(row.last_seen_at) ?? "",
    ipCity: row.ip_city ? String(row.ip_city) : null,
  }));
}

export async function updateDevice(userId: string, deviceId: string, trusted: boolean) {
  const sql = await db();
  await sql`update devices set trusted = ${trusted} where id = ${deviceId} and user_id = ${userId}`;
  await writeAudit(sql, { actorUserId: userId, action: "device.trust", entityId: deviceId, metadata: { trusted } });
  return { ok: true as const };
}

export async function listSessions(userId: string) {
  const sql = await db();
  const rows = await sql<Row>`select * from app_sessions where user_id = ${userId} order by last_seen_at desc`;
  return rows.map((row) => ({
    id: String(row.id),
    ipCity: row.ip_city ? String(row.ip_city) : null,
    createdAt: iso(row.created_at) ?? "",
    lastSeenAt: iso(row.last_seen_at) ?? "",
    revoked: Boolean(row.revoked_at),
  }));
}

export async function revokeSession(userId: string, id: string) {
  const sql = await db();
  await sql`update app_sessions set revoked_at = now() where id = ${id} and user_id = ${userId}`;
  await writeAudit(sql, { actorUserId: userId, action: "session.revoked", entityId: id });
  return { ok: true as const };
}

export async function listFraud(userId: string): Promise<FraudAlertView[]> {
  const sql = await db();
  const rows = await sql<Row>`select * from fraud_alerts where user_id = ${userId} order by created_at desc`;
  return rows.map((row) => ({
    id: String(row.id),
    title: String(row.title),
    body: String(row.body),
    severity: String(row.severity) as FraudAlertView["severity"],
    status: String(row.status) as FraudAlertView["status"],
    createdAt: iso(row.created_at) ?? "",
  }));
}

export async function ackFraud(userId: string, id: string) {
  const sql = await db();
  await sql`update fraud_alerts set status = 'acknowledged' where id = ${id} and user_id = ${userId}`;
  await writeAudit(sql, { actorUserId: userId, action: "fraud.acknowledged", entityId: id });
  return { ok: true as const };
}

export async function createSupportCase(userId: string, subject: string, body: string) {
  const flags = await loadFeatureFlags();
  if (!flags.supportMessaging) return { ok: false as const, error: "Support messaging is paused.", id: "" };
  const sql = await db();
  const id = newId("sup");
  await sql`insert into support_cases (id, user_id, subject, status) values (${id}, ${userId}, ${subject.trim()}, 'open')`;
  await sql`insert into support_messages (id, case_id, user_id, author, body)
    values (${newId("msg")}, ${id}, ${userId}, 'customer', ${body.trim()})`;
  await writeAudit(sql, { actorUserId: userId, action: "support.opened", entityId: id });
  return { ok: true as const, id };
}

export async function listSupportCases(userId: string): Promise<SupportCaseView[]> {
  const sql = await db();
  const rows = await sql<Row>`select * from support_cases where user_id = ${userId} order by updated_at desc`;
  return rows.map((row) => ({
    id: String(row.id),
    subject: String(row.subject),
    status: String(row.status) as SupportCaseView["status"],
    createdAt: iso(row.created_at) ?? "",
    updatedAt: iso(row.updated_at) ?? "",
  }));
}

export async function listSupportMessages(userId: string, caseId: string): Promise<SupportMessageView[]> {
  const sql = await db();
  const owner = await sql<Row>`select id from support_cases where id = ${caseId} and user_id = ${userId}`;
  if (!owner[0]) return [];
  const rows = await sql<Row>`select * from support_messages where case_id = ${caseId} order by created_at asc`;
  return rows.map((row) => ({
    id: String(row.id),
    author: String(row.author) as SupportMessageView["author"],
    body: String(row.body),
    createdAt: iso(row.created_at) ?? "",
  }));
}

export async function addSupportMessage(userId: string, caseId: string, body: string) {
  const sql = await db();
  const owner = await sql<Row>`select id from support_cases where id = ${caseId} and user_id = ${userId}`;
  if (!owner[0]) return { ok: false as const, error: "Case not found." };
  await sql`insert into support_messages (id, case_id, user_id, author, body)
    values (${newId("msg")}, ${caseId}, ${userId}, 'customer', ${body.trim()})`;
  await sql`update support_cases set updated_at = now(), status = 'pending' where id = ${caseId}`;
  return { ok: true as const };
}

export async function closeAccount(userId: string, reason: string) {
  const sql = await db();
  const acc = await sql<Row>`select * from bank_accounts where user_id = ${userId} and status = 'open' limit 1`;
  if (acc[0]) {
    const bal = await sql<Row>`select current_cents from bank_account_balances where account_id = ${String(acc[0].id)}`;
    if (num(bal[0]?.current_cents) !== 0) {
      return { ok: false as const, error: "Bring the checking balance to $0.00 before closing." };
    }
    const providerAccountId = acc[0].provider_account_id ? String(acc[0].provider_account_id) : String(acc[0].id);
    await providers.banking.closeAccount({ accountId: providerAccountId, reason });
    await sql`update bank_accounts set status = 'closed', closed_at = now() where id = ${String(acc[0].id)}`;
  }
  await sql`update debit_cards set status = 'closed', frozen = true, updated_at = now() where user_id = ${userId}`;
  await sql`update credit_cards set status = 'closed', frozen = true, updated_at = now() where user_id = ${userId}`;
  await sql`update customer_profiles set account_closed_at = now(), close_reason = ${reason}, checking_status = 'withdrawn', updated_at = now() where user_id = ${userId}`;
  await writeAudit(sql, { actorUserId: userId, action: "account.closed", metadata: { reason } });
  return { ok: true as const };
}

export async function updateNotificationPrefs(
  userId: string,
  prefs: { emailEnabled: boolean; pushEnabled: boolean; smsEnabled: boolean; loginAlerts: boolean; transactionAlerts: boolean; marketing: boolean },
) {
  const sql = await db();
  await sql`insert into notification_preferences (user_id, email_enabled, push_enabled, sms_enabled, login_alerts, transaction_alerts, marketing)
    values (${userId}, ${prefs.emailEnabled}, ${prefs.pushEnabled}, ${prefs.smsEnabled}, ${prefs.loginAlerts}, ${prefs.transactionAlerts}, ${prefs.marketing})
    on conflict (user_id) do update set
      email_enabled = excluded.email_enabled,
      push_enabled = excluded.push_enabled,
      sms_enabled = excluded.sms_enabled,
      login_alerts = excluded.login_alerts,
      transaction_alerts = excluded.transaction_alerts,
      marketing = excluded.marketing`;
  return { ok: true as const };
}

export async function getNotificationPrefs(userId: string) {
  const sql = await db();
  const rows = await sql<Row>`select * from notification_preferences where user_id = ${userId}`;
  const row = rows[0];
  return {
    emailEnabled: row ? bool(row.email_enabled) : true,
    pushEnabled: row ? bool(row.push_enabled) : true,
    smsEnabled: row ? bool(row.sms_enabled) : false,
    loginAlerts: row ? bool(row.login_alerts) : true,
    transactionAlerts: row ? bool(row.transaction_alerts) : true,
    marketing: row ? bool(row.marketing) : false,
  };
}

export async function skipToDebit(userId: string) {
  const sql = await db();
  const profile = await ensureProfile(sql, userId);
  if (String(profile.checking_status) !== "approved") {
    return { ok: false as const, error: "Open a checking account before skipping funding." };
  }
  await sql`update customer_profiles set onboarding_step = 'complete', debit_card_status = 'not_started', updated_at = now() where user_id = ${userId}`;
  return { ok: true as const };
}

export async function continueOpening(userId: string) {
  const sql = await db();
  const profile = await ensureProfile(sql, userId);
  if (String(profile.checking_status) !== "approved") {
    return { ok: false as const, error: "This application is still under review." };
  }
  await sql`update customer_profiles set onboarding_step = 'funding', updated_at = now() where user_id = ${userId} and onboarding_step = 'opening'`;
  return { ok: true as const };
}

export async function continueKyc(userId: string) {
  const sql = await db();
  const profile = await ensureProfile(sql, userId);
  if (String(profile.kyc_status) !== "approved") {
    return { ok: false as const, error: "Identity verification is not complete." };
  }
  await sql`update customer_profiles set onboarding_step = 'security', updated_at = now() where user_id = ${userId} and onboarding_step = 'kyc'`;
  return { ok: true as const };
}

export async function rewindOnboarding(userId: string, step: "username" | "phone" | "personal" | "kyc" | "security") {
  const sql = await db();
  await sql`update customer_profiles set onboarding_step = ${step}, updated_at = now() where user_id = ${userId}`;
  await writeAudit(sql, { actorUserId: userId, action: "onboarding.rewind", metadata: { step } });
  return { ok: true as const };
}

export async function provisionDemo(userId: string) {
  if (!providers.columnBanking) {
    return { ok: false as const, error: partnerMissing() };
  }
  return {
    ok: false as const,
    error: "MONEYLEAD does not load fabricated accounts. Complete identity verification to open a Column Sandbox checking account.",
  };
}

export async function claimAdmin(userId: string) {
  const sql = await db();
  const role = await resolveStaffRole(sql, userId);
  if (role) return { ok: true as const, role };
  return {
    ok: false as const,
    error:
      "Staff access is invitation-only. Sign in with a designated staff email. Customers cannot claim operator access.",
  };
}

export async function requireStaff(userId: string): Promise<StaffRole> {
  const sql = await db();
  const role = await resolveStaffRole(sql, userId);
  if (!role) {
    const err = new Error("Forbidden");
    (err as Error & { status: number }).status = 403;
    throw err;
  }
  return role;
}

export async function adminOverview() {
  const sql = await db();
  const q = async (text: string) => {
    const rows = await sql.query<Row>(text);
    return num(rows[0]?.c);
  };
  return {
    customers: await q("select count(*) as c from customer_profiles"),
    verifiedUsers: await q("select count(*) as c from customer_profiles where kyc_status = 'approved'"),
    pendingVerification: await q(
      "select count(*) as c from customer_profiles where kyc_status in ('processing','pending_documents','manual_review','additional_info','selfie_required')",
    ),
    openAccounts: await q("select count(*) as c from bank_accounts where status = 'open'"),
    pendingAccounts: await q("select count(*) as c from bank_accounts where status = 'pending'"),
    kycReview: await q("select count(*) as c from identity_verifications where status = 'manual_review'"),
    creditApps: await q("select count(*) as c from credit_applications where status in ('submitted','additional_info')"),
    transfersToday: await q("select count(*) as c from transfers where created_at >= date_trunc('day', now())"),
    achVolumeTodayCents: await q(
      "select coalesce(sum(amount_cents), 0) as c from transfers where method = 'ach' and created_at >= date_trunc('day', now())",
    ),
    failedTransfers: await q("select count(*) as c from transfers where status = 'failed'"),
    openDisputes: await q("select count(*) as c from disputes where status = 'open'"),
    openFraud: await q("select count(*) as c from fraud_alerts where status = 'open'"),
    openSupport: await q("select count(*) as c from support_cases where status in ('open','pending')"),
    demoMode: isSandboxEnv(),
    sandbox: isSandboxEnv(),
    bankingConfigured: Boolean(providers.columnBanking),
    providers: {
      banking: providers.banking.name,
      kyc: providers.kyc.name,
      cards: providers.cards.name,
      credit: providers.credit.name,
      payments: providers.payments.name,
      notify: providers.notify.name,
    },
  };
}

export async function adminList(resource: string, opts?: { query?: string; status?: string }) {
  const sql = await db();
  const q = opts?.query?.trim().toLowerCase() ?? "";
  const status = opts?.status?.trim() ?? "";
  const match = (row: Row, fields: string[]) => {
    if (status && String(row.status ?? "") !== status) return false;
    if (!q) return true;
    return fields.some((f) => String(row[f] ?? "").toLowerCase().includes(q));
  };

  switch (resource) {
    case "customers": {
      const rows = await sql<Row>`select id, user_id, email, username, moneylead_user_id, legal_first_name, legal_last_name, phone, kyc_status, checking_status, credit_status, onboarding_step, created_at, provider_entity_id from customer_profiles order by created_at desc limit 200`;
      return rows
        .filter((row) => {
          if (status && String(row.kyc_status) !== status && String(row.checking_status) !== status) return false;
          if (!q) return true;
          return [row.email, row.username, row.moneylead_user_id, row.legal_first_name, row.legal_last_name, row.phone, row.id, row.user_id]
            .some((v) => String(v ?? "").toLowerCase().includes(q));
        })
        .slice(0, 100);
    }
    case "applications":
      return (await sql<Row>`select id, user_id, product, status, submitted_at, decision_reason, created_at from applications order by created_at desc limit 100`).filter((r) =>
        match(r, ["id", "user_id", "product", "status", "decision_reason"]),
      );
    case "kyc":
      return (await sql<Row>`select id, user_id, provider, status, provider_verification_status, document_type, created_at from identity_verifications order by created_at desc limit 100`).filter((r) =>
        match(r, ["id", "user_id", "status", "provider_verification_status"]),
      );
    case "accounts": {
      const rows = await sql<Row>`
        select a.id, a.user_id, a.status, a.opened_at, a.provider_account_id, a.is_demo,
               a.account_number, a.routing_number,
               b.available_cents, b.current_cents, b.pending_cents, b.last_provider_sync_at
        from bank_accounts a
        left join bank_account_balances b on b.account_id = a.id
        order by a.created_at desc limit 100`;
      return rows.filter((r) => match(r, ["id", "user_id", "status", "provider_account_id"])).map((r) => ({
        id: String(r.id),
        user_id: String(r.user_id),
        status: String(r.status),
        account_last4: last4Digits(r.account_number),
        routing_last4: last4Digits(r.routing_number),
        available_cents: num(r.available_cents),
        current_cents: num(r.current_cents),
        pending_cents: num(r.pending_cents),
        provider_account_id: r.provider_account_id ? String(r.provider_account_id) : null,
        last_synced: iso(r.last_provider_sync_at),
        opened_at: iso(r.opened_at),
      }));
    }
    case "cards":
    case "debitCards":
      return (await sql<Row>`select id, user_id, last4, status, frozen, holder_name, shipping_status, created_at from debit_cards order by created_at desc limit 100`).filter((r) =>
        match(r, ["id", "user_id", "last4", "status", "holder_name"]),
      );
    case "creditCards":
      return (await sql<Row>`select id, user_id, last4, status, frozen, holder_name, current_balance_cents, credit_limit_cents, created_at from credit_cards order by created_at desc limit 100`).filter((r) =>
        match(r, ["id", "user_id", "last4", "status"]),
      );
    case "credit":
      return (await sql<Row>`select id, user_id, status, employment_status, annual_income_cents, submitted_at, decision_reason, created_at from credit_applications order by created_at desc limit 100`).filter((r) =>
        match(r, ["id", "user_id", "status", "decision_reason"]),
      );
    case "transactions":
      return (await sql<Row>`select id, user_id, merchant, amount_cents, status, category, provider_status, is_demonstration, created_at from transactions order by created_at desc limit 100`).filter((r) =>
        match(r, ["id", "user_id", "merchant", "status", "category"]),
      );
    case "transfers":
      return (await sql<Row>`select id, user_id, direction, method, amount_cents, status, counterparty_name, provider_status, created_at from transfers order by created_at desc limit 100`).filter((r) =>
        match(r, ["id", "user_id", "direction", "method", "status", "counterparty_name", "provider_status"]),
      );
    case "fraud":
      return (await sql<Row>`select id, user_id, title, body, severity, status, created_at from fraud_alerts order by created_at desc limit 100`).filter((r) =>
        match(r, ["id", "user_id", "title", "severity", "status"]),
      );
    case "disputes":
      return (await sql<Row>`select id, user_id, transaction_id, reason, status, created_at from disputes order by created_at desc limit 100`).filter((r) =>
        match(r, ["id", "user_id", "reason", "status"]),
      );
    case "support":
      return (await sql<Row>`select id, user_id, subject, status, created_at, updated_at from support_cases order by updated_at desc limit 100`).filter((r) =>
        match(r, ["id", "user_id", "subject", "status"]),
      );
    case "notifications":
      return (await sql<Row>`select id, user_id, title, kind, created_at, read_at from notifications order by created_at desc limit 100`).filter((r) =>
        match(r, ["id", "user_id", "title", "kind"]),
      );
    case "audit":
      return (await sql<Row>`select id, actor_user_id, actor_role, action, entity_type, entity_id, created_at from audit_logs order by created_at desc limit 150`).filter((r) => {
        if (!q) return true;
        return [r.action, r.actor_role, r.actor_user_id, r.entity_id, r.entity_type].some((v) =>
          String(v ?? "").toLowerCase().includes(q),
        );
      });
    case "webhooks":
      return (await sql<Row>`select id, provider, provider_event_id, event_type, signature_valid, processing_status, processing_error, received_at, processed_at from webhook_events order by received_at desc limit 150`).filter((r) =>
        match({ ...r, status: r.processing_status }, ["id", "event_type", "processing_status", "provider_event_id"]),
      );
    case "reconciliation":
      return (await sql<Row>`select id, user_id, account_id, kind, detail, status, created_at from reconciliation_alerts order by created_at desc limit 150`).filter((r) =>
        match(r, ["id", "user_id", "kind", "status", "detail"]),
      );
    case "staff":
      return sql<Row>`select user_id, role, created_at from staff_users order by created_at desc`;
    case "flags":
      return sql<Row>`select key, enabled, description, updated_at, updated_by from feature_flags order by key`;
    default:
      return [];
  }
}

export async function adminCustomer(id: string) {
  const sql = await db();
  const profiles = await sql<Row>`select * from customer_profiles where id = ${id} or user_id = ${id} limit 1`;
  if (!profiles[0]) return null;
  const userId = String(profiles[0].user_id);
  const p = profiles[0];
  const addresses = await sql<Row>`select id, kind, line1, line2, city, state, postal_code, country, created_at from addresses where user_id = ${userId} order by created_at desc`;
  const accountRows = await sql<Row>`
    select a.id, a.status, a.opened_at, a.provider_account_id, a.is_demo, a.account_number, a.routing_number,
           b.available_cents, b.current_cents, b.pending_cents, b.last_provider_sync_at
    from bank_accounts a
    left join bank_account_balances b on b.account_id = a.id
    where a.user_id = ${userId}`;
  const kyc = await sql<Row>`select id, provider, status, provider_verification_status, document_type, created_at from identity_verifications where user_id = ${userId} order by created_at desc`;
  const transfers = await sql<Row>`select id, direction, method, amount_cents, status, counterparty_name, provider_status, created_at from transfers where user_id = ${userId} order by created_at desc limit 25`;
  const transactions = await sql<Row>`select id, merchant, amount_cents, status, category, created_at from transactions where user_id = ${userId} order by created_at desc limit 25`;
  const support = await sql<Row>`select id, subject, status, created_at, updated_at from support_cases where user_id = ${userId} order by updated_at desc limit 25`;
  const fraud = await sql<Row>`select id, title, severity, status, created_at from fraud_alerts where user_id = ${userId} order by created_at desc limit 25`;
  const creditApps = await sql<Row>`select id, status, employment_status, annual_income_cents, decision_reason, submitted_at from credit_applications where user_id = ${userId} order by created_at desc limit 10`;
  let notes: Row[] = [];
  try {
    notes = await sql<Row>`select id, author_user_id, body, created_at from staff_notes where customer_user_id = ${userId} order by created_at desc limit 50`;
  } catch {
    notes = [];
  }
  return {
    profile: {
      id: String(p.id),
      user_id: userId,
      email: p.email ? String(p.email) : null,
      username: p.username ? String(p.username) : null,
      moneylead_user_id: p.moneylead_user_id ? String(p.moneylead_user_id) : null,
      legal_first_name: p.legal_first_name ? String(p.legal_first_name) : null,
      legal_last_name: p.legal_last_name ? String(p.legal_last_name) : null,
      phone: p.phone ? String(p.phone) : null,
      dob: p.dob ? (iso(p.dob) ?? String(p.dob)).slice(0, 10) : null,
      ssn_last4: p.ssn_last4 ? String(p.ssn_last4) : null,
      kyc_status: String(p.kyc_status),
      checking_status: String(p.checking_status),
      credit_status: String(p.credit_status),
      onboarding_step: String(p.onboarding_step),
      provider_entity_id: p.provider_entity_id ? String(p.provider_entity_id) : null,
      provider_verification_status: p.provider_verification_status ? String(p.provider_verification_status) : null,
      created_at: iso(p.created_at),
    },
    addresses,
    accounts: accountRows.map((r) => ({
      id: String(r.id),
      status: String(r.status),
      account_last4: last4Digits(r.account_number),
      routing_last4: last4Digits(r.routing_number),
      available_cents: num(r.available_cents),
      current_cents: num(r.current_cents),
      pending_cents: num(r.pending_cents),
      provider_account_id: r.provider_account_id ? String(r.provider_account_id) : null,
      last_synced: iso(r.last_provider_sync_at),
      opened_at: iso(r.opened_at),
    })),
    kyc,
    transfers,
    transactions,
    support,
    fraud,
    notes,
    creditApps,
  };
}

const STAFF_ACTIONS: Record<string, StaffRole[]> = {
  "kyc.approve": ["compliance", "admin", "risk", "ultimate_admin"],
  "kyc.fail": ["compliance", "admin", "risk", "ultimate_admin"],
  "kyc.manual_review": ["compliance", "admin", "ops", "risk", "ultimate_admin"],
  "account.freeze": ["ops", "risk", "admin", "compliance", "finance", "ultimate_admin"],
  "account.unfreeze": ["ops", "admin", "ultimate_admin"],
  ...Object.fromEntries(ROLE_CAPABILITIES.map((row) => [row.id, row.roles])),
};

export async function adminAct(
  actorId: string,
  role: StaffRole,
  input: { action: string; entityId: string; note?: string },
) {
  const sql = await db();
  if (role === "viewer") return { ok: false as const, error: "Viewer role cannot mutate records." };
  const allowed = STAFF_ACTIONS[input.action];
  if (!allowed) return { ok: false as const, error: "Unknown action." };
  if (!allowed.includes(role)) return { ok: false as const, error: "Your role cannot perform this action." };
  const { action, entityId, note } = input;
  const deny = async (error: string) => {
    await writeAudit(sql, {
      actorUserId: actorId,
      actorRole: role,
      action: `admin.${action}.denied`,
      entityId,
      metadata: { error, note: note ? note.slice(0, 200) : null },
    });
    return { ok: false as const, error };
  };
  if (action === "kyc.approve" || action === "kyc.fail" || action === "kyc.manual_review") {
    return deny("Identity decisions come from the banking partner. Refresh Column status instead of changing KYC locally.");
  } else if (action === "kyc.refresh") {
    let profile =
      (await sql<Row>`select * from customer_profiles where id = ${entityId} or user_id = ${entityId} limit 1`)[0] ?? null;
    if (!profile) {
      const kycRow = await sql<Row>`select user_id from identity_verifications where id = ${entityId} limit 1`;
      if (kycRow[0]) {
        profile =
          (await sql<Row>`select * from customer_profiles where user_id = ${String(kycRow[0].user_id)} limit 1`)[0] ?? null;
      }
    }
    if (!profile) return { ok: false as const, error: "Customer not found." };
    if (!providers.columnKyc) return { ok: false as const, error: partnerMissing() };
    const entityIdCol = profile.provider_entity_id ? String(profile.provider_entity_id) : "";
    if (!entityIdCol) return { ok: false as const, error: "No banking-partner identity is on file for this customer." };
    try {
      const entity = await providers.columnKyc.getPerson(entityIdCol);
      const userId = String(profile.user_id);
      await sql`update customer_profiles set kyc_status = ${entity.verificationStatus}, provider_verification_status = ${entity.providerStatus}, updated_at = now() where user_id = ${userId}`;
      const latest = await sql<Row>`select id from identity_verifications where user_id = ${userId} order by created_at desc limit 1`;
      if (latest[0]) {
        await sql`update identity_verifications set status = ${entity.verificationStatus}, provider_verification_status = ${entity.providerStatus}, updated_at = now() where id = ${String(latest[0].id)}`;
      } else {
        await sql`insert into identity_verifications (id, user_id, provider, provider_ref, status, provider_verification_status)
          values (${newId("kyc")}, ${userId}, 'column', ${entity.entityId}, ${entity.verificationStatus}, ${entity.providerStatus})`;
      }
    } catch (err) {
      return { ok: false as const, error: columnError(err, "Could not refresh identity from the banking partner.") };
    }
  } else if (action.startsWith("kyc.review.")) {
    return kycReviewAct(sql, actorId, role, action, entityId, note);
  } else if (action === "dispute.resolve") {
    await sql`update disputes set status = 'resolved', updated_at = now() where id = ${entityId}`;
  } else if (action === "fraud.clear") {
    await sql`update fraud_alerts set status = 'cleared' where id = ${entityId}`;
  } else if (action === "support.close") {
    await sql`update support_cases set status = 'closed', updated_at = now() where id = ${entityId}`;
  } else if (action === "support.reply") {
    const body = (note ?? "").trim();
    if (!body) return { ok: false as const, error: "Write a reply." };
    const cse = await sql<Row>`select id, user_id, subject from support_cases where id = ${entityId} limit 1`;
    if (!cse[0]) return { ok: false as const, error: "Case not found." };
    await sql`insert into support_messages (id, case_id, user_id, author, body)
      values (${newId("msg")}, ${entityId}, ${actorId}, 'agent', ${body})`;
    await sql`update support_cases set status = 'waiting_on_customer', updated_at = now() where id = ${entityId}`;
    await pushNotification(sql, {
      userId: String(cse[0].user_id),
      title: "Support reply",
      body: "MONEYLEAD operations replied to your case.",
      kind: "support",
    });
  } else if (action === "account.freeze" || action === "account.unfreeze") {
    return deny(
      "Account freeze is owned by the banking partner. Column’s public API does not document a freeze endpoint used here.",
    );
  } else if (action === "account.sync") {
    const acc = await sql<Row>`select * from bank_accounts where id = ${entityId} limit 1`;
    if (!acc[0]) return { ok: false as const, error: "Account not found." };
    const synced = await syncColumnAccount(sql, acc[0]);
    if (synced.error) return { ok: false as const, error: synced.error };
  } else if (action === "notify.customer") {
    const flags = await loadFeatureFlags();
    if (!flags.staffCustomerMessaging) return { ok: false as const, error: "Staff customer messaging is turned off." };
    const body = (note ?? "").trim();
    if (!body) return { ok: false as const, error: "Write a message." };
    const profile = await sql<Row>`select user_id from customer_profiles where id = ${entityId} or user_id = ${entityId} limit 1`;
    if (!profile[0]) return { ok: false as const, error: "Customer not found." };
    await pushNotification(sql, {
      userId: String(profile[0].user_id),
      title: "Message from MONEYLEAD",
      body,
      kind: "ops",
    });
  } else if (action === "note.add") {
    const body = (note ?? "").trim();
    if (!body) return { ok: false as const, error: "Write a note." };
    const profile = await sql<Row>`select user_id from customer_profiles where id = ${entityId} or user_id = ${entityId} limit 1`;
    if (!profile[0]) return { ok: false as const, error: "Customer not found." };
    await sql`insert into staff_notes (id, customer_user_id, author_user_id, body)
      values (${newId("nte")}, ${String(profile[0].user_id)}, ${actorId}, ${body})`;
  } else if (action === "flag.set") {
    if (!FLAG_KEYS.has(entityId)) return { ok: false as const, error: "Unknown feature flag." };
    const enabled = note === "true" || note === "1" || note === "on";
    await sql`insert into feature_flags (key, enabled, description, updated_by, updated_at)
      values (${entityId}, ${enabled}, ${entityId.replaceAll("_", " ")}, ${actorId}, now())
      on conflict (key) do update set enabled = ${enabled}, updated_by = ${actorId}, updated_at = now()`;
  } else if (action === "staff.setRole") {
    const next = (note ?? "").trim() as StaffRole;
    if (!STAFF_ROLES.includes(next)) return { ok: false as const, error: "Unknown role." };
    if (next === "ultimate_admin" && role !== "ultimate_admin") {
      return deny("Only the Ultimate Administrator can assign that role.");
    }
    if (entityId === actorId && next !== "admin" && next !== "ultimate_admin") {
      return { ok: false as const, error: "You cannot remove your own administrator role." };
    }
    await sql`update staff_users set role = ${next} where user_id = ${entityId}`;
  } else if (action === "staff.invite") {
    const next = (note ?? "viewer").trim() as StaffRole;
    return inviteStaff(sql, actorId, role, { email: entityId, role: next });
  } else if (action === "staff.revoke") {
    const revoked = await revokeStaff(sql, actorId, role, entityId);
    if (!revoked.ok) return revoked;
  } else if (action === "credit.approve" || action === "credit.decline") {
    return deny("No licensed issuer is connected. MONEYLEAD will not approve or decline credit locally.");
  }
  await writeAudit(sql, {
    actorUserId: actorId,
    actorRole: role,
    action: `admin.${action}`,
    entityId,
    metadata: {
      note:
        action === "support.reply" || action === "note.add" || action === "notify.customer"
          ? (note ?? "").slice(0, 500)
          : action === "flag.set" || action === "staff.setRole"
            ? note
            : null,
    },
  });
  return { ok: true as const };
}

export async function adminSupportThread(caseId: string) {
  const sql = await db();
  const cases = await sql<Row>`select * from support_cases where id = ${caseId} limit 1`;
  if (!cases[0]) return null;
  const userId = String(cases[0].user_id);
  const profile = await sql<Row>`select id, email, legal_first_name, legal_last_name from customer_profiles where user_id = ${userId} limit 1`;
  const messages = await sql<Row>`select id, author, body, created_at from support_messages where case_id = ${caseId} order by created_at asc`;
  return {
    case: {
      id: String(cases[0].id),
      user_id: userId,
      subject: String(cases[0].subject),
      status: String(cases[0].status),
      created_at: iso(cases[0].created_at),
      updated_at: iso(cases[0].updated_at),
    },
    customer: profile[0]
      ? {
          id: String(profile[0].id),
          email: profile[0].email ? String(profile[0].email) : null,
          name: [profile[0].legal_first_name, profile[0].legal_last_name].filter(Boolean).join(" ") || "Customer",
        }
      : null,
    messages: messages.map((m) => ({
      id: String(m.id),
      author: String(m.author),
      body: String(m.body),
      created_at: iso(m.created_at),
    })),
  };
}

export async function adminFlags() {
  try {
    const sql = await db();
    const rows = await sql<Row>`select key, enabled, description, updated_at, updated_by from feature_flags order by key`;
    if (!rows.length) {
      return Object.entries(FLAG_CATALOG).map(([key, description]) => ({
        key,
        enabled: true,
        description,
        updated_at: null as string | null,
        updated_by: null as string | null,
      }));
    }
    const byKey = new Map(
      rows.map((r) => [
        String(r.key),
        {
          key: String(r.key),
          enabled: bool(r.enabled),
          description: String(r.description ?? FLAG_CATALOG[String(r.key)] ?? ""),
          updated_at: iso(r.updated_at),
          updated_by: r.updated_by ? String(r.updated_by) : null,
        },
      ]),
    );
    return Object.entries(FLAG_CATALOG).map(([key, description]) => {
      const row = byKey.get(key);
      return row ?? { key, enabled: true, description, updated_at: null, updated_by: null };
    });
  } catch {
    return Object.entries(FLAG_CATALOG).map(([key, description]) => ({
      key,
      enabled: true,
      description,
      updated_at: null as string | null,
      updated_by: null as string | null,
    }));
  }
}

export async function adminSettings() {
  const env = serverEnv();
  const sql = await db();
  const roster = await listStaff(sql);
  const banking = publicBankingStatus();
  const ai = aiProviderStatus();
  return {
    demoMode: banking.environment !== "live",
    environment: banking.environment,
    bankingConfigured: banking.configured,
    webhookSecretConfigured: banking.webhookSecretConfigured,
    aiConfigured: ai.configured,
    aiProviderLabel: ai.label,
    aiRequiredMessage: ai.requiredMessage,
    emailProviderConfigured: emailProviderConfigured(),
    database: dbSource,
    usingMocks: !banking.configured,
    providers: {
      banking: providers.banking.name,
      kyc: providers.kyc.name,
      cards: providers.cards.name,
      credit: providers.credit.name,
      payments: providers.payments.name,
      notify: providers.notify.name,
    },
    staff: roster.assigned.map((row) => ({
      userId: row.userId,
      role: row.role,
      email: row.email,
      createdAt: row.createdAt ?? "",
    })),
    designations: roster.designations,
    ultimateAdminEmail: roster.ultimateAdminEmail,
  };
}

export async function adminBankingProgram() {
  const banking = publicBankingStatus();
  return bankingProgramFromStatus(banking, { programApproved: await productionProgramApproved() });
}

async function productionProgramApproved(): Promise<boolean> {
  try {
    const sql = await db();
    const rows = await sql<{ key: string; value: string }>`
      select key, value from product_config
      where key in ('banking_program_status', 'production_banking_status')
    `;
    const map = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    return map.banking_program_status === "approved" && map.production_banking_status === "approved";
  } catch {
    return false;
  }
}

export async function publicProgramStatus() {
  const banking = publicBankingStatus();
  const programApproved = await productionProgramApproved();
  const program = bankingProgramFromStatus(banking, { programApproved });
  return program;
}

export async function adminIntegrations() {
  const banking = publicBankingStatus();
  const ai = aiProviderStatus();
  const email = emailProviderConfigured();
  return {
    items: [
      {
        id: "column",
        name: "Column",
        kind: "Banking infrastructure",
        status: banking.configured ? "Connected (sandbox)" : "Not configured",
        requirement: banking.configured ? null : "Column production credentials required.",
        detail: banking.configured
          ? "Sandbox credentials are present server-side. Production banking integration is pending approval."
          : "Fail-closed. MONEYLEAD will not invent account numbers, routing numbers, or balances.",
      },
      {
        id: "webhooks",
        name: "Column webhooks",
        kind: "Banking events",
        status: banking.webhookSecretConfigured ? "Signature verification enabled" : "Secret not configured",
        requirement: banking.webhookSecretConfigured ? null : "COLUMN_WEBHOOK_SECRET required for signed webhooks.",
        detail: "Webhook handling is idempotent. The same financial event is not applied twice.",
      },
      {
        id: "email",
        name: "Email provider",
        kind: "Notifications",
        status: email ? "Configured" : "Not configured",
        requirement: email ? null : "Administrator email provider required.",
        detail: email
          ? "Transactional email can be sent for staff invitations and account notices."
          : "In-app notifications continue. Activation emails are not sent until a provider is configured.",
      },
      {
        id: "ai",
        name: "AI provider",
        kind: "Optional intelligence",
        status: ai.configured ? ai.label : "Not configured",
        requirement: ai.configured ? null : "AI provider configuration required.",
        detail: ai.requiredMessage,
      },
      {
        id: "cards",
        name: "Card issuer",
        kind: "Debit / credit cards",
        status: "Card program pending",
        requirement: "Card issuer integration required.",
        detail: "Column’s public API does not issue consumer debit cards. No PAN or CVV is generated here.",
      },
      {
        id: "credit",
        name: "Credit provider",
        kind: "Credit",
        status: "Credit program pending",
        requirement: "Credit provider required.",
        detail: "Applications may be stored. MONEYLEAD will not invent APR, limits, scores, or approvals.",
      },
    ],
  };
}

export async function adminAiStatus() {
  const ai = aiProviderStatus();
  return {
    ...ai,
    emailProviderConfigured: emailProviderConfigured(),
    note: "MONEYLEAD CORE does not depend on an LLM. Banking, KYC, ledger, and authorization stay deterministic if no language provider is configured.",
  };
}

export async function getAuthoritativeFacts(userId: string) {
  const ws = await getWorkspace(userId);
  return {
    disclaimer: ws.disclaimer,
    checkingAvailableCents: ws.checking?.availableCents ?? null,
    checkingCurrentCents: ws.checking?.currentCents ?? null,
    creditBalanceCents: ws.creditCard?.currentBalanceCents ?? null,
    creditAvailableCents: ws.creditCard?.availableCreditCents ?? null,
    creditLimitCents: ws.creditCard?.creditLimitCents ?? null,
    kycStatus: ws.profile?.kycStatus ?? null,
    recentTransactions: ws.recentTransactions.map((t) => ({
      id: t.id,
      merchant: t.merchant,
      amountCents: t.amountCents,
      status: t.status,
      createdAt: t.createdAt,
      demonstration: t.isDemonstration,
    })),
    greeting: ws.greeting,
    firstName: ws.profile.legalFirstName,
    moneyleadUserId: ws.profile.moneyleadUserId,
  };
}

export async function claimUsername(userId: string, raw: string) {
  const parsed = validateUsername(raw);
  if (!parsed.ok) return parsed;
  const sql = await db();
  await ensureProfile(sql, userId);
  const taken = await sql<Row>`select user_id from customer_profiles where lower(username) = ${parsed.username} and user_id != ${userId} limit 1`;
  if (taken[0]) return { ok: false as const, error: "That username is taken." };
  await sql`update customer_profiles set username = ${parsed.username},
    updated_at = now() where user_id = ${userId}`;
  const after = await sql<Row>`select onboarding_step, email_verified_at from customer_profiles where user_id = ${userId} limit 1`;
  const step = String(after[0]?.onboarding_step ?? "");
  if (step === "username" || ((step === "welcome" || step === "email") && after[0]?.email_verified_at)) {
    await sql`update customer_profiles set onboarding_step = 'phone', updated_at = now() where user_id = ${userId}`;
  }
  await writeAudit(sql, { actorUserId: userId, action: "username.set", metadata: { username: parsed.username } });
  return { ok: true as const, username: parsed.username };
}

export async function checkUsernameAvailability(
  raw: string,
  userId?: string | null,
): Promise<{ status: "available" | "taken" | "invalid"; message: string; username?: string }> {
  const parsed = validateUsername(raw);
  if (!parsed.ok) return { status: "invalid", message: parsed.error };
  const sql = await db();
  try {
    const taken = userId
      ? await sql<Row>`select user_id from customer_profiles where lower(username) = ${parsed.username} and user_id != ${userId} limit 1`
      : await sql<Row>`select user_id from customer_profiles where lower(username) = ${parsed.username} limit 1`;
    if (taken[0]) return { status: "taken", message: "Already taken" };
  } catch {
    /* username column added in 0007 */
  }
  return { status: "available", message: "Available", username: parsed.username };
}

export async function saveSignupBasics(
  userId: string,
  input: { firstName: string; lastName: string; phone?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const first = input.firstName.trim();
  const last = input.lastName.trim();
  if (!first || !last) return { ok: false, error: "Enter your first and last name." };
  if (!/^[A-Za-z][A-Za-z'\- ]{0,39}$/.test(first) || !/^[A-Za-z][A-Za-z'\- ]{0,39}$/.test(last)) {
    return { ok: false, error: "Names can only use letters, spaces, apostrophes, or hyphens." };
  }
  const phone = input.phone?.trim() || null;
  if (phone && !/^\+?1?\d{10}$/.test(phone.replace(/[\s()-]/g, ""))) {
    return { ok: false, error: "Enter a valid U.S. phone number." };
  }
  const sql = await db();
  await ensureProfile(sql, userId);
  await sql`update customer_profiles set
    legal_first_name = ${first},
    legal_last_name = ${last},
    updated_at = now()
    where user_id = ${userId}`;
  try {
    await sql`update customer_profiles set preferred_name = ${first}, updated_at = now() where user_id = ${userId}`;
  } catch {
    /* preferred_name added in 0008 */
  }
  if (phone) {
    await sql`update customer_profiles set phone = ${phone}, updated_at = now() where user_id = ${userId}`;
  }
  return { ok: true };
}

export async function suggestAddresses(query: string): Promise<{ suggestions: AddressSuggestion[] }> {
  const q = query.trim();
  if (q.length < 4) return { suggestions: [] };
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=us&limit=5&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "MONEYLEAD/1.0 (address lookup)" },
    });
    if (!res.ok) return { suggestions: [] };
    const rows = (await res.json()) as Array<{
      display_name?: string;
      address?: {
        house_number?: string;
        road?: string;
        city?: string;
        town?: string;
        village?: string;
        hamlet?: string;
        state?: string;
        postcode?: string;
        country_code?: string;
      };
    }>;
    const suggestions: AddressSuggestion[] = [];
    for (const row of rows) {
      const a = row.address;
      if (!a) continue;
      const street = [a.house_number, a.road].filter(Boolean).join(" ");
      const city = a.city || a.town || a.village || a.hamlet || "";
      const state = usStateCode(a.state);
      const postalCode = (a.postcode ?? "").split("-")[0] ?? "";
      if (!street || !city || !state) continue;
      suggestions.push({
        line1: street,
        city,
        state,
        postalCode,
        country: "US",
        label: [street, city, state, postalCode].filter(Boolean).join(", "),
      });
    }
    return { suggestions };
  } catch {
    return { suggestions: [] };
  }
}

export async function lookupPostalCode(
  zip: string,
): Promise<{ city: string; state: string; postalCode: string } | null> {
  const digits = zip.replace(/\D/g, "").slice(0, 5);
  if (digits.length !== 5) return null;
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${digits}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      "post code"?: string;
      places?: Array<{ "place name"?: string; "state abbreviation"?: string }>;
    };
    const place = json.places?.[0];
    if (!place?.["place name"] || !place["state abbreviation"]) return null;
    return {
      city: place["place name"],
      state: place["state abbreviation"],
      postalCode: json["post code"] || digits,
    };
  } catch {
    return null;
  }
}

const US_STATE_NAMES: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  "district of columbia": "DC",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
};

function usStateCode(value: string | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  return US_STATE_NAMES[trimmed.toLowerCase()] ?? "";
}

export async function resolveLoginIdentifier(identifier: string): Promise<{ email: string }> {
  const raw = identifier.trim();
  if (!raw) return { email: "" };
  if (raw.includes("@")) return { email: raw.toLowerCase() };
  const parsed = validateUsername(raw);
  if (!parsed.ok) return { email: raw };
  const sql = await db();
  try {
    const row = await sql<Row>`select email from customer_profiles where lower(username) = ${parsed.username} limit 1`;
    if (row[0]?.email) return { email: String(row[0].email) };
  } catch {
    /* username column added in 0007 */
  }
  return { email: raw };
}

export async function checkLoginThrottle(email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return { ok: true as const };
  const sql = await db();
  try {
    const rows = await sql<Row>`
      select count(*) as c from failed_logins
      where email = ${normalized} and created_at > now() - interval '15 minutes'`;
    if (num(rows[0]?.c) >= 8) {
      return { ok: false as const, error: "Too many sign-in attempts. Wait a few minutes." };
    }
  } catch {
    /* table added in 0007 */
  }
  return { ok: true as const };
}

export async function recordFailedLogin(email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = email.trim().toLowerCase().slice(0, 180);
  const sql = await db();
  try {
    if (normalized) {
      await sql`insert into failed_logins (id, email) values (${newId("fln")}, ${normalized})`;
    }
  } catch {
    /* ignore */
  }
  return checkLoginThrottle(normalized);
}

export async function verifyPasscode(userId: string, passcode: string) {
  const sql = await db();
  const allowed = await hitRateLimit(sql, `pass:${userId}`, 8, 10 * 60 * 1000);
  if (!allowed) return { ok: false as const, error: "Too many attempts. Wait a few minutes." };
  const profile = await ensureProfile(sql, userId);
  const hash = profile.passcode_hash ? String(profile.passcode_hash) : "";
  if (!hash) return { ok: false as const, error: "Set a 6-digit passcode in Security first." };
  if (!/^\d{6}$/.test(passcode) || !safeEqual(hash, sha256(`${userId}:pass:${passcode}`))) {
    return { ok: false as const, error: "Passcode did not match." };
  }
  await sql`update customer_profiles set last_activity_at = now() where user_id = ${userId}`;
  return { ok: true as const };
}

export async function setPrivacyMode(userId: string, enabled: boolean) {
  const sql = await db();
  await sql`update customer_profiles set privacy_mode = ${enabled}, updated_at = now() where user_id = ${userId}`;
  await writeAudit(sql, { actorUserId: userId, action: "privacy.mode", metadata: { enabled } });
  return { ok: true as const };
}

export async function revokeOtherSessions(userId: string) {
  const sql = await db();
  await sql`update app_sessions set revoked_at = now()
    where user_id = ${userId}
      and revoked_at is null
      and not exists (
        select 1 from devices d
        where d.id = app_sessions.device_id and d.user_id = ${userId} and d.current_flag = true
      )`;
  await writeAudit(sql, { actorUserId: userId, action: "session.revoke_others" });
  return { ok: true as const };
}

export async function registerWebauthn(userId: string, credentialId: string, deviceName?: string) {
  const sql = await db();
  const id = credentialId.trim();
  if (id.length < 8 || id.length > 512) return { ok: false as const, error: "Invalid authenticator credential." };
  await sql`insert into webauthn_credentials (id, user_id, credential_id, device_name)
    values (${newId("web")}, ${userId}, ${id}, ${deviceName ?? "This device"})
    on conflict (credential_id) do update set last_used_at = now()`;
  await sql`update customer_profiles set biometrics_enabled = true, updated_at = now() where user_id = ${userId}`;
  await writeAudit(sql, { actorUserId: userId, action: "webauthn.register" });
  return { ok: true as const };
}

export async function issueWebauthnChallenge(userId: string, purpose: "unlock" | "reauth") {
  const sql = await db();
  const creds = await sql<Row>`select credential_id from webauthn_credentials where user_id = ${userId}`;
  const challenge = crypto.randomUUID().replace(/-/g, "");
  await sql`insert into webauthn_challenges (id, user_id, challenge, purpose, expires_at)
    values (${newId("wch")}, ${userId}, ${challenge}, ${purpose}, now() + interval '5 minutes')`;
  return {
    challenge,
    allowCredentials: creds.map((c) => String(c.credential_id)),
  };
}

export async function assertWebauthn(userId: string, input: { challenge: string; credentialId: string }) {
  const sql = await db();
  const ch = await sql<Row>`
    select id, challenge from webauthn_challenges
    where user_id = ${userId} and challenge = ${input.challenge} and consumed_at is null and expires_at > now()
    limit 1`;
  if (!ch[0]) return { ok: false as const, error: "That security challenge expired. Try again." };
  const cred = await sql<Row>`select id from webauthn_credentials where user_id = ${userId} and credential_id = ${input.credentialId} limit 1`;
  if (!cred[0]) return { ok: false as const, error: "This device is not registered for quick access." };
  await sql`update webauthn_challenges set consumed_at = now() where id = ${String(ch[0].id)}`;
  await sql`update webauthn_credentials set last_used_at = now() where id = ${String(cred[0].id)}`;
  return { ok: true as const };
}

export async function settleDueDemoTransfers(sql: Sql, userId: string) {
  const due = await sql<Row>`
    select * from demo_transfers
    where user_id = ${userId} and status = 'pending' and fail_after <= now()`;
  for (const row of due) {
    const reason = "Sandbox demonstration. No real funds moved.";
    await sql`update demo_transfers set status = 'failed', failure_reason = ${reason}, updated_at = now() where id = ${String(row.id)}`;
    if (row.transaction_id) {
      await sql`update transactions set status = 'failed', updated_at = now() where id = ${String(row.transaction_id)} and is_demonstration = true`;
    }
    await writeAudit(sql, {
      actorUserId: userId,
      action: "demo.transfer.failed",
      entityId: String(row.id),
      metadata: { reason, amountCents: num(row.amount_cents) },
    });
    await pushNotification(sql, {
      userId,
      title: "Demonstration transfer failed",
      body: `${DEMO_WATERMARK} The demonstration to ${String(row.counterparty_name)} did not move funds.`,
      kind: "demo",
    });
  }
}

export async function createDemoTransfer(
  userId: string,
  input: { amountCents: number; name: string; memo?: string; idempotencyKey: string },
) {
  const flags = await loadFeatureFlags();
  if (!flags.sandboxDemonstration) {
    return { ok: false as const, error: "Sandbox demonstration transfers are turned off." };
  }
  if (input.amountCents < 100 || input.amountCents > 2_500_000) {
    return { ok: false as const, error: "Enter an amount between $1.00 and $25,000.00." };
  }
  const name = input.name.trim();
  if (name.length < 2) return { ok: false as const, error: "Enter a recipient name for the demonstration." };
  const sql = await db();
  const existing = await sql<Row>`select id from transactions where idempotency_key = ${input.idempotencyKey} limit 1`;
  if (existing[0]) {
    const demo = await sql<Row>`select * from demo_transfers where transaction_id = ${String(existing[0].id)} limit 1`;
    return { ok: true as const, id: demo[0] ? String(demo[0].id) : String(existing[0].id), status: "pending" as const };
  }
  const txId = newId("txn");
  const demoId = newId("demo");
  await sql`insert into transactions (
      id, user_id, amount_cents, status, category, merchant, description, counterparty, idempotency_key, is_demonstration
    ) values (
      ${txId}, ${userId}, ${-input.amountCents}, 'pending', 'demonstration', ${name},
      ${input.memo?.trim() || "Sandbox demonstration transfer"}, ${name}, ${input.idempotencyKey}, true
    )`;
  await sql`insert into demo_transfers (id, user_id, transaction_id, amount_cents, counterparty_name, status, fail_after)
    values (${demoId}, ${userId}, ${txId}, ${input.amountCents}, ${name}, 'pending', now() + interval '8 seconds')`;
  await writeAudit(sql, {
    actorUserId: userId,
    action: "demo.transfer.created",
    entityId: demoId,
    metadata: { amountCents: input.amountCents, demonstration: true },
  });
  await pushNotification(sql, {
    userId,
    title: "Demonstration transfer pending",
    body: `${DEMO_WATERMARK} A demonstration to ${name} is pending. Your actual balance is unchanged.`,
    kind: "demo",
  });
  return { ok: true as const, id: demoId, transactionId: txId, status: "pending" as const };
}

export async function generateCurrentStatement(userId: string) {
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const periodEnd = now.toISOString().slice(0, 10);
  return generateStatement(userId, { periodStart, periodEnd, kind: "monthly" });
}

export async function generateStatement(
  userId: string,
  input: { periodStart: string; periodEnd: string; kind?: "monthly" | "yearly" | "custom" },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const periodStart = input.periodStart.slice(0, 10);
  const periodEnd = input.periodEnd.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd)) {
    return { ok: false, error: "Statement periods must use YYYY-MM-DD." };
  }
  if (periodEnd < periodStart) return { ok: false, error: "Period end must be on or after period start." };
  const sql = await db();
  const existing = await sql<Row>`
    select id from statements where user_id = ${userId} and product = 'checking' and period_start = ${periodStart} and period_end = ${periodEnd} limit 1`;
  if (existing[0]) return { ok: true, id: String(existing[0].id) };
  const acc = await sql<Row>`select id from bank_accounts where user_id = ${userId} and product = 'checking' order by created_at desc limit 1`;
  const txs = await listTransactions(userId);
  const inPeriod = txs.filter(
    (t) => t.createdAt.slice(0, 10) >= periodStart && t.createdAt.slice(0, 10) <= periodEnd && !t.isDemonstration,
  );
  const credits = inPeriod.filter((t) => t.amountCents > 0).reduce((s, t) => s + t.amountCents, 0);
  const debits = inPeriod.filter((t) => t.amountCents < 0).reduce((s, t) => s + Math.abs(t.amountCents), 0);
  let historicalCredits = 0;
  let historicalDebits = 0;
  try {
    const hist = await sql<Row>`
      select amount_cents from historical_records
      where user_id = ${userId} and superseded_by is null and kind in ('transaction','transfer')
        and source_occurred_at::date >= ${periodStart}::date and source_occurred_at::date <= ${periodEnd}::date`;
    for (const h of hist) {
      const amt = num(h.amount_cents);
      if (amt > 0) historicalCredits += amt;
      else historicalDebits += Math.abs(amt);
    }
  } catch {
    /* 0008 */
  }
  const bal = acc[0]
    ? await sql<Row>`select available_cents from bank_account_balances where account_id = ${String(acc[0].id)}`
    : [];
  const closing = acc[0] ? num(bal[0]?.available_cents) : 0;
  const opening = closing - credits + debits - historicalCredits + historicalDebits;
  const id = newId("stm");
  await sql`insert into statements (id, user_id, account_id, product, period_start, period_end, opening_cents, closing_cents)
    values (${id}, ${userId}, ${acc[0] ? String(acc[0].id) : null}, 'checking', ${periodStart}, ${periodEnd}, ${opening}, ${closing})`;
  await writeAudit(sql, {
    actorUserId: userId,
    action: "statement.generate",
    entityId: id,
    metadata: { kind: input.kind ?? "custom", periodStart, periodEnd },
  });
  return { ok: true, id };
}

export async function statementPdf(userId: string, id: string): Promise<{ filename: string; base64: string } | null> {
  const detail = await getStatement(userId, id);
  if (!detail) return null;
  const sql = await db();
  const profileRow = await ensureProfile(sql, userId);
  const addresses = await sql<Row>`select * from addresses where user_id = ${userId} order by created_at desc limit 1`;
  const profile = mapProfile(profileRow, addresses[0] ?? null);
  const checking = (await sql<Row>`select * from bank_accounts where user_id = ${userId} and product = 'checking' order by created_at desc limit 1`)[0];
  const last4 = checking ? String(checking.account_number).replace(/\D/g, "").slice(-4) : "—";
  const legal = [profile.legalFirstName, profile.legalLastName].filter(Boolean).join(" ") || "Account holder";
  const credits = detail.transactions.filter((t) => t.amountCents > 0 && !t.isDemonstration).reduce((s, t) => s + t.amountCents, 0);
  const debits = detail.transactions.filter((t) => t.amountCents < 0 && !t.isDemonstration).reduce((s, t) => s + Math.abs(t.amountCents), 0);
  const lines = [
    "MONEYLEAD",
    "Statement of Account",
    DEMO_WATERMARK,
    "",
    `Customer: ${legal}`,
    `MONEYLEAD User ID: ${profile.moneyleadUserId ?? "—"}`,
    "Account type: Checking",
    `Statement period: ${detail.periodStart} to ${detail.periodEnd}`,
    `Account last four: ${last4}`,
    "",
    `Opening balance: ${usd(detail.openingCents)}`,
    `Total credits: ${usd(credits)}`,
    `Total debits: ${usd(debits)}`,
    "Fees: $0.00",
    `Ending balance: ${usd(detail.closingCents)}`,
    "",
    "Date        Description                         Ref              Debit        Credit       Balance",
    "------------------------------------------------------------------------------------------------",
  ];
  let running = detail.openingCents;
  for (const tx of [...detail.transactions].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    if (tx.isDemonstration) continue;
    running += tx.amountCents;
    const debit = tx.amountCents < 0 ? usd(Math.abs(tx.amountCents)).padStart(12) : "".padStart(12);
    const credit = tx.amountCents > 0 ? usd(tx.amountCents).padStart(12) : "".padStart(12);
    lines.push(
      `${tx.createdAt.slice(0, 10)}  ${tx.merchant.slice(0, 32).padEnd(32)}  ${tx.id.slice(0, 12).padEnd(14)} ${debit} ${credit}  ${usd(running)}`,
    );
  }
  if (detail.transactions.filter((t) => !t.isDemonstration).length === 0) {
    lines.push("No posted activity in this period.");
  }
  lines.push("", DEMO_WATERMARK, "This is not an official live-bank tax document.");
  const bytes = buildPdf(lines);
  await writeAudit(sql, { actorUserId: userId, action: "statement.download", entityId: id });
  return { filename: `MONEYLEAD-Statement-${detail.periodEnd}.pdf`, base64: uint8ToBase64(bytes) };
}

export async function listDocuments(userId: string) {
  const sql = await db();
  const statements = await listStatements(userId);
  const notices = await sql<Row>`
    select id, title, created_at from notifications
    where user_id = ${userId} and kind in ('account','security','ops')
    order by created_at desc limit 20`;
  const receipts = await sql<Row>`
    select id, merchant, created_at from transactions
    where user_id = ${userId} and is_demonstration = false
    order by created_at desc limit 20`;
  return {
    statements: statements.map((s) => ({
      id: s.id,
      kind: "statement" as const,
      title: `Statement ${s.periodStart} – ${s.periodEnd}`,
      filename: `MONEYLEAD-Statement-${s.periodEnd}.pdf`,
      createdAt: s.periodEnd,
    })),
    receipts: receipts.map((r) => ({
      id: String(r.id),
      kind: "receipt" as const,
      title: `Receipt · ${String(r.merchant)}`,
      filename: `MONEYLEAD-Transaction-Receipt-${String(r.id).slice(0, 8)}.pdf`,
      createdAt: iso(r.created_at) ?? "",
    })),
    notices: notices.map((n) => ({
      id: String(n.id),
      kind: "notice" as const,
      title: String(n.title),
      filename: `MONEYLEAD-Notice-${String(n.id).slice(0, 8)}.pdf`,
      createdAt: iso(n.created_at) ?? "",
    })),
    kyc: [
      {
        id: "kyc-provider",
        kind: "kyc" as const,
        title: "Identity documents are held by the verification provider",
        filename: "",
        createdAt: "",
      },
    ],
  };
}

export async function receiptPdf(userId: string, id: string) {
  const tx = await getTransaction(userId, id);
  if (!tx) return null;
  const sql = await db();
  const profile = await ensureProfile(sql, userId);
  const lines = [
    "MONEYLEAD",
    "Transaction receipt",
    tx.isDemonstration || resolvedBankingEnvironment() !== "live" ? DEMO_WATERMARK : "Treat this receipt as sensitive.",
    "",
    `MONEYLEAD User ID: ${profile.moneylead_user_id ?? "—"}`,
    `Reference: ${tx.id}`,
    `Date: ${tx.createdAt}`,
    `Description: ${tx.merchant}`,
    `Amount: ${usd(tx.amountCents)}`,
    `Status: ${tx.status}`,
    tx.isDemonstration ? DEMO_WATERMARK : "",
  ].filter(Boolean);
  await writeAudit(sql, { actorUserId: userId, action: "receipt.download", entityId: id });
  return { filename: `MONEYLEAD-Transaction-Receipt-${tx.id.slice(0, 8)}.pdf`, base64: uint8ToBase64(buildPdf(lines)) };
}

export async function noticePdf(userId: string, id: string) {
  const sql = await db();
  const row = (await sql<Row>`select * from notifications where id = ${id} and user_id = ${userId} limit 1`)[0];
  if (!row) return null;
  const lines = [
    "MONEYLEAD",
    "Notice",
    DEMO_WATERMARK,
    "",
    String(row.title),
    "",
    String(row.body),
    "",
    `Date: ${iso(row.created_at) ?? ""}`,
  ];
  await writeAudit(sql, { actorUserId: userId, action: "notice.download", entityId: id });
  return { filename: `MONEYLEAD-Notice-${id.slice(0, 8)}.pdf`, base64: uint8ToBase64(buildPdf(lines)) };
}

export async function downloadAllDocuments(userId: string, ids: { statements?: string[]; receipts?: string[]; notices?: string[] }) {
  const entries: { name: string; data: Uint8Array }[] = [];
  for (const id of ids.statements ?? []) {
    const pdf = await statementPdf(userId, id);
    if (pdf) entries.push({ name: `Statements/${pdf.filename}`, data: Buffer.from(pdf.base64, "base64") });
  }
  for (const id of ids.receipts ?? []) {
    const pdf = await receiptPdf(userId, id);
    if (pdf) entries.push({ name: `Receipts/${pdf.filename}`, data: Buffer.from(pdf.base64, "base64") });
  }
  for (const id of ids.notices ?? []) {
    const pdf = await noticePdf(userId, id);
    if (pdf) entries.push({ name: `Notices/${pdf.filename}`, data: Buffer.from(pdf.base64, "base64") });
  }
  const kycNotice = buildPdf([
    "MONEYLEAD",
    "KYC documents",
    "",
    "Identity documents are held by the verification provider.",
    "MONEYLEAD does not store identity images in this application or put them in public URLs.",
    "This notice is included so your download package stays complete and truthful.",
  ]);
  entries.push({ name: "KYC/MONEYLEAD-KYC-Notice.pdf", data: kycNotice });
  const otherNotice = buildPdf([
    "MONEYLEAD",
    "Other documents",
    "",
    "No additional customer documents are stored in this package.",
    "Staff records, API keys, and other customers’ files are never included.",
  ]);
  entries.push({ name: "Other/MONEYLEAD-Other-Notice.pdf", data: otherNotice });
  const zip = buildZip(entries);
  const sql = await db();
  await writeAudit(sql, { actorUserId: userId, action: "documents.download_all", metadata: { count: entries.length } });
  return { ok: true as const, filename: "MONEYLEAD-Documents.zip", base64: uint8ToBase64(zip) };
}

function usd(cents: number) {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(cents));
  return `${sign}$${Math.floor(abs / 100)}.${(abs % 100).toString().padStart(2, "0")}`;
}

async function kycSlaHours(sql: Sql): Promise<number> {
  try {
    const rows = await sql<{ value: string }>`select value from product_config where key = 'kyc_sla_hours' limit 1`;
    const n = Number(rows[0]?.value);
    return Number.isFinite(n) && n > 0 ? n : 24;
  } catch {
    return 24;
  }
}

async function kycAutoApprovalEnabled(sql: Sql): Promise<boolean> {
  try {
    const rows = await sql<{ value: string }>`select value from product_config where key = 'kyc_auto_approval_enabled' limit 1`;
    return rows[0]?.value === "true";
  } catch {
    return false;
  }
}

export async function runCustomerKycAgent(userId: string) {
  const sql = await db();
  const profileRow = await ensureProfile(sql, userId);
  const addresses = await sql<Row>`select * from addresses where user_id = ${userId} order by created_at desc limit 1`;
  const kyc = (await sql<Row>`select * from identity_verifications where user_id = ${userId} order by created_at desc limit 1`)[0];
  const sla = await kycSlaHours(sql);
  const deadline = kyc?.review_deadline ? new Date(String(kyc.review_deadline)) : null;
  const result = runKycAgent({
    legalFirstName: profileRow.legal_first_name ? String(profileRow.legal_first_name) : null,
    legalLastName: profileRow.legal_last_name ? String(profileRow.legal_last_name) : null,
    dob: profileRow.dob ? String(profileRow.dob).slice(0, 10) : null,
    addressLine1: addresses[0]?.line1 ? String(addresses[0].line1) : null,
    city: addresses[0]?.city ? String(addresses[0].city) : null,
    state: addresses[0]?.state ? String(addresses[0].state) : null,
    postalCode: addresses[0]?.postal_code ? String(addresses[0].postal_code) : null,
    documentType: kyc?.document_type ? String(kyc.document_type) : null,
    partnerStatus: profileRow.kyc_status ? String(profileRow.kyc_status) : null,
    deadlinePassed: Boolean(deadline && Date.now() > deadline.getTime() && String(profileRow.kyc_status) !== "approved"),
    autoApprovalEnabled: await kycAutoApprovalEnabled(sql),
  });
  if (kyc) {
    await sql`update identity_verifications
      set agent_recommendation = ${result.recommendation}, agent_reason = ${result.reason},
          workflow_status = coalesce(workflow_status, ${result.workflow}), updated_at = now()
      where id = ${String(kyc.id)}`;
    if (result.workflow === "ESCALATED") {
      await sql`update identity_verifications set workflow_status = 'ESCALATED', updated_at = now() where id = ${String(kyc.id)}`;
    }
  }
  return { ...result, slaHours: sla, reviewDeadline: deadline ? deadline.toISOString() : null };
}

export async function adminKycQueue() {
  const sql = await db();
  await expireKycDeadlines(sql);
  const rows = await sql<Row>`
    select v.*, p.legal_first_name, p.legal_last_name, p.moneylead_user_id, p.kyc_status as profile_kyc
    from identity_verifications v
    join customer_profiles p on p.user_id = v.user_id
    order by v.created_at desc
    limit 80`;
  return rows.map((row) => {
    const deadline = row.review_deadline ? new Date(String(row.review_deadline)).toISOString() : null;
    const remaining = row.review_deadline ? new Date(String(row.review_deadline)).getTime() - Date.now() : null;
    return {
      id: String(row.id),
      userId: String(row.user_id),
      moneyleadUserId: row.moneylead_user_id ? String(row.moneylead_user_id) : null,
      name: [row.legal_first_name, row.legal_last_name].filter(Boolean).join(" ") || "Customer",
      partnerStatus: String(row.status),
      workflowStatus: String(row.workflow_status ?? mapPartnerToWorkflow(String(row.status))),
      submittedAt: iso(row.submitted_at ?? row.created_at),
      reviewDeadline: deadline,
      timeRemainingMs: remaining,
      assignedReviewer: row.assigned_reviewer ? String(row.assigned_reviewer) : null,
      priority: String(row.priority ?? "normal"),
      recommendation: row.agent_recommendation ? String(row.agent_recommendation) : null,
      lastAction: iso(row.updated_at),
    };
  });
}

async function expireKycDeadlines(sql: Sql) {
  await sql`update identity_verifications
    set workflow_status = 'EXPIRED', expired_at = coalesce(expired_at, now()), updated_at = now()
    where review_deadline is not null
      and review_deadline < now()
      and workflow_status in ('SUBMITTED','UNDER_REVIEW','IN_PROGRESS')
      and status not in ('approved','failed')`;
}

async function kycReviewAct(
  sql: Sql,
  actorId: string,
  role: StaffRole,
  action: string,
  entityId: string,
  note?: string,
) {
  const row =
    (await sql<Row>`select * from identity_verifications where id = ${entityId} or user_id = ${entityId} order by created_at desc limit 1`)[0] ??
    null;
  if (!row) return { ok: false as const, error: "KYC record not found." };
  const previous = String(row.workflow_status ?? row.status);
  const userId = String(row.user_id);
  let next = previous;
  let customerMessage: string | null = null;
  if (action === "kyc.review.request_info") {
    next = "NEEDS_INFORMATION";
    customerMessage = "We need a little more information to finish verifying your identity.";
  } else if (action === "kyc.review.escalate") {
    next = "ESCALATED";
  } else if (action === "kyc.review.reject") {
    if (!(note ?? "").trim()) return { ok: false as const, error: "A structured reason is required to reject." };
    next = "REJECTED";
    customerMessage = "We couldn't complete your identity verification. Please review the requested information and try again.";
  } else if (action === "kyc.review.approve") {
    next = "APPROVED";
    customerMessage = "Your identity has been verified. Checking still opens only after the banking partner completes verification.";
  } else {
    return { ok: false as const, error: "Unknown KYC review action." };
  }
  await sql`update identity_verifications
    set workflow_status = ${next}, review_notes = ${note ?? row.review_notes},
        review_completed_at = case when ${next} in ('APPROVED','REJECTED') then now() else review_completed_at end,
        approved_by = case when ${action === "kyc.review.approve"} then ${actorId} else approved_by end,
        approval_method = case when ${action === "kyc.review.approve"} then 'human_review' else approval_method end,
        customer_reason = ${customerMessage},
        updated_at = now()
    where id = ${String(row.id)}`;
  await sql`insert into kyc_events (id, user_id, verification_id, actor_user_id, actor_role, action, previous_status, new_status, reason)
    values (${newId("kye")}, ${userId}, ${String(row.id)}, ${actorId}, ${role}, ${action}, ${previous}, ${next}, ${note ?? null})`;
  if (customerMessage) {
    await pushNotification(sql, { userId, title: "Identity verification update", body: customerMessage, kind: "account" });
  }
  return {
    ok: true as const,
    notice:
      action === "kyc.review.approve"
        ? "MONEYLEAD review recorded. Checking still opens only after the banking partner verifies identity. This does not fabricate Column approval."
        : undefined,
  };
}

export async function stampKycSubmission(userId: string) {
  const sql = await db();
  const sla = await kycSlaHours(sql);
  const latest = await sql<Row>`select id from identity_verifications where user_id = ${userId} order by created_at desc limit 1`;
  if (!latest[0]) return;
  const deadline = kycDeadline(new Date(), sla);
  await sql`update identity_verifications
    set submitted_at = coalesce(submitted_at, now()),
        review_deadline = coalesce(review_deadline, ${deadline.toISOString()}),
        workflow_status = case
          when workflow_status is null or workflow_status = 'IN_PROGRESS' then 'SUBMITTED'
          else workflow_status
        end,
        updated_at = now()
    where id = ${String(latest[0].id)}`;
  await runCustomerKycAgent(userId);
}

