import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import * as engine from "./engine";
import {
  listManualReviews,
  listProviderErrors,
  productConfig,
  systemHealth,
  updateProductConfig,
} from "./control-plane";

function jsonRow(row: Record<string, unknown>): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v instanceof Date) out[k] = v.toISOString();
    else if (typeof v === "bigint") out[k] = Number(v);
    else if (v == null) out[k] = null;
    else if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[k] = v;
    else out[k] = String(v);
  }
  return out;
}

export const adminOverviewFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await engine.requireStaff(context.userId);
    return engine.adminOverview();
  });

export const adminListFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { resource: string; query?: string; status?: string }) => input)
  .handler(async ({ context, data }) => {
    await engine.requireStaff(context.userId);
    const rows = await engine.adminList(data.resource, { query: data.query, status: data.status });
    return rows.map((row) => jsonRow(row as Record<string, unknown>));
  });

export const adminCustomerFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => input)
  .handler(async ({ context, data }) => {
    await engine.requireStaff(context.userId);
    const raw = await engine.adminCustomer(data.id);
    if (!raw) return null;
    return {
      profile: jsonRow(raw.profile),
      addresses: raw.addresses.map(jsonRow),
      accounts: raw.accounts.map(jsonRow),
      kyc: raw.kyc.map(jsonRow),
      transfers: raw.transfers.map(jsonRow),
      transactions: raw.transactions.map(jsonRow),
      support: raw.support.map(jsonRow),
      fraud: raw.fraud.map(jsonRow),
      notes: raw.notes.map(jsonRow),
      creditApps: raw.creditApps.map(jsonRow),
    };
  });

export const adminActFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { action: string; entityId: string; note?: string }) => input)
  .handler(async ({ context, data }) => {
    const role = await engine.requireStaff(context.userId);
    return engine.adminAct(context.userId, role, data);
  });

export const adminSettingsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await engine.requireStaff(context.userId);
    return engine.adminSettings();
  });

export const adminHealthFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await engine.requireStaff(context.userId);
    return systemHealth();
  });

export const adminReviewsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await engine.requireStaff(context.userId);
    return listManualReviews();
  });

export const adminConfigFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await engine.requireStaff(context.userId);
    return productConfig();
  });

export const adminUpdateConfigFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { key: string; value: string }) => input)
  .handler(async ({ context, data }) => {
    const role = await engine.requireStaff(context.userId);
    try {
      return await updateProductConfig({ kind: "staff", userId: context.userId, role }, data.key, data.value);
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : "Not allowed." };
    }
  });

export const adminErrorsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await engine.requireStaff(context.userId);
    const rows = await listProviderErrors();
    return rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      operation: r.operation,
      httpStatus: r.http_status,
      message: r.customer_message,
      createdAt: new Date(r.created_at).toISOString(),
    }));
  });

export const adminFlagsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await engine.requireStaff(context.userId);
    return engine.adminFlags();
  });

export const adminBankingFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await engine.requireStaff(context.userId);
    return engine.adminBankingProgram();
  });

export const adminAiFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await engine.requireStaff(context.userId);
    return engine.adminAiStatus();
  });

export const adminStaffFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await engine.requireStaff(context.userId);
    return engine.adminSettings();
  });

export const adminKycQueueFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await engine.requireStaff(context.userId);
    return engine.adminKycQueue();
  });

export const adminIntegrationsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await engine.requireStaff(context.userId);
    return engine.adminIntegrations();
  });
export const adminSupportThreadFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => input)
  .handler(async ({ context, data }) => {
    await engine.requireStaff(context.userId);
    return engine.adminSupportThread(data.id);
  });

export const adminHistoryListFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input?: { query?: string; userId?: string }) => input ?? {})
  .handler(async ({ context, data }) => {
    await engine.requireStaff(context.userId);
    const { listHistoricalRecords } = await import("./historical");
    return listHistoricalRecords({ query: data.query, userId: data.userId });
  });

export const adminHistoryIngestFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      moneyleadUserId?: string;
      userId?: string;
      sourceName: string;
      kind: "transaction" | "transfer" | "account_event" | "kyc_event" | "support_event" | "statement" | "other";
      sourceOccurredAt: string;
      amountCents?: number | null;
      description: string;
      counterparty?: string;
      reference?: string;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const role = await engine.requireStaff(context.userId);
    const { ingestHistoricalRecord } = await import("./historical");
    return ingestHistoricalRecord(context.userId, role, data);
  });

export const adminHistoryCorrectFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { originalId: string; reason: string; description?: string }) => input)
  .handler(async ({ context, data }) => {
    const role = await engine.requireStaff(context.userId);
    const { correctHistoricalRecord } = await import("./historical");
    return correctHistoricalRecord(context.userId, role, data);
  });

export const adminHistoryAnalyzeFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { userId: string }) => input)
  .handler(async ({ context, data }) => {
    await engine.requireStaff(context.userId);
    const { analyzeHistory } = await import("./historical");
    return analyzeHistory(data.userId);
  });

export const adminAgentsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await engine.requireStaff(context.userId);
    const { AGENT_CATALOG, listAgentRuns } = await import("./agents");
    return { catalog: AGENT_CATALOG, runs: await listAgentRuns() };
  });

export const adminRunAgentFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { agent: string; subjectUserId?: string }) => input)
  .handler(async ({ context, data }) => {
    await engine.requireStaff(context.userId);
    const { runAgent, AGENT_CATALOG } = await import("./agents");
    const id = AGENT_CATALOG.find((a) => a.id === data.agent)?.id;
    if (!id) return { ok: false as const, error: "Unknown agent." };
    const result = await runAgent(id, { actorUserId: context.userId, subjectUserId: data.subjectUserId });
    return {
      ok: true as const,
      result: {
        agent: result.agent,
        summary: result.summary,
        details: result.details,
        recommendation: result.recommendation ?? null,
      },
    };
  });

export const adminSecurityFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await engine.requireStaff(context.userId);
    const sql = await engine.db();
    const sessions = await sql<{ c: number }>`select count(*)::int as c from app_sessions where revoked_at is null`;
    let failed = [{ c: 0 }];
    try {
      failed = await sql<{ c: number }>`select count(*)::int as c from failed_logins where created_at > now() - interval '24 hours'`;
    } catch {
      failed = [{ c: 0 }];
    }
    let webauthn = 0;
    try {
      const rows = await sql<{ c: number }>`select count(*)::int as c from webauthn_credentials`;
      webauthn = Number(rows[0]?.c ?? 0);
    } catch {
      webauthn = 0;
    }
    return {
      lockMinutes: 2,
      activeSessions: Number(sessions[0]?.c ?? 0),
      failedLogins24h: Number(failed[0]?.c ?? 0),
      webauthnCredentials: webauthn,
      note: "Session lock is two minutes of inactivity with passcode or device authenticator. Device prompts are real. Server-side WebAuthn stores credential identifiers for in-app unlock.",
    };
  });

export const adminStatementsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await engine.requireStaff(context.userId);
    const sql = await engine.db();
    const rows = await sql<Record<string, unknown>>`
       select s.id, s.user_id, s.period_start, s.period_end, s.opening_cents, s.closing_cents, p.moneylead_user_id, p.legal_first_name, p.legal_last_name
       from statements s left join customer_profiles p on p.user_id = s.user_id
       order by s.period_end desc limit 80`;
    return rows.map((row) => ({
      id: String(row.id),
      userId: String(row.user_id),
      moneyleadUserId: row.moneylead_user_id ? String(row.moneylead_user_id) : null,
      name: [row.legal_first_name, row.legal_last_name].filter(Boolean).join(" ") || "Customer",
      periodStart: String(row.period_start).slice(0, 10),
      periodEnd: String(row.period_end).slice(0, 10),
      openingCents: Number(row.opening_cents ?? 0),
      closingCents: Number(row.closing_cents ?? 0),
    }));
  });

