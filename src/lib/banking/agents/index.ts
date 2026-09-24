/**
 * Independent MONEYLEAD agents. Deterministic tools over stored records.
 * An LLM is optional phrasing only. Agents never invent missing history,
 * never approve KYC, never move money, and never bypass authorization.
 */

import { getSql } from "@/lib/db";
import { newId } from "../ids";
import { runKycAgent, type KycAgentResult } from "../kyc-workflow";
import { analyzeHistory, type HistoryAnalysis } from "../historical";
import { formatUsd } from "../money";
import { publicBankingStatus } from "../env";
import { bankingProgramFromStatus } from "../program";
import { aiProviderStatus } from "@/lib/ai/provider";

export const AGENT_CATALOG = [
  { id: "kyc", name: "KYC Agent", audience: "Compliance", role: "Recommend identity completeness. Cannot approve Column verification." },
  { id: "historical", name: "Historical Analysis Agent", audience: "Finance / Ops", role: "Analyze stored records. Never invents missing years." },
  { id: "transaction", name: "Transaction Agent", audience: "Operations", role: "Summarize stored transactions and pending/failed counts." },
  { id: "risk", name: "Risk Agent", audience: "Risk", role: "Surface stored fraud alerts and disputes. Does not clear them." },
  { id: "support", name: "Support Agent", audience: "Support", role: "Summarize open cases from stored records." },
  { id: "compliance", name: "Compliance Agent", audience: "Compliance", role: "KYC queue and review-event counts from stored records." },
  { id: "statement", name: "Statement Agent", audience: "Finance", role: "Describe generated statements. Does not invent balances." },
  { id: "notification", name: "Notification Agent", audience: "Operations", role: "Unread and recent in-app notices. Email/SMS remain unconnected until configured." },
  { id: "system", name: "System Agent", audience: "Ultimate Admin", role: "Provider and environment health. Does not change configuration." },
] as const;

export type AgentId = (typeof AGENT_CATALOG)[number]["id"];

export type AgentRunResult = {
  agent: AgentId;
  summary: string;
  details: string[];
  recommendation?: string;
  data?: unknown;
};

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
  }
  return 0;
}

async function persistRun(agent: AgentId, actorUserId: string | null, subjectUserId: string | null, result: AgentRunResult) {
  const sql = await getSql();
  await sql`insert into agent_runs (id, agent, actor_user_id, subject_user_id, status, summary, findings)
    values (${newId("agn")}, ${agent}, ${actorUserId}, ${subjectUserId}, 'completed', ${result.summary}, ${JSON.stringify(result)})`;
}

export async function listAgentRuns(limit = 40) {
  const sql = await getSql();
  try {
    const rows = await sql<{
      id: string;
      agent: string;
      summary: string;
      created_at: Date;
      subject_user_id: string | null;
    }>`select id, agent, summary, created_at, subject_user_id from agent_runs order by created_at desc limit ${limit}`;
    return rows.map((r) => ({
      id: r.id,
      agent: r.agent,
      summary: r.summary,
      createdAt: new Date(r.created_at).toISOString(),
      subjectUserId: r.subject_user_id,
    }));
  } catch {
    return [];
  }
}

async function runTransactionAgent(userId?: string): Promise<AgentRunResult> {
  const sql = await getSql();
  const scope = userId
    ? await sql<{ c: number; pending: number; failed: number; posted: number }>`
        select count(*)::int as c,
          count(*) filter (where status in ('pending','processing'))::int as pending,
          count(*) filter (where status = 'failed')::int as failed,
          count(*) filter (where status in ('posted','completed'))::int as posted
        from transactions where user_id = ${userId} and is_demonstration = false`
    : await sql<{ c: number; pending: number; failed: number; posted: number }>`
        select count(*)::int as c,
          count(*) filter (where status in ('pending','processing'))::int as pending,
          count(*) filter (where status = 'failed')::int as failed,
          count(*) filter (where status in ('posted','completed'))::int as posted
        from transactions where is_demonstration = false`;
  const r = scope[0];
  const details = [
    `${num(r?.c)} stored transactions.`,
    `${num(r?.posted)} posted or completed.`,
    `${num(r?.pending)} pending or processing.`,
    `${num(r?.failed)} failed.`,
    "Statuses are the stored values. Failed records are not rewritten as successful.",
  ];
  return {
    agent: "transaction",
    summary: `${num(r?.c)} stored transactions. ${num(r?.failed)} failed remain failed.`,
    details,
  };
}

async function runRiskAgent(): Promise<AgentRunResult> {
  const sql = await getSql();
  const fraud = await sql<{ c: number }>`select count(*)::int as c from fraud_alerts where status = 'open'`;
  const disputes = await sql<{ c: number }>`select count(*)::int as c from disputes where status = 'open'`;
  const failed = await sql<{ c: number }>`select count(*)::int as c from transfers where status = 'failed'`;
  return {
    agent: "risk",
    summary: `${num(fraud[0]?.c)} open fraud alerts, ${num(disputes[0]?.c)} open disputes, ${num(failed[0]?.c)} failed transfers.`,
    details: [
      "Open alerts require an authorized risk or operations decision.",
      "This agent does not clear alerts or invent new ones.",
    ],
    data: { openFraud: num(fraud[0]?.c), openDisputes: num(disputes[0]?.c), failedTransfers: num(failed[0]?.c) },
  };
}

async function runSupportAgent(): Promise<AgentRunResult> {
  const sql = await getSql();
  const open = await sql<{ c: number }>`select count(*)::int as c from support_cases where status in ('open','pending')`;
  const recent = await sql<{ subject: string; status: string }>`
    select subject, status from support_cases order by created_at desc limit 5`;
  return {
    agent: "support",
    summary: `${num(open[0]?.c)} unresolved support cases.`,
    details: recent.length
      ? recent.map((r) => `${r.status}: ${r.subject}`)
      : ["No support cases are stored."],
  };
}

async function runComplianceAgent(): Promise<AgentRunResult> {
  const sql = await getSql();
  const pending = await sql<{ c: number }>`
    select count(*)::int as c from identity_verifications
    where coalesce(workflow_status, status) not in ('APPROVED','REJECTED','approved','failed')`;
  const events = await sql<{ c: number }>`select count(*)::int as c from kyc_events`;
  return {
    agent: "compliance",
    summary: `${num(pending[0]?.c)} identity records are not in a terminal review state.`,
    details: [
      `${num(events[0]?.c)} KYC review events are stored.`,
      "Column remains the banking-partner source of truth for identity used to open accounts.",
    ],
  };
}

async function runStatementAgent(userId?: string): Promise<AgentRunResult> {
  const sql = await getSql();
  const rows = userId
    ? await sql<{ c: number }>`select count(*)::int as c from statements where user_id = ${userId}`
    : await sql<{ c: number }>`select count(*)::int as c from statements`;
  return {
    agent: "statement",
    summary: `${num(rows[0]?.c)} generated statements of account are stored.`,
    details: [
      "Statements are built from stored transactions and historical records.",
      "Original source dates are preserved. This agent does not invent line items.",
    ],
  };
}

async function runNotificationAgent(): Promise<AgentRunResult> {
  const sql = await getSql();
  const unread = await sql<{ c: number }>`select count(*)::int as c from notifications where read_at is null`;
  return {
    agent: "notification",
    summary: `${num(unread[0]?.c)} unread in-app notices.`,
    details: [
      "Email and SMS remain unconnected until a messenger is configured.",
      "This agent does not send messages itself.",
    ],
  };
}

function runSystemAgent(): AgentRunResult {
  const banking = publicBankingStatus();
  const program = bankingProgramFromStatus(banking);
  const ai = aiProviderStatus();
  return {
    agent: "system",
    summary: `${program.title}: ${program.programStatus}. Software remains production-ready independent of the banking-program relationship.`,
    details: [
      `Banking environment: ${program.environmentLabel}.`,
      `Column configured: ${banking.configured ? "yes" : "no"}.`,
      `Language provider: ${ai.configured ? ai.label : "not configured"}.`,
      program.productionNote,
    ],
  };
}

export async function runAgent(
  agent: AgentId,
  opts: { actorUserId: string; subjectUserId?: string; kycInput?: Parameters<typeof runKycAgent>[0] },
): Promise<AgentRunResult> {
  let result: AgentRunResult;
  if (agent === "kyc") {
    if (!opts.kycInput && opts.subjectUserId) {
      const sql = await getSql();
      const p = (await sql<Record<string, unknown>>`select * from customer_profiles where user_id = ${opts.subjectUserId} limit 1`)[0];
      const a = (await sql<Record<string, unknown>>`select * from addresses where user_id = ${opts.subjectUserId} order by created_at desc limit 1`)[0];
      const k = (await sql<Record<string, unknown>>`select * from identity_verifications where user_id = ${opts.subjectUserId} order by created_at desc limit 1`)[0];
      const rec: KycAgentResult = runKycAgent({
        legalFirstName: p?.legal_first_name ? String(p.legal_first_name) : null,
        legalLastName: p?.legal_last_name ? String(p.legal_last_name) : null,
        dob: p?.dob ? String(p.dob).slice(0, 10) : null,
        addressLine1: a?.line1 ? String(a.line1) : null,
        city: a?.city ? String(a.city) : null,
        state: a?.state ? String(a.state) : null,
        postalCode: a?.postal_code ? String(a.postal_code) : null,
        documentType: k?.document_type ? String(k.document_type) : null,
        partnerStatus: p?.kyc_status ? String(p.kyc_status) : null,
        deadlinePassed: false,
        autoApprovalEnabled: false,
      });
      result = {
        agent: "kyc",
        summary: rec.reason,
        details: [`Recommendation: ${rec.recommendation}.`, `Workflow: ${rec.workflow}.`, "This does not change Column verification."],
        recommendation: rec.recommendation,
        data: rec,
      };
    } else if (opts.kycInput) {
      const rec = runKycAgent(opts.kycInput);
      result = {
        agent: "kyc",
        summary: rec.reason,
        details: [`Recommendation: ${rec.recommendation}.`, "This does not change Column verification."],
        recommendation: rec.recommendation,
        data: rec,
      };
    } else {
      result = await runComplianceAgent();
      result = { ...result, agent: "kyc" };
    }
  } else if (agent === "historical") {
    if (!opts.subjectUserId) {
      result = {
        agent: "historical",
        summary: "Select a customer. The historical agent only analyzes stored records for that person.",
        details: ["It will not invent missing years or counterparties."],
      };
    } else {
      const analysis: HistoryAnalysis = await analyzeHistory(opts.subjectUserId);
      result = {
        agent: "historical",
        summary: analysis.summary,
        details: [
          ...analysis.notes,
          ...analysis.yearly.map((y) => `${y.year}: ${y.count} txs · credits ${formatUsd(y.creditsCents)} · debits ${formatUsd(y.debitsCents)}`),
        ],
        data: analysis,
      };
    }
  } else if (agent === "transaction") result = await runTransactionAgent(opts.subjectUserId);
  else if (agent === "risk") result = await runRiskAgent();
  else if (agent === "support") result = await runSupportAgent();
  else if (agent === "compliance") result = await runComplianceAgent();
  else if (agent === "statement") result = await runStatementAgent(opts.subjectUserId);
  else if (agent === "notification") result = await runNotificationAgent();
  else result = runSystemAgent();

  try {
    await persistRun(agent, opts.actorUserId, opts.subjectUserId ?? null, result);
  } catch {
    /* agent_runs added in 0008 */
  }
  return result;
}
