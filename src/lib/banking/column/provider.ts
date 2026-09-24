import type { ColumnClient } from "./client";
import type {
  ColumnAchList,
  ColumnAchTransfer,
  ColumnBankAccount,
  ColumnCounterparty,
  ColumnEntity,
  ColumnListTransfers,
  ColumnUnifiedTransfer,
} from "./types";
import { mapColumnAccountStatus, mapColumnAchStatus, mapColumnVerification } from "./status.ts";
import type { KycProvider, BankingProvider, PaymentProvider, CardProvider, CreditProvider } from "../providers";

export type PersonIdentityInput = {
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  email?: string | null;
  phoneE164?: string | null;
  ssn: string;
  citizenship?: string | null;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    countryCode?: string;
  };
};

export type ColumnEntityView = {
  entityId: string;
  verificationStatus: ReturnType<typeof mapColumnVerification>;
  providerStatus: string;
  reviewReasons: string[];
  name: string;
};

export type ColumnAccountView = {
  providerAccountId: string;
  providerAccountNumberId: string;
  accountNumber: string;
  routingNumber: string;
  status: "pending" | "open" | "frozen" | "closed";
  availableCents: number;
  currentCents: number;
  holdingCents: number;
  pendingCents: number;
  lockedCents: number;
  currency: string;
};

function asInt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
  }
  return 0;
}

function toEntityView(entity: ColumnEntity): ColumnEntityView {
  return {
    entityId: entity.id,
    verificationStatus: mapColumnVerification(entity.verification_status),
    providerStatus: entity.verification_status ?? "UNVERIFIED",
    reviewReasons: entity.review_reasons ?? [],
    name: entity.name ?? "",
  };
}

function toAccountView(account: ColumnBankAccount): ColumnAccountView {
  const available = asInt(account.balances?.available_amount);
  const pending = asInt(account.balances?.pending_amount);
  const holding = asInt(account.balances?.holding_amount);
  const locked = asInt(account.balances?.locked_amount);
  return {
    providerAccountId: account.id,
    providerAccountNumberId: account.default_account_number_id,
    accountNumber: account.default_account_number,
    routingNumber: account.routing_number,
    status: mapColumnAccountStatus(account.status),
    availableCents: available,
    currentCents: available + pending + holding,
    holdingCents: holding,
    pendingCents: pending,
    lockedCents: locked,
    currency: account.currency_code ?? "USD",
  };
}

export class ColumnKycProvider implements KycProvider {
  readonly name = "column";
  private readonly client: ColumnClient;
  constructor(client: ColumnClient) {
    this.client = client;
  }

  async start() {
    return { providerRef: "", status: "processing" as const };
  }
  async submitDocument() {
    return { status: "processing" as const };
  }
  async submitSelfie() {
    return { status: "manual_review" as const, reason: "Identity status comes from Column, not a local selfie check." };
  }

  async createPerson(input: PersonIdentityInput, idempotencyKey: string): Promise<ColumnEntityView> {
    const body: Record<string, unknown> = {
      first_name: input.firstName,
      last_name: input.lastName,
      date_of_birth: input.dateOfBirth,
      ssn: input.ssn,
      address: {
        line_1: input.address.line1,
        line_2: input.address.line2 || undefined,
        city: input.address.city,
        state: input.address.state,
        postal_code: input.address.postalCode,
        country_code: input.address.countryCode || "US",
      },
    };
    if (input.middleName) body.middle_name = input.middleName;
    if (input.email) body.email = input.email;
    if (input.phoneE164) body.phone_number = input.phoneE164;
    if (input.citizenship && input.citizenship.length === 2) body.country_of_citizenship = input.citizenship.toUpperCase();
    const entity = await this.client.request<ColumnEntity>("/entities/person", {
      method: "POST",
      body,
      idempotencyKey,
    });
    return toEntityView(entity);
  }

  async getPerson(entityId: string): Promise<ColumnEntityView> {
    const entity = await this.client.request<ColumnEntity>(`/entities/${entityId}`);
    return toEntityView(entity);
  }
}

export class ColumnBankingProvider implements BankingProvider {
  readonly name = "column";
  private readonly client: ColumnClient;
  constructor(client: ColumnClient) {
    this.client = client;
  }

  async openChecking() {
    return {
      status: "unable_to_verify" as const,
      accountNumber: "",
      routingNumber: "",
      reason: "Open checking through Column with a verified entity id.",
    };
  }

  async openCheckingAccount(input: {
    entityId: string;
    description: string;
    idempotencyKey: string;
  }): Promise<ColumnAccountView> {
    const account = await this.client.request<ColumnBankAccount>("/bank-accounts", {
      method: "POST",
      body: {
        entity_id: input.entityId,
        description: input.description,
        currency_code: "USD",
      },
      idempotencyKey: input.idempotencyKey,
    });
    if (!account.default_account_number || !account.routing_number || !account.id) {
      throw new Error("Column did not return account and routing numbers.");
    }
    return toAccountView(account);
  }

  async getAccount(providerAccountId: string): Promise<ColumnAccountView> {
    const account = await this.client.request<ColumnBankAccount>(`/bank-accounts/${providerAccountId}`);
    return toAccountView(account);
  }

  async closeAccount(input: { accountId: string; reason: string }) {
    await this.client.request(`/bank-accounts/${input.accountId}`, { method: "DELETE", body: { reason: input.reason } });
    return { status: "closed" as const };
  }

  async listTransfers(providerAccountId: string): Promise<ColumnUnifiedTransfer[]> {
    const outgoing = await this.client.request<ColumnListTransfers>("/transfers", {
      query: { sender_bank_account_id: providerAccountId, limit: 50 },
    });
    const incoming = await this.client.request<ColumnListTransfers>("/transfers", {
      query: { receiver_bank_account_id: providerAccountId, limit: 50 },
    });
    const byId = new Map<string, ColumnUnifiedTransfer>();
    for (const row of [...(outgoing.transfers ?? []), ...(incoming.transfers ?? [])]) {
      if (row.id) byId.set(row.id, row);
    }
    return [...byId.values()];
  }
}

export class ColumnPaymentProvider implements PaymentProvider {
  readonly name = "column";
  private readonly client: ColumnClient;
  constructor(client: ColumnClient) {
    this.client = client;
  }

  async originateAch() {
    return { providerRef: "", status: "failed" as const };
  }

  async createCounterparty(input: {
    name: string;
    accountNumber: string;
    routingNumber: string;
    idempotencyKey: string;
  }): Promise<ColumnCounterparty> {
    return this.client.request<ColumnCounterparty>("/counterparties", {
      method: "POST",
      body: {
        name: input.name,
        account_number: input.accountNumber,
        routing_number: input.routingNumber,
        routing_number_type: "aba",
        account_type: "checking",
      },
      idempotencyKey: input.idempotencyKey,
    });
  }

  async createAchTransfer(input: {
    bankAccountId: string;
    accountNumberId?: string;
    counterpartyId: string;
    amountCents: number;
    description: string;
    receiverName: string;
    idempotencyKey: string;
  }): Promise<ColumnAchTransfer> {
    const body: Record<string, unknown> = {
      bank_account_id: input.bankAccountId,
      counterparty_id: input.counterpartyId,
      amount: input.amountCents,
      currency_code: "USD",
      type: "CREDIT",
      same_day: false,
      description: input.description.slice(0, 255),
      receiver_name: input.receiverName.slice(0, 22),
      entry_class_code: "PPD",
    };
    if (input.accountNumberId) body.account_number_id = input.accountNumberId;
    return this.client.request<ColumnAchTransfer>("/transfers/ach", {
      method: "POST",
      body,
      idempotencyKey: input.idempotencyKey,
    });
  }

  async getAchTransfer(id: string): Promise<ColumnAchTransfer> {
    return this.client.request<ColumnAchTransfer>(`/transfers/ach/${id}`);
  }

  async simulateIncomingAchCredit(input: {
    destinationAccountNumberId: string;
    amountCents: number;
  }): Promise<void> {
    if (this.client.environment !== "sandbox") {
      throw new Error("Incoming ACH simulation is only available in sandbox.");
    }
    await this.client.request("/simulate/receive-ach-credit", {
      method: "POST",
      body: {
        destination_account_number_id: input.destinationAccountNumberId,
        amount: input.amountCents,
        currency_code: "USD",
      },
    });
  }

  async listIncomingAch(bankAccountId: string): Promise<ColumnAchTransfer[]> {
    const list = await this.client.request<ColumnAchList>("/transfers/ach", {
      query: { bank_account_id: bankAccountId, is_incoming: true, limit: 20 },
    });
    return list.transfers ?? [];
  }

  async settleAch(input: { achTransferId: string; direction: "outbound" | "inbound" }): Promise<void> {
    if (input.direction !== "outbound") {
      throw new Error(
        "Column’s settle simulation is for outgoing ACH transfers only. Incoming ACH is processed on Column’s schedule.",
      );
    }
    if (this.client.environment !== "sandbox") {
      throw new Error("ACH settle simulation is only available in sandbox.");
    }
    await this.client.request("/simulate/transfers/ach/settle", {
      method: "POST",
      body: { ach_transfer_id: input.achTransferId },
    });
  }
}

export class UnconfiguredKycProvider implements KycProvider {
  readonly name = "unconfigured";
  async start() {
    return { providerRef: "", status: "processing" as const };
  }
  async submitDocument() {
    return { status: "failed" as const };
  }
  async submitSelfie() {
    return { status: "failed" as const, reason: "Banking partner is not configured." };
  }
}

export class UnconfiguredBankingProvider implements BankingProvider {
  readonly name = "unconfigured";
  async openChecking() {
    return {
      status: "unable_to_verify" as const,
      accountNumber: "",
      routingNumber: "",
      reason: "Banking partner is not configured. MONEYLEAD will not invent account numbers.",
    };
  }
  async closeAccount() {
    return { status: "pending" as const };
  }
}

export class UnconfiguredPaymentProvider implements PaymentProvider {
  readonly name = "unconfigured";
  async originateAch() {
    return { providerRef: "", status: "failed" as const };
  }
}

export class UnconfiguredCardProvider implements CardProvider {
  readonly name = "unconfigured-card";
  async issueDebit(): Promise<never> {
    throw new Error("Debit cards are not issued in this environment. Column’s public API does not issue consumer debit cards.");
  }
  async freeze() {
    throw new Error("Debit cards are not issued in this environment.");
  }
  async replace(): Promise<never> {
    throw new Error("Debit cards are not issued in this environment.");
  }
}

export class PendingCreditProvider implements CreditProvider {
  readonly name = "pending-issuer";
  async underwrite() {
    return {
      status: "additional_info" as const,
      reason:
        "Your application was received. MONEYLEAD does not issue credit decisions in this environment. A licensed consumer credit issuer must be connected before any approval or decline.",
    };
  }
  async issueCard(): Promise<never> {
    throw new Error("No credit-card issuer is connected. MONEYLEAD will not invent a card or credit limit.");
  }
}

export { mapColumnAchStatus };
