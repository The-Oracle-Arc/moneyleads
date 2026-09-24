import assert from "node:assert/strict";
import test from "node:test";
import { ColumnApiError, getColumnClient, resetColumnClientCache } from "./client.ts";
import { ColumnBankingProvider, ColumnKycProvider, ColumnPaymentProvider } from "./provider.ts";
import { resolvedBankingEnvironment } from "../env.ts";

const keyPresent = Boolean(process.env.COLUMN_API_KEY?.trim());

test("live Column sandbox is not configured in this environment", { skip: keyPresent }, () => {
  resetColumnClientCache();
  assert.equal(resolvedBankingEnvironment(), "unconfigured");
  assert.throws(() => getColumnClient());
});

test(
  "live Column sandbox creates a real person, account, and sandbox ACH",
  { skip: keyPresent ? false : "COLUMN_API_KEY is not present on the server process" },
  async () => {
    resetColumnClientCache();
    assert.equal(resolvedBankingEnvironment(), "sandbox");
    const client = getColumnClient();
    const kyc = new ColumnKycProvider(client);
    const banking = new ColumnBankingProvider(client);
    const payments = new ColumnPaymentProvider(client);
    const suffix = `${Date.now().toString(36)}`;
    const personInput = {
      firstName: "Ada",
      lastName: "Lovelace",
      dateOfBirth: "1990-05-10",
      email: `ada.sandbox.${suffix}@example.com`,
      ssn: "123456789",
      address: {
        line1: "101 Market St",
        city: "San Francisco",
        state: "CA",
        postalCode: "94105",
        countryCode: "US",
      },
    };
    const personKey = `person:live-test:${suffix}`;

    const person = await kyc.createPerson(personInput, personKey);
    assert.ok(person.entityId.startsWith("enti_") || person.entityId.length > 8);
    assert.equal(person.verificationStatus, "approved");

    const personAgain = await kyc.createPerson(personInput, personKey);
    assert.equal(personAgain.entityId, person.entityId);

    const idempotencyKey = `checking:live-test:${suffix}`;
    const opened = await banking.openCheckingAccount({
      entityId: person.entityId,
      description: "MONEYLEAD Sandbox Test",
      idempotencyKey,
    });
    assert.ok(opened.accountNumber && opened.accountNumber.length >= 4);
    assert.match(opened.routingNumber, /^\d{9}$/);
    assert.ok(opened.providerAccountId);
    assert.ok(opened.providerAccountNumberId);

    const fetched = await banking.getAccount(opened.providerAccountId);
    assert.equal(fetched.providerAccountId, opened.providerAccountId);
    assert.equal(fetched.accountNumber, opened.accountNumber);
    assert.equal(fetched.routingNumber, opened.routingNumber);
    assert.equal(typeof fetched.availableCents, "number");
    assert.equal(typeof fetched.currentCents, "number");

    const again = await banking.openCheckingAccount({
      entityId: person.entityId,
      description: "MONEYLEAD Sandbox Test",
      idempotencyKey,
    });
    assert.equal(again.providerAccountId, opened.providerAccountId);
    assert.equal(again.accountNumber, opened.accountNumber);

    await assert.rejects(
      () => banking.getAccount("bacc_does_not_exist_moneylead"),
      (err: unknown) => {
        assert.ok(err instanceof ColumnApiError);
        assert.equal(String(err.message).includes("COLUMN_API_KEY"), false);
        assert.equal(err.customerMessage.includes("COLUMN_API_KEY"), false);
        return true;
      },
    );

    const counterparty = await payments.createCounterparty({
      name: "Sandbox Counterparty",
      accountNumber: "111122223333",
      routingNumber: "121000248",
      idempotencyKey: `cpty:live-test:${suffix}`,
    });
    assert.ok(counterparty.id);

    const sendKey = `ach:live-test:${suffix}`;
    let firstSendId: string | null = null;
    try {
      const sent = await payments.createAchTransfer({
        bankAccountId: opened.providerAccountId,
        accountNumberId: opened.providerAccountNumberId,
        counterpartyId: counterparty.id,
        amountCents: 100,
        description: "MONEYLEAD sandbox send",
        receiverName: "Sandbox Cpty",
        idempotencyKey: sendKey,
      });
      firstSendId = sent.id;
      assert.ok(sent.id);
      const sentAgain = await payments.createAchTransfer({
        bankAccountId: opened.providerAccountId,
        accountNumberId: opened.providerAccountNumberId,
        counterpartyId: counterparty.id,
        amountCents: 100,
        description: "MONEYLEAD sandbox send",
        receiverName: "Sandbox Cpty",
        idempotencyKey: sendKey,
      });
      assert.equal(sentAgain.id, sent.id);
    } catch (err) {
      assert.ok(err instanceof ColumnApiError, "send failure must come from Column, not invented success");
      assert.equal(err.customerMessage.includes("COLUMN_API_KEY"), false);
      await assert.rejects(
        () =>
          payments.createAchTransfer({
            bankAccountId: opened.providerAccountId,
            accountNumberId: opened.providerAccountNumberId,
            counterpartyId: counterparty.id,
            amountCents: 100,
            description: "MONEYLEAD sandbox send",
            receiverName: "Sandbox Cpty",
            idempotencyKey: sendKey,
          }),
        ColumnApiError,
      );
    }
    void firstSendId;

    await payments.simulateIncomingAchCredit({
      destinationAccountNumberId: opened.providerAccountNumberId,
      amountCents: 2500,
    });

    const after = await banking.getAccount(opened.providerAccountId);
    assert.equal(after.providerAccountId, opened.providerAccountId);
    assert.equal(typeof after.availableCents, "number");
    assert.equal(typeof after.currentCents, "number");
  },
);
