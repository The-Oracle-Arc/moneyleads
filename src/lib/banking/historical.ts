/**
 * Date-preserving historical ledger.
 * Source occurred-at is immutable. MONEYLEAD never rewrites old dates to today
 * and never invents missing counterparties, amounts, or events.
 */

import { getSql, type Sql } from "@/lib/db";
import { newId } from "./ids";
import type { StaffRole } from "./types";
import { parseSourceOccurredAt } from "./historical-date";
export { parseSourceOccurredAt };

export type HistoricalKind =
  | "transaction"
  | "transfer"
  | "account_event"
  | "kyc_event"
  | "support_event"
  | "statement"
  | "other";

export type HistoricalRecord = {
  id: string;
  userId: string | null;
  sourceName: string;
  kind: HistoricalKind;
  sourceOccurredAt: string;
  ingestedAt: string;
  amountCents: number | null;
  description: string;
  counterparty: string | null;
  reference: string | null;
  status: string;
  supersededBy: string | null;
};

export type HistoricalIngestInput = {
  userId?: string | null;
  moneyleadUserId?: string | null;
  sourceName: string;
  kind: HistoricalKind;
  sourceOccurredAt: string;
  amountCents?: number | null;
  description: string;
  counterparty?: string | null;
  reference?: string | null;
  originalPayload?: string | null;
};

const KINDS = new Set<HistoricalKind>([
  "transaction",
  "transfer",
  "account_event",
  "kyc_event",
  "support_event",
  "statement",
  "other",
]);

const INGEST_ROLES: StaffRole[] = ["ops", "finance", "admin", "ultimate_admin", "compliance", "risk"];
const CORRECT_ROLES: StaffRole[] = ["ops", "finance", "admin", "ultimate_admin", "compliance"];

function iso(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string" && v !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
  }
  return 0;
}

function bool(v: unknown): boolean {
  return v === true || v === "t" || v === "true";
}

function dateOnly(isoStr: string): string {
  return isoStr.slice(0, 10);
}

async function audit(
  sql: Sql,
  p: { actorUserId: string; actorRole: string; action: string; entityId: string; metadata?: unknown },
) {
  await sql`insert into audit_logs (id, actor_user_id, actor_role, action, entity_type, entity_id, metadata)
    values (${newId("aud")}, ${p.actorUserId}, ${p.actorRole}, ${p.action}, 'historical_record', ${p.entityId}, ${p.metadata ? JSON.stringify(p.metadata) : null})`;
}

function mapRecord(row: Record<string, unknown>): HistoricalRecord {
  return {
    id: String(row.id),
    userId: row.user_id ? String(row.user_id) : null,
    sourceName: String(row.source_name),
    kind: String(row.kind) as HistoricalKind,
    sourceOccurredAt: iso(row.source_occurred_at) ?? "",
    ingestedAt: iso(row.ingested_at) ?? "",
    amountCents: row.amount_cents == null ? null : num(row.amount_cents),
    description: String(row.description),
    counterparty: row.counterparty ? String(row.counterparty) : null,
    reference: row.reference ? String(row.reference) : null,
    status: String(row.status),
    supersededBy: row.superseded_by ? String(row.superseded_by) : null,
  };
}

async function resolveUserId(sql: Sql, input: HistoricalIngestInput): Promise<string | null> {
  if (input.userId) {
    const rows = await sql<{ user_id: string }>`select user_id from customer_profiles where user_id = ${input.userId} or id = ${input.userId} limit 1`;
    return rows[0]?.user_id ?? null;
  }
  if (input.moneyleadUserId) {
    const ml = input.moneyleadUserId.trim().toUpperCase();
    const rows = await sql<{ user_id: string }>`select user_id from customer_profiles where moneylead_user_id = ${ml} limit 1`;
    return rows[0]?.user_id ?? null;
  }
  return null;
}

export async function ingestHistoricalRecord(
  actorId: string,
  actorRole: StaffRole,
  input: HistoricalIngestInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!INGEST_ROLES.includes(actorRole)) {
    return { ok: false, error: "Your role cannot ingest historical records." };
  }
  const sourceName = input.sourceName.trim();
  const description = input.description.trim();
  if (!sourceName) return { ok: false, error: "A source name is required." };
  if (!description) return { ok: false, error: "A description from the source is required. Nothing is invented here." };
  if (!KINDS.has(input.kind)) return { ok: false, error: "Unknown historical record kind." };
  const occurred = parseSourceOccurredAt(input.sourceOccurredAt);
  if (!occurred.ok) return occurred;
  if (input.amountCents != null && (!Number.isFinite(input.amountCents) || Math.abs(input.amountCents) > 1_000_000_000_00)) {
    return { ok: false, error: "Amount is out of range." };
  }
  const sql = await getSql();
  const userId = await resolveUserId(sql, input);
  if ((input.userId || input.moneyleadUserId) && !userId) {
    return { ok: false, error: "That customer was not found. Historical records are not attached to invented people." };
  }
  const id = newId("hst");
  const sourceId = newId("hso");
  await sql`insert into historical_sources (id, name, kind, notes)
    values (${sourceId}, ${sourceName}, ${input.kind}, ${"Staff ingest. Source date preserved."})`;
  await sql`insert into historical_records (
      id, user_id, source_id, source_name, kind, source_occurred_at, amount_cents, description, counterparty, reference, status, original_payload
    ) values (
      ${id}, ${userId}, ${sourceId}, ${sourceName}, ${input.kind}, ${occurred.iso}, ${input.amountCents ?? null},
      ${description}, ${input.counterparty?.trim() || null}, ${input.reference?.trim() || null}, 'ingested',
      ${input.originalPayload?.slice(0, 8000) || null}
    )`;
  await audit(sql, {
    actorUserId: actorId,
    actorRole,
    action: "historical.ingest",
    entityId: id,
    metadata: { sourceOccurredAt: occurred.iso, kind: input.kind, userId },
  });
  return { ok: true, id };
}

export async function correctHistoricalRecord(
  actorId: string,
  actorRole: StaffRole,
  input: { originalId: string; reason: string; description?: string; amountCents?: number | null; counterparty?: string | null },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!CORRECT_ROLES.includes(actorRole)) {
    return { ok: false, error: "Your role cannot correct historical records." };
  }
  const reason = input.reason.trim();
  if (!reason) return { ok: false, error: "A correction reason is required. The original record is always retained." };
  const sql = await getSql();
  const original = await sql<Record<string, unknown>>`select * from historical_records where id = ${input.originalId} limit 1`;
  if (!original[0]) return { ok: false, error: "Original record not found." };
  const row = original[0];
  const id = newId("hst");
  const description = (input.description?.trim() || String(row.description)).slice(0, 500);
  const amount = input.amountCents === undefined ? (row.amount_cents == null ? null : num(row.amount_cents)) : input.amountCents;
  const counterparty =
    input.counterparty === undefined ? (row.counterparty ? String(row.counterparty) : null) : input.counterparty?.trim() || null;
  await sql`insert into historical_records (
      id, user_id, source_id, source_name, kind, source_occurred_at, amount_cents, description, counterparty, reference, status, original_payload
    ) values (
      ${id}, ${row.user_id ? String(row.user_id) : null}, ${row.source_id ? String(row.source_id) : null}, ${String(row.source_name)},
      ${String(row.kind)}, ${iso(row.source_occurred_at)}, ${amount}, ${description}, ${counterparty},
      ${row.reference ? String(row.reference) : null}, 'corrected', ${row.original_payload ? String(row.original_payload) : null}
    )`;
  await sql`update historical_records set superseded_by = ${id}, status = 'superseded' where id = ${input.originalId}`;
  await sql`insert into historical_corrections (id, original_id, corrected_id, actor_user_id, actor_role, reason)
    values (${newId("hcr")}, ${input.originalId}, ${id}, ${actorId}, ${actorRole}, ${reason})`;
  await audit(sql, {
    actorUserId: actorId,
    actorRole,
    action: "historical.correct",
    entityId: id,
    metadata: { originalId: input.originalId, reason, sourceOccurredAt: iso(row.source_occurred_at) },
  });
  return { ok: true, id };
}

export async function listHistoricalRecords(opts?: {
  userId?: string;
  query?: string;
  from?: string;
  to?: string;
}): Promise<HistoricalRecord[]> {
  const sql = await getSql();
  const rows = await sql<Record<string, unknown>>`
    select * from historical_records
    order by source_occurred_at desc, ingested_at desc
    limit 200`;
  let list = rows.map(mapRecord);
  if (opts?.userId) list = list.filter((r) => r.userId === opts.userId);
  if (opts?.from) list = list.filter((r) => dateOnly(r.sourceOccurredAt) >= opts.from!);
  if (opts?.to) list = list.filter((r) => dateOnly(r.sourceOccurredAt) <= opts.to!);
  if (opts?.query) {
    const q = opts.query.toLowerCase();
    list = list.filter(
      (r) =>
        r.description.toLowerCase().includes(q) ||
        (r.counterparty ?? "").toLowerCase().includes(q) ||
        r.sourceName.toLowerCase().includes(q) ||
        (r.reference ?? "").toLowerCase().includes(q),
    );
  }
  return list;
}

export type HistoryAnalysis = {
  agent: "historical";
  summary: string;
  yearsCovered: string[];
  recordCount: number;
  transactionCount: number;
  transferCount: number;
  kycEventCount: number;
  supportCount: number;
  historicalRecordCount: number;
  duplicateGroups: { key: string; count: number }[];
  statusMismatches: { transferId: string; transferStatus: string; txStatus: string | null }[];
  yearly: { year: string; creditsCents: number; debitsCents: number; count: number }[];
  monthly: { month: string; creditsCents: number; debitsCents: number; count: number }[];
  notes: string[];
};

export async function analyzeHistory(userId: string): Promise<HistoryAnalysis> {
  const sql = await getSql();
  const txs = await sql<Record<string, unknown>>`
    select id, amount_cents, merchant, status, created_at, posted_at, occurred_at, is_demonstration
    from transactions where user_id = ${userId}`;
  const transfers = await sql<Record<string, unknown>>`
    select id, status, amount_cents, created_at from transfers where user_id = ${userId}`;
  let kyc: Record<string, unknown>[] = [];
  let support: Record<string, unknown>[] = [];
  let historical: Record<string, unknown>[] = [];
  try {
    kyc = await sql<Record<string, unknown>>`select id, created_at from kyc_events where user_id = ${userId}`;
  } catch {
    kyc = [];
  }
  try {
    support = await sql<Record<string, unknown>>`select id, created_at from support_cases where user_id = ${userId}`;
  } catch {
    support = [];
  }
  try {
    historical = await sql<Record<string, unknown>>`
      select * from historical_records where user_id = ${userId} and superseded_by is null`;
  } catch {
    historical = [];
  }

  const realTxs = txs.filter((t) => !bool(t.is_demonstration));
  const dateOf = (row: Record<string, unknown>) =>
    dateOnly(iso(row.occurred_at) ?? iso(row.posted_at) ?? iso(row.created_at) ?? iso(row.source_occurred_at) ?? "");

  const years = new Set<string>();
  const yearly = new Map<string, { creditsCents: number; debitsCents: number; count: number }>();
  const monthly = new Map<string, { creditsCents: number; debitsCents: number; count: number }>();
  const dupMap = new Map<string, number>();

  for (const t of realTxs) {
    const day = dateOf(t);
    if (!day) continue;
    const year = day.slice(0, 4);
    const month = day.slice(0, 7);
    years.add(year);
    const amount = num(t.amount_cents);
    const y = yearly.get(year) ?? { creditsCents: 0, debitsCents: 0, count: 0 };
    y.count += 1;
    if (amount > 0) y.creditsCents += amount;
    else y.debitsCents += Math.abs(amount);
    yearly.set(year, y);
    const m = monthly.get(month) ?? { creditsCents: 0, debitsCents: 0, count: 0 };
    m.count += 1;
    if (amount > 0) m.creditsCents += amount;
    else m.debitsCents += Math.abs(amount);
    monthly.set(month, m);
    const key = `${day}|${amount}|${String(t.merchant ?? "")}`;
    dupMap.set(key, (dupMap.get(key) ?? 0) + 1);
  }

  for (const h of historical) {
    const day = dateOnly(iso(h.source_occurred_at) ?? "");
    if (day) years.add(day.slice(0, 4));
  }

  const duplicateGroups = [...dupMap.entries()]
    .filter(([, count]) => count > 1)
    .map(([key, count]) => ({ key, count }))
    .slice(0, 20);

  const statusMismatches: HistoryAnalysis["statusMismatches"] = [];
  for (const tr of transfers) {
    const id = String(tr.id);
    const matching = realTxs.find((t) => String(t.id) === id);
    if (matching && String(matching.status) !== String(tr.status)) {
      statusMismatches.push({
        transferId: id,
        transferStatus: String(tr.status),
        txStatus: String(matching.status),
      });
    }
  }

  const notes: string[] = [];
  if (realTxs.length === 0 && historical.length === 0) {
    notes.push("No stored transactions or historical records for this customer. Missing years are not filled in.");
  } else {
    notes.push("Only stored source records are included. Gaps mean no record was stored, not that activity is invented.");
  }
  if (duplicateGroups.length) {
    notes.push(
      `${duplicateGroups.length} possible duplicate groups (same date, amount, and merchant) were found in stored transactions.`,
    );
  }
  if (statusMismatches.length) {
    notes.push(`${statusMismatches.length} transfer/transaction status mismatches were found in stored records.`);
  }

  const yearList = [...years].sort();
  const summary =
    yearList.length === 0
      ? "No dated source records are on file. The agent will not reconstruct missing history."
      : `Stored activity covers ${yearList[0]}–${yearList[yearList.length - 1]} across ${realTxs.length} transactions and ${historical.length} historical records.`;

  return {
    agent: "historical",
    summary,
    yearsCovered: yearList,
    recordCount: realTxs.length + historical.length + kyc.length + support.length,
    transactionCount: realTxs.length,
    transferCount: transfers.length,
    kycEventCount: kyc.length,
    supportCount: support.length,
    historicalRecordCount: historical.length,
    duplicateGroups,
    statusMismatches: statusMismatches.slice(0, 20),
    yearly: [...yearly.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, v]) => ({ year, ...v })),
    monthly: [...monthly.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-24)
      .map(([month, v]) => ({ month, ...v })),
    notes,
  };
}
