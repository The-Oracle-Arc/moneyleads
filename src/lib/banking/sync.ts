import type { Sql } from "@/lib/db";
import { providers } from "./providers";
import { newId } from "./ids";
import { mapColumnAchToTxStatus } from "./column/status";
import { ColumnApiError } from "./column/client";
import type { ColumnUnifiedTransfer } from "./column/types";

type Row = Record<string, unknown>;

function asInt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
  }
  return 0;
}

export async function syncColumnAccount(
  sql: Sql,
  account: Row,
): Promise<{ error: string | null }> {
  const providerAccountId = account.provider_account_id ? String(account.provider_account_id) : "";
  if (!providerAccountId || !providers.columnBanking) return { error: null };
  try {
    const live = await providers.columnBanking.getAccount(providerAccountId);
    const local = await sql<Row>`
      select available_cents, current_cents from bank_account_balances
      where account_id = ${String(account.id)}
      limit 1`;
    if (local[0]) {
      const localAvailable = asInt(local[0].available_cents);
      const localCurrent = asInt(local[0].current_cents);
      if (localAvailable !== live.availableCents || localCurrent !== live.currentCents) {
        const open = await sql<Row>`
          select id from reconciliation_alerts
          where account_id = ${String(account.id)} and kind = 'balance_mismatch' and status = 'open'
          limit 1`;
        if (!open[0]) {
          await sql`insert into reconciliation_alerts (id, user_id, account_id, kind, detail, status)
            values (
              ${newId("rec")},
              ${String(account.user_id)},
              ${String(account.id)},
              'balance_mismatch',
              ${`Local available ${localAvailable} / current ${localCurrent} vs Column available ${live.availableCents} / current ${live.currentCents}`},
              'open'
            )`;
        }
      }
    }
    await sql`update bank_accounts
      set account_number = ${live.accountNumber},
          routing_number = ${live.routingNumber},
          provider_account_number_id = ${live.providerAccountNumberId},
          status = ${live.status},
          updated_at = now()
      where id = ${String(account.id)}`;
    await sql`update bank_account_balances
      set available_cents = ${live.availableCents},
          current_cents = ${live.currentCents},
          pending_cents = ${live.pendingCents},
          holding_cents = ${live.holdingCents},
          locked_cents = ${live.lockedCents},
          last_provider_sync_at = now(),
          updated_at = now()
      where account_id = ${String(account.id)}`;
    await upsertColumnTransfers(sql, {
      userId: String(account.user_id),
      accountId: String(account.id),
      providerAccountId,
    });
    return { error: null };
  } catch (err) {
    const message =
      err instanceof ColumnApiError ? err.customerMessage : "Could not refresh balances from the banking partner.";
    return { error: message };
  }
}

function signedAmount(row: ColumnUnifiedTransfer): number {
  const amount = Math.abs(asInt(row.amount));
  return row.is_incoming ? amount : -amount;
}

function merchantOf(row: ColumnUnifiedTransfer): string {
  if (row.description && row.description.trim()) return row.description.trim();
  if (row.type) return String(row.type).replaceAll("_", " ");
  return row.is_incoming ? "Incoming transfer" : "Outgoing transfer";
}

export async function upsertColumnTransfers(
  sql: Sql,
  p: { userId: string; accountId: string; providerAccountId: string },
) {
  if (!providers.columnBanking) return;
  const rows = await providers.columnBanking.listTransfers(p.providerAccountId);
  for (const row of rows) {
    if (!row.id) continue;
    const amount = signedAmount(row);
    const status = mapColumnAchToTxStatus(row.status);
    const merchant = merchantOf(row);
    const created = row.created_at ?? new Date().toISOString();
    const posted = status === "posted" ? (row.settled_at ?? row.completed_at ?? created) : null;
    const existing = await sql<Row>`select id from transactions where provider_transfer_id = ${row.id} limit 1`;
    if (existing[0]) {
      await sql`update transactions
        set amount_cents = ${amount},
            status = ${status},
            provider_status = ${row.status ?? null},
            description = ${merchant},
            posted_at = coalesce(${posted}, posted_at),
            occurred_at = coalesce(occurred_at, ${created}),
            updated_at = now()
        where id = ${String(existing[0].id)}`;
    } else {
      await sql`insert into transactions (
          id, user_id, account_id, amount_cents, status, category, merchant, description,
          idempotency_key, provider, provider_transfer_id, provider_status, is_incoming, created_at, posted_at, occurred_at
        ) values (
          ${newId("txn")}, ${p.userId}, ${p.accountId}, ${amount}, ${status}, 'transfer', ${merchant}, ${merchant},
          ${`column:${row.id}`}, 'column', ${row.id}, ${row.status ?? null}, ${Boolean(row.is_incoming)}, ${created}, ${posted}, ${created}
        )
        on conflict (idempotency_key) do nothing`;
    }
    const transferExisting = await sql<Row>`select id from transfers where provider_transfer_id = ${row.id} limit 1`;
    const transferStatus =
      status === "posted" ? "completed" : status === "failed" ? "failed" : status === "reversed" ? "returned" : "processing";
    if (!transferExisting[0]) {
      await sql`insert into transfers (
          id, user_id, account_id, direction, method, amount_cents, status, counterparty_name,
          idempotency_key, provider, provider_transfer_id, provider_status, created_at
        ) values (
          ${newId("trf")}, ${p.userId}, ${p.accountId}, ${row.is_incoming ? "inbound" : "outbound"}, 'ach', ${Math.abs(amount)},
          ${transferStatus}, ${merchant}, ${`column-trf:${row.id}`}, 'column', ${row.id}, ${row.status ?? null}, ${created}
        )
        on conflict (idempotency_key) do nothing`;
    } else {
      await sql`update transfers
        set status = ${transferStatus}, provider_status = ${row.status ?? null}, updated_at = now()
        where id = ${String(transferExisting[0].id)}`;
    }
  }
}
