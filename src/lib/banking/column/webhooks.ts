import { requireColumnWebhookSecret } from "../env";
import { getSql } from "@/lib/db";
import { newId } from "../ids";
import { sha256 } from "../hash";
import { ColumnApiError } from "./client";
import { mapColumnAchStatus, mapColumnAchToTxStatus, mapColumnVerification } from "./status";
import { verifyColumnSignature } from "./signature";
import { classifyColumnEventType } from "./events";
import { syncColumnAccount } from "../sync";

export { computeColumnSignature, verifyColumnSignature } from "./signature";
export { classifyColumnEventType } from "./events";

type ColumnEvent = {
  id?: string;
  type?: string;
  data?: Record<string, unknown>;
};

type Row = Record<string, unknown>;

function eventIdOf(event: ColumnEvent, rawBody: string): string {
  if (event.id) return String(event.id);
  return `body_${sha256(rawBody).slice(0, 32)}`;
}

function nestedId(value: unknown, key: string): string {
  if (!value || typeof value !== "object") return "";
  const rec = value as Record<string, unknown>;
  return rec[key] ? String(rec[key]) : "";
}

async function applyEntityEvent(data: Record<string, unknown>) {
  const sql = await getSql();
  const entityId = String(data.id ?? data.entity_id ?? "");
  if (!entityId) return;
  const status = mapColumnVerification(String(data.verification_status ?? ""));
  await sql`update column_entities
    set verification_status = ${String(data.verification_status ?? "")},
        review_reasons = ${JSON.stringify(data.review_reasons ?? [])},
        last_synced_at = now(),
        updated_at = now()
    where provider_entity_id = ${entityId}`;
  await sql`update customer_profiles
    set kyc_status = ${status},
        provider_verification_status = ${String(data.verification_status ?? "")},
        updated_at = now()
    where provider_entity_id = ${entityId}`;
  await sql`update identity_verifications
    set status = ${status},
        provider_verification_status = ${String(data.verification_status ?? "")},
        updated_at = now()
    where provider_ref = ${entityId}`;
}

async function applyAccountEvent(data: Record<string, unknown>) {
  const sql = await getSql();
  const accountId = String(data.id ?? data.bank_account_id ?? "");
  if (!accountId) return;
  const status = String(data.status ?? "").toLowerCase();
  if (status) {
    await sql`update bank_accounts set status = ${status}, updated_at = now() where provider_account_id = ${accountId}`;
  }
  const balances = (data.balances ?? null) as
    | { available_amount?: number; pending_amount?: number; holding_amount?: number; locked_amount?: number }
    | null;
  if (balances) {
    const available = Number(balances.available_amount ?? 0);
    const pending = Number(balances.pending_amount ?? 0);
    const holding = Number(balances.holding_amount ?? 0);
    const locked = Number(balances.locked_amount ?? 0);
    await sql`update bank_account_balances b
      set available_cents = ${available},
          current_cents = ${available + pending + holding},
          pending_cents = ${pending},
          holding_cents = ${holding},
          locked_cents = ${locked},
          last_provider_sync_at = now(),
          updated_at = now()
      from bank_accounts a
      where b.account_id = a.id and a.provider_account_id = ${accountId}`;
  }
  const acc = await sql<Row>`select * from bank_accounts where provider_account_id = ${accountId} limit 1`;
  if (acc[0]) await syncColumnAccount(sql, acc[0]);
}

async function applyTransferEvent(data: Record<string, unknown>) {
  const sql = await getSql();
  const transferId = String(data.id ?? "");
  if (!transferId) return;
  const providerStatus = String(data.status ?? "");
  const status = mapColumnAchStatus(providerStatus);
  const txStatus = mapColumnAchToTxStatus(providerStatus);
  const incoming = Boolean(data.is_incoming);
  const amount = Math.abs(Number(data.amount ?? 0));
  const signed = incoming ? amount : -amount;
  const description = String(data.description ?? data.receiver_name ?? "ACH transfer");
  const bankAccountId =
    String(data.bank_account_id ?? "") ||
    nestedId(data.sender_internal_account, "bank_account_id") ||
    nestedId(data.receiver_internal_account, "bank_account_id");
  const posted = txStatus === "posted" ? new Date().toISOString() : null;
  const transferStatus =
    txStatus === "posted" ? "completed" : txStatus === "failed" ? "failed" : txStatus === "reversed" ? "returned" : "processing";

  const acc = bankAccountId
    ? await sql<Row>`select * from bank_accounts where provider_account_id = ${bankAccountId} limit 1`
    : [];

  const existingTransfer = await sql<Row>`select id from transfers where provider_transfer_id = ${transferId} limit 1`;
  if (existingTransfer[0]) {
    await sql`update transfers
      set status = ${transferStatus},
          provider_status = ${providerStatus},
          updated_at = now()
      where id = ${String(existingTransfer[0].id)}`;
  } else if (acc[0] && amount > 0) {
    await sql`insert into transfers (
        id, user_id, account_id, direction, method, amount_cents, status, counterparty_name,
        idempotency_key, provider, provider_transfer_id, provider_status
      ) values (
        ${newId("trf")}, ${String(acc[0].user_id)}, ${String(acc[0].id)}, ${incoming ? "inbound" : "outbound"},
        'ach', ${amount}, ${transferStatus}, ${description}, ${`column-trf:${transferId}`},
        'column', ${transferId}, ${providerStatus}
      )
      on conflict (idempotency_key) do update set
        status = excluded.status,
        provider_status = excluded.provider_status,
        provider_transfer_id = excluded.provider_transfer_id,
        updated_at = now()`;
  }

  const existingTx = await sql<Row>`select id from transactions where provider_transfer_id = ${transferId} limit 1`;
  if (existingTx[0]) {
    await sql`update transactions
      set status = ${txStatus},
          provider_status = ${providerStatus},
          posted_at = coalesce(posted_at, ${posted}),
          updated_at = now()
      where id = ${String(existingTx[0].id)}`;
  } else if (acc[0] && amount > 0) {
    await sql`insert into transactions (
        id, user_id, account_id, amount_cents, status, category, merchant, description,
        idempotency_key, provider, provider_transfer_id, provider_status, is_incoming, posted_at
      ) values (
        ${newId("txn")}, ${String(acc[0].user_id)}, ${String(acc[0].id)}, ${signed}, ${txStatus},
        'transfer', ${description}, ${description}, ${`column:${transferId}`}, 'column', ${transferId},
        ${providerStatus}, ${incoming}, ${posted}
      )
      on conflict (idempotency_key) do update set
        status = excluded.status,
        provider_status = excluded.provider_status,
        provider_transfer_id = excluded.provider_transfer_id,
        posted_at = coalesce(transactions.posted_at, excluded.posted_at),
        updated_at = now()`;
  }

  if (acc[0]) await syncColumnAccount(sql, acc[0]);
}

export async function handleColumnWebhook(input: {
  rawBody: string;
  signature: string | null;
  endpointId: string | null;
}): Promise<{ ok: true; duplicate?: boolean } | { ok: false; error: string; status: number }> {
  const secret = requireColumnWebhookSecret();
  if (!secret.ok) return secret;
  if (!verifyColumnSignature(input.rawBody, input.signature, secret.secret)) {
    return { ok: false, error: "Invalid signature.", status: 401 };
  }

  let event: ColumnEvent = {};
  try {
    event = JSON.parse(input.rawBody) as ColumnEvent;
  } catch {
    return { ok: false, error: "Invalid JSON.", status: 400 };
  }

  const providerEventId = eventIdOf(event, input.rawBody);
  const sql = await getSql();
  const existing = await sql<{ id: string; processing_status: string }>`
    select id, processing_status from webhook_events
    where provider = 'column' and provider_event_id = ${providerEventId}
    limit 1`;
  if (existing[0]?.processing_status === "processed") {
    return { ok: true, duplicate: true };
  }

  const rowId = existing[0]?.id ?? newId("whk");
  if (!existing[0]) {
    await sql`insert into webhook_events (
        id, provider, provider_event_id, event_type, payload, signature_valid, processing_status
      ) values (
        ${rowId}, 'column', ${providerEventId}, ${event.type ?? null}, ${input.rawBody}, true, 'received'
      )`;
  }

  try {
    const kind = classifyColumnEventType(event.type);
    const data = (event.data ?? {}) as Record<string, unknown>;
    if (kind === "identity") await applyEntityEvent(data);
    else if (kind === "account") await applyAccountEvent(data);
    else if (kind === "transfer") await applyTransferEvent(data);
    await sql`update webhook_events
      set processing_status = 'processed', processed_at = now(), processing_error = null
      where id = ${rowId}`;
    return { ok: true };
  } catch (err) {
    const message = err instanceof ColumnApiError ? err.customerMessage : err instanceof Error ? err.message : "Webhook processing failed.";
    await sql`update webhook_events
      set processing_status = 'failed', processing_error = ${message}
      where id = ${rowId}`;
    return { ok: false, error: "Webhook processing failed.", status: 500 };
  }
}
