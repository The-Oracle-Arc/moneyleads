import assert from "node:assert/strict";
import test from "node:test";
import { ColumnApiError, ColumnClient, getColumnClient, resetColumnClientCache } from "./client.ts";
import { BankingConfigError } from "../env.ts";
import {
  ColumnBankingProvider,
  ColumnKycProvider,
  ColumnPaymentProvider,
  UnconfiguredBankingProvider,
} from "./provider.ts";

test("getColumnClient fails closed without COLUMN_API_KEY", () => {
  const prev = process.env.COLUMN_API_KEY;
  delete process.env.COLUMN_API_KEY;
  try {
    resetColumnClientCache();
    assert.throws(() => getColumnClient(), (err: unknown) => {
      assert.ok(err instanceof BankingConfigError);
      assert.equal(String(err.message).includes("COLUMN_API_KEY"), false);
      return true;
    });
  } finally {
    if (prev !== undefined) process.env.COLUMN_API_KEY = prev;
    else delete process.env.COLUMN_API_KEY;
    resetColumnClientCache();
  }
});

test("unconfigured banking does not invent account numbers", async () => {
  const banking = new UnconfiguredBankingProvider();
  const opened = await banking.openChecking();
  assert.equal(opened.accountNumber, "");
  assert.equal(opened.routingNumber, "");
  assert.equal(opened.status, "unable_to_verify");
});

test("createPerson sends documented person-entity fields", async () => {
  const original = globalThis.fetch;
  let captured: { url: string; body: string | null } | undefined;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    captured = { url: String(url), body: typeof init?.body === "string" ? init.body : null };
    return new Response(JSON.stringify({ id: "enti_1", verification_status: "VERIFIED", type: "PERSON", name: "Ada" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  try {
    const client = new ColumnClient("test_key", "sandbox", "https://api.column.com");
    const kyc = new ColumnKycProvider(client);
    await kyc.createPerson(
      {
        firstName: "Ada",
        lastName: "Lovelace",
        dateOfBirth: "1815-12-10",
        ssn: "123456789",
        address: { line1: "1 Market St", city: "San Francisco", state: "CA", postalCode: "94105", countryCode: "US" },
      },
      "person:1",
    );
    assert.ok(captured);
    assert.equal(captured.url, "https://api.column.com/entities/person");
    const body = JSON.parse(captured.body ?? "{}") as {
      first_name?: string;
      last_name?: string;
      date_of_birth?: string;
      ssn?: string;
      address?: { line_1?: string; city?: string; country_code?: string };
    };
    assert.equal(body.first_name, "Ada");
    assert.equal(body.last_name, "Lovelace");
    assert.equal(body.date_of_birth, "1815-12-10");
    assert.equal(body.ssn, "123456789");
    assert.equal(body.address?.line_1, "1 Market St");
    assert.equal(body.address?.city, "San Francisco");
    assert.equal(body.address?.country_code, "US");
  } finally {
    globalThis.fetch = original;
  }
});

test("openCheckingAccount does not invent numbers when Column omits them", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ id: "", default_account_number: "", routing_number: "" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
  try {
    const client = new ColumnClient("test_key", "sandbox", "https://api.column.com");
    const banking = new ColumnBankingProvider(client);
    await assert.rejects(
      () => banking.openCheckingAccount({ entityId: "enti_1", description: "Checking", idempotencyKey: "acct:1" }),
      /did not return account and routing numbers/,
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("simulateIncomingAchCredit is refused in live", async () => {
  const client = new ColumnClient("live_key", "live", "https://api.column.com");
  const payments = new ColumnPaymentProvider(client);
  await assert.rejects(
    () => payments.simulateIncomingAchCredit({ destinationAccountNumberId: "acn_1", amountCents: 100 }),
    /only available in sandbox/,
  );
});

test("settleAch is outgoing-only and refused in live", async () => {
  const sandbox = new ColumnPaymentProvider(new ColumnClient("test_key", "sandbox", "https://api.column.com"));
  await assert.rejects(
    () => sandbox.settleAch({ achTransferId: "acht_1", direction: "inbound" }),
    /outgoing ACH/,
  );
  const live = new ColumnPaymentProvider(new ColumnClient("live_key", "live", "https://api.column.com"));
  await assert.rejects(
    () => live.settleAch({ achTransferId: "acht_1", direction: "outbound" }),
    /only available in sandbox/,
  );
});

test("createAchTransfer posts to /transfers/ach with idempotency and fails closed on Column errors", async () => {
  const original = globalThis.fetch;
  const captured: { url: string; headers: Record<string, string>; body: string | null }[] = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    captured.push({
      url: String(url),
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: typeof init?.body === "string" ? init.body : null,
    });
    return new Response(JSON.stringify({ message: "insufficient available balance", code: 400 }), { status: 400 });
  }) as typeof fetch;
  try {
    const client = new ColumnClient("test_key", "sandbox", "https://api.column.com");
    const payments = new ColumnPaymentProvider(client);
    await assert.rejects(
      () =>
        payments.createAchTransfer({
          bankAccountId: "bacc_1",
          counterpartyId: "cpty_1",
          amountCents: 100,
          description: "test",
          receiverName: "Ada",
          idempotencyKey: "ach:1",
        }),
      (err: unknown) => {
        assert.ok(err instanceof ColumnApiError);
        assert.equal(err.customerMessage.includes("available balance"), true);
        assert.equal(err.customerMessage.includes("COLUMN_API_KEY"), false);
        return true;
      },
    );
    assert.equal(captured.length, 1);
    assert.equal(captured[0].url, "https://api.column.com/transfers/ach");
    assert.equal(captured[0].headers["Idempotency-Key"], "ach:1");
    const body = JSON.parse(captured[0].body ?? "{}") as { amount?: number; type?: string; currency_code?: string };
    assert.equal(body.amount, 100);
    assert.equal(body.type, "CREDIT");
    assert.equal(body.currency_code, "USD");
  } finally {
    globalThis.fetch = original;
  }
});
