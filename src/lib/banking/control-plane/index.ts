/**
 * MONEYLEAD Control Plane — deterministic authority for the platform.
 * The Assistant, customer app, and operations console all go through here.
 * Column is reached only via BankingProvider. COLUMN_API_KEY never leaves that client.
 */

import { getSql } from "@/lib/db";
import { publicBankingStatus } from "../env";
import { dbSource } from "@/lib/db";
import * as engine from "../engine";
import { newId } from "../ids";
import { PRODUCT, SENSITIVE_ACTIONS, TX_STATUS_COPY } from "./policies";
import { aiProviderStatus, emailProviderConfigured } from "@/lib/ai/provider";
import { assertCapability, ControlPlaneError, type Actor } from "./authority";

export type { Actor } from "./authority";
export { assertCapability, ControlPlaneError } from "./authority";

async function audit(actor: Actor, action: string, entityId?: string, metadata?: unknown) {
  const sql = await getSql();
  await engine.writeAudit(sql, {
    actorUserId: actor.userId,
    actorRole: actor.kind === "staff" ? actor.role : actor.kind,
    action: `control.${action}`,
    entityId,
    metadata,
  });
}

export async function reportProviderFailure(input: {
  operation: string;
  httpStatus?: number;
  customerMessage: string;
  userId?: string;
}) {
  const sql = await getSql();
  await sql`insert into provider_errors (id, provider, operation, http_status, customer_message, user_id)
    values (
      ${newId("perr")},
      'column',
      ${input.operation},
      ${input.httpStatus ?? null},
      ${input.customerMessage.slice(0, 500)},
      ${input.userId ?? null}
    )`;
}

export type CustomerSnapshot = {
  configured: boolean;
  environment: string;
  kycStatus: string | null;
  checkingStatus: string | null;
  onboardingStep: string | null;
  hasChecking: boolean;
  availableCents: number | null;
  currentCents: number | null;
  routingLast4: string | null;
  accountLast4: string | null;
  debitIssued: boolean;
  creditStatus: string | null;
  openSupport: number;
  disclaimer: string;
};

/** Facts the Assistant may see. Never includes COLUMN_API_KEY or full account numbers. */
export async function customerSnapshot(actor: Actor): Promise<CustomerSnapshot> {
  assertCapability(actor, "workspace.read");
  const ws = await engine.getWorkspace(actor.userId);
  const routing = ws.checking?.routingNumber ?? "";
  const acct = ws.checking?.accountNumberFull ?? ws.checking?.accountNumberMasked ?? "";
  return {
    configured: ws.banking.configured,
    environment: ws.banking.environment,
    kycStatus: ws.profile?.kycStatus ?? null,
    checkingStatus: ws.profile?.checkingStatus ?? null,
    onboardingStep: ws.profile?.onboardingStep ?? null,
    hasChecking: Boolean(ws.checking),
    availableCents: ws.checking?.availableCents ?? null,
    currentCents: ws.checking?.currentCents ?? null,
    routingLast4: routing ? routing.slice(-4) : null,
    accountLast4: acct.replace(/\D/g, "").slice(-4) || null,
    debitIssued: Boolean(ws.debitCard),
    creditStatus: ws.profile?.creditStatus ?? null,
    openSupport: ws.fraudOpen,
    disclaimer: ws.disclaimer,
  };
}

export async function escalateToSupport(actor: Actor, subject: string, body: string) {
  assertCapability(actor, "support.escalate");
  const sub = subject.trim().slice(0, 120) || "Assistant escalation";
  const msg = body.trim().slice(0, 4000);
  if (!msg) return { ok: false as const, error: "Write a short description so operations can help." };
  const result = await engine.createSupportCase(actor.userId, sub, msg);
  await audit(actor, "support.escalate", undefined, { subject: sub });
  return result;
}

export async function createConfirmation(
  actor: Actor,
  action: string,
  payload: Record<string, unknown>,
) {
  assertCapability(actor, "confirmation.create");
  if (!SENSITIVE_ACTIONS.has(action)) {
    return { ok: false as const, error: "That action does not require confirmation." };
  }
  const sql = await getSql();
  const id = newId("cnf");
  await sql`insert into action_confirmations (id, user_id, action, payload, requested_by, expires_at)
    values (
      ${id},
      ${actor.userId},
      ${action},
      ${JSON.stringify(payload)},
      ${actor.kind},
      now() + interval '15 minutes'
    )`;
  await audit(actor, "confirmation.create", id, { action });
  return {
    ok: true as const,
    confirmationId: id,
    action,
    expiresInMinutes: 15,
    message: "This needs your confirmation in the app. The Assistant will not execute it.",
  };
}

export async function listConfirmations(actor: Actor) {
  assertCapability(actor, "confirmation.list");
  const sql = await getSql();
  return sql<{ id: string; action: string; status: string; created_at: Date; expires_at: Date }>`
    select id, action, status, created_at, expires_at
    from action_confirmations
    where user_id = ${actor.userId} and status = 'pending' and expires_at > now()
    order by created_at desc
    limit 10
  `;
}

export async function resolveConfirmation(
  actor: Actor,
  confirmationId: string,
  decision: "confirm" | "deny",
) {
  if (actor.kind === "assistant") {
    throw new ControlPlaneError("The Assistant cannot confirm financial actions.");
  }
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    action: string;
    payload: string;
    status: string;
    expires_at: Date;
  }>`select id, action, payload, status, expires_at from action_confirmations
     where id = ${confirmationId} and user_id = ${actor.userId} limit 1`;
  const row = rows[0];
  if (!row) return { ok: false as const, error: "Confirmation not found." };
  if (row.status !== "pending") return { ok: false as const, error: "This request is no longer pending." };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await sql`update action_confirmations set status = 'expired', resolved_at = now() where id = ${row.id}`;
    return { ok: false as const, error: "This request expired. Ask again if you still want it." };
  }
  if (decision === "deny") {
    await sql`update action_confirmations set status = 'denied', resolved_at = now() where id = ${row.id}`;
    await audit(actor, "confirmation.deny", row.id);
    return { ok: true as const, status: "denied" as const };
  }
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(row.payload) as Record<string, unknown>;
  } catch {
    return { ok: false as const, error: "Stored request was unreadable." };
  }
  const executed = await executeSensitive(actor, row.action, payload);
  await sql`update action_confirmations set status = ${executed.ok ? "confirmed" : "denied"}, resolved_at = now() where id = ${row.id}`;
  await audit(actor, "confirmation.confirm", row.id, { ok: executed.ok });
  return executed;
}

async function executeSensitive(actor: Actor, action: string, payload: Record<string, unknown>) {
  if (actor.kind !== "customer" && actor.kind !== "staff") {
    throw new ControlPlaneError("Only the account holder can complete this action.");
  }
  const userId = actor.userId;
  switch (action) {
    case "transfer.send":
      return engine.sendMoney(userId, {
        amountCents: Number(payload.amountCents),
        name: String(payload.name ?? ""),
        routing: String(payload.routing ?? ""),
        account: String(payload.account ?? ""),
        memo: String(payload.memo ?? payload.description ?? ""),
        idempotencyKey: String(payload.idempotencyKey ?? `cnf:${crypto.randomUUID()}`),
        authorized: true,
      });
    case "checking.submit":
      return engine.submitCheckingApplication(userId);
    case "account.close":
      return engine.closeAccount(userId, String(payload.reason ?? "Customer requested closure"));
    case "credit.apply":
      return engine.applyCredit(userId, payload as Parameters<typeof engine.applyCredit>[1]);
    case "credit.pay":
      return engine.payCredit(userId, payload as Parameters<typeof engine.payCredit>[1]);
    case "card.issue":
      return engine.issueDebitCard(userId);
    default:
      return { ok: false as const, error: "Unknown action." };
  }
}

/** Customer-app gateway. UI mutations go through here so Assistant cannot skip the plane. */
export function forCustomer(userId: string) {
  const actor: Actor = { kind: "customer", userId };
  return {
    actor,
    getWorkspace: () => engine.getWorkspace(userId),
    submitChecking: () => engine.submitCheckingApplication(userId),
    fundAccount: (input: Parameters<typeof engine.fundAccount>[1]) => engine.fundAccount(userId, input),
    sendMoney: (input: Parameters<typeof engine.sendMoney>[1]) => engine.sendMoney(userId, input),
    kycStart: () => engine.kycStart(userId),
    kycSubmitDocument: (documentType: string) => engine.kycSubmitDocument(userId, documentType),
    kycSubmitSelfie: () => engine.kycSubmitSelfie(userId),
    savePersonal: (input: Parameters<typeof engine.savePersonal>[1]) => engine.savePersonal(userId, input),
    saveSecurity: (input: Parameters<typeof engine.saveSecurity>[1]) => engine.saveSecurity(userId, input),
    startOtp: (destination: string, method: "sms" | "voice" | "email") => engine.startOtp(userId, destination, method),
    verifyOtp: (code: string, method: "sms" | "voice" | "email") => engine.verifyOtp(userId, code, method),
    issueDebit: () => engine.issueDebitCard(userId),
    activateDebit: (last4: string) => engine.activateDebit(userId, last4),
    setDebitPin: (pin: string) => engine.setDebitPin(userId, pin),
    updateDebit: (input: Parameters<typeof engine.updateDebit>[1]) => engine.updateDebit(userId, input),
    applyCredit: (input: Parameters<typeof engine.applyCredit>[1]) => engine.applyCredit(userId, input),
    payCredit: (input: Parameters<typeof engine.payCredit>[1]) => engine.payCredit(userId, input),
    updateCredit: (input: Parameters<typeof engine.updateCredit>[1]) => engine.updateCredit(userId, input),
    closeAccount: (reason: string) => engine.closeAccount(userId, reason),
    createSupportCase: (subject: string, body: string) => engine.createSupportCase(userId, subject, body),
  };
}

export async function systemHealth() {
  const banking = publicBankingStatus();
  const sql = await getSql();
  const ai = aiProviderStatus();
  const failedHooks = await sql<{ c: number }>`select count(*)::int as c from webhook_events where processing_status = 'failed'`;
  const openReco = await sql<{ c: number }>`select count(*)::int as c from reconciliation_alerts where status = 'open'`;
  const recentErrors = await sql<{ c: number }>`select count(*)::int as c from provider_errors where created_at > now() - interval '24 hours'`;
  const lastHook = await sql<{ received_at: Date; event_type: string | null; processing_status: string }>`
    select received_at, event_type, processing_status from webhook_events order by received_at desc limit 1`;
  return {
    environment: banking.environment,
    columnConfigured: banking.configured,
    webhookSecretConfigured: banking.webhookSecretConfigured,
    database: dbSource,
    xaiConfigured: ai.configured,
    aiConfigured: ai.configured,
    aiProviderLabel: ai.label,
    emailProviderConfigured: emailProviderConfigured(),
    failedWebhooks: Number(failedHooks[0]?.c ?? 0),
    openReconciliation: Number(openReco[0]?.c ?? 0),
    providerErrors24h: Number(recentErrors[0]?.c ?? 0),
    lastWebhookAt: lastHook[0]?.received_at ? new Date(lastHook[0].received_at).toISOString() : null,
    lastWebhookType: lastHook[0]?.event_type ?? null,
    lastWebhookStatus: lastHook[0]?.processing_status ?? null,
    debitCardsIssued: false,
    creditIssuer: "none",
    product: PRODUCT.name,
  };
}

export async function productConfig() {
  const sql = await getSql();
  const rows = await sql<{ key: string; value: string; updated_at: Date }>`select key, value, updated_at from product_config order by key`;
  return rows.map((r) => ({ key: r.key, value: r.value, updatedAt: new Date(r.updated_at).toISOString() }));
}

export async function updateProductConfig(actor: Actor, key: string, value: string) {
  if (actor.kind !== "staff" || (actor.role !== "admin" && actor.role !== "ops" && actor.role !== "ultimate_admin")) {
    throw new ControlPlaneError("Only operations admins can change product configuration.");
  }
  const allowed = new Set([
    "ach_outbound_daily_limit_cents",
    "ach_inbound_daily_limit_cents",
    "support_hours",
    "sandbox_disclaimer",
    "kyc_sla_hours",
    "kyc_auto_approval_enabled",
  ]);
  if (!allowed.has(key)) {
    return { ok: false as const, error: "That configuration key cannot be changed here. Secrets are not stored in product config." };
  }
  if (/key|secret|token|password/i.test(key) || /key|secret|token/i.test(value)) {
    return { ok: false as const, error: "Secrets cannot be stored in product configuration." };
  }
  const sql = await getSql();
  await sql`insert into product_config (key, value, updated_by, updated_at)
    values (${key}, ${value.slice(0, 500)}, ${actor.userId}, now())
    on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()`;
  await audit(actor, "config.update", key);
  return { ok: true as const };
}

export async function listManualReviews() {
  const sql = await getSql();
  const kyc = await sql<{ id: string; user_id: string; status: string; created_at: Date }>`
    select id, user_id, status, created_at from identity_verifications
    where status in ('manual_review','additional_info') order by created_at desc limit 50`;
  const credit = await sql<{ id: string; user_id: string; status: string; created_at: Date }>`
    select id, user_id, status, created_at from credit_applications
    where status in ('submitted','additional_info') order by created_at desc limit 50`;
  const stored = await sql<{ id: string; user_id: string; kind: string; status: string; summary: string; created_at: Date }>`
    select id, user_id, kind, status, summary, created_at from manual_reviews where status = 'open' order by created_at desc limit 50`;
  return {
    kyc: kyc.map((r) => ({
      id: r.id,
      userId: r.user_id,
      kind: "kyc",
      status: r.status,
      summary: "Identity is in partner review. Operators cannot locally approve it.",
      createdAt: new Date(r.created_at).toISOString(),
    })),
    credit: credit.map((r) => ({
      id: r.id,
      userId: r.user_id,
      kind: "credit",
      status: r.status,
      summary: "Credit application stored. No issuer is connected, so this cannot be approved here.",
      createdAt: new Date(r.created_at).toISOString(),
    })),
    other: stored.map((r) => ({
      id: r.id,
      userId: r.user_id,
      kind: r.kind,
      status: r.status,
      summary: r.summary,
      createdAt: new Date(r.created_at).toISOString(),
    })),
  };
}

export async function listProviderErrors() {
  const sql = await getSql();
  return sql<{
    id: string;
    provider: string;
    operation: string;
    http_status: number | null;
    customer_message: string;
    created_at: Date;
  }>`select id, provider, operation, http_status, customer_message, created_at
     from provider_errors order by created_at desc limit 100`;
}

export { PRODUCT, TX_STATUS_COPY };
