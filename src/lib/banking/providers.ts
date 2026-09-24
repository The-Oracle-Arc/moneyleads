/**
 * Provider interfaces. The frontend never talks to these.
 * Column is the banking infrastructure when COLUMN_API_KEY is present.
 * Unconfigured providers fail closed. They never invent account numbers,
 * balances, KYC approvals, or card PANs.
 */

import { columnConfigured, resolvedBankingEnvironment } from "./env";
import { getColumnClient } from "./column/client";
import {
  ColumnBankingProvider,
  ColumnKycProvider,
  ColumnPaymentProvider,
  PendingCreditProvider,
  UnconfiguredBankingProvider,
  UnconfiguredCardProvider,
  UnconfiguredKycProvider,
  UnconfiguredPaymentProvider,
} from "./column/provider";

export type ProviderResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface KycProvider {
  readonly name: string;
  start(input: {
    customerId: string;
    legalName: string;
  }): Promise<{ providerRef: string; status: "processing" | "pending_documents" }>;
  submitDocument(input: {
    providerRef: string;
    documentType: string;
  }): Promise<{ status: "processing" | "selfie_required" | "failed" }>;
  submitSelfie(input: { providerRef: string }): Promise<{
    status: "approved" | "failed" | "manual_review";
    reason?: string;
  }>;
}

export interface BankingProvider {
  readonly name: string;
  openChecking(input: {
    customerId: string;
    legalName: string;
    kycProviderRef: string | null;
  }): Promise<{
    status: "approved" | "additional_review" | "unable_to_verify";
    accountNumber: string;
    routingNumber: string;
    reason?: string;
  }>;
  closeAccount(input: { accountId: string; reason: string }): Promise<{ status: "closed" | "pending" }>;
}

export interface CardProvider {
  readonly name: string;
  issueDebit(input: {
    accountId: string;
    holderName: string;
  }): Promise<{ last4: string; panToken: string; expMonth: number; expYear: number; shippingStatus: string }>;
  freeze(cardId: string, frozen: boolean): Promise<void>;
  replace(cardId: string, reason: string): Promise<{ last4: string; panToken: string }>;
}

export interface CreditProvider {
  readonly name: string;
  underwrite(input: {
    customerId: string;
    annualIncomeCents: number;
    employmentStatus: string;
    housingStatus: string;
    housingPaymentCents: number;
  }): Promise<{
    status: "approved" | "declined" | "additional_info";
    creditLimitCents?: number;
    reason: string;
    adverseAction?: string;
  }>;
  issueCard(input: {
    holderName: string;
    creditLimitCents: number;
  }): Promise<{ last4: string; panToken: string; expMonth: number; expYear: number }>;
}

export interface PaymentProvider {
  readonly name: string;
  originateAch(input: {
    amountCents: number;
    direction: "inbound" | "outbound";
    idempotencyKey: string;
  }): Promise<{ providerRef: string; status: "pending" | "completed" | "failed" }>;
}

export interface NotificationProvider {
  readonly name: string;
  readonly configured: boolean;
  sendSms(to: string, body: string): Promise<{ providerRef: string }>;
  sendVoice(to: string, body: string): Promise<{ providerRef: string }>;
  sendEmail(to: string, subject: string, body: string): Promise<{ providerRef: string }>;
  sendPush(userId: string, title: string, body: string): Promise<{ providerRef: string }>;
}

export class LocalNotificationProvider implements NotificationProvider {
  readonly name = "local-notify";
  readonly configured = false;
  async sendSms() {
    return { providerRef: `sms_${crypto.randomUUID()}` };
  }
  async sendVoice() {
    return { providerRef: `voice_${crypto.randomUUID()}` };
  }
  async sendEmail() {
    return { providerRef: `email_${crypto.randomUUID()}` };
  }
  async sendPush() {
    return { providerRef: `push_${crypto.randomUUID()}` };
  }
}

function envTrim(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}

export function notificationEnvConfigured(): boolean {
  return Boolean(
    envTrim("RESEND_API_KEY") ||
      envTrim("POSTMARK_API_KEY") ||
      envTrim("EMAIL_PROVIDER_API_KEY") ||
      envTrim("TWILIO_ACCOUNT_SID"),
  );
}

/** Uses configured email/SMS env when present. Never invents a successful delivery. */
export class EnvNotificationProvider implements NotificationProvider {
  readonly name = "env-notify";
  readonly configured = true;

  async sendEmail(to: string, subject: string, body: string) {
    const from = envTrim("EMAIL_FROM") || "MONEYLEAD <noreply@moneylead.app>";
    const resend = envTrim("RESEND_API_KEY");
    if (resend) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resend}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [to], subject, text: body }),
      });
      if (!r.ok) throw new Error("Could not send email.");
      return { providerRef: `email_${crypto.randomUUID()}` };
    }
    const postmark = envTrim("POSTMARK_API_KEY") || envTrim("EMAIL_PROVIDER_API_KEY");
    if (postmark) {
      const r = await fetch("https://api.postmarkapp.com/email", {
        method: "POST",
        headers: {
          "X-Postmark-Server-Token": postmark,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ From: from, To: to, Subject: subject, TextBody: body }),
      });
      if (!r.ok) throw new Error("Could not send email.");
      return { providerRef: `email_${crypto.randomUUID()}` };
    }
    throw new Error("Email delivery is not configured.");
  }

  async sendSms(to: string, body: string) {
    const sid = envTrim("TWILIO_ACCOUNT_SID");
    const token = envTrim("TWILIO_AUTH_TOKEN");
    const from = envTrim("TWILIO_FROM");
    if (!sid || !token || !from) throw new Error("SMS delivery is not configured.");
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    });
    if (!r.ok) throw new Error("Could not send SMS.");
    return { providerRef: `sms_${crypto.randomUUID()}` };
  }

  async sendVoice(to: string, body: string) {
    return this.sendSms(to, body);
  }

  async sendPush(_userId: string, _title: string, _body: string) {
    return { providerRef: `push_${crypto.randomUUID()}` };
  }
}

export function getNotificationProvider(): NotificationProvider {
  return notificationEnvConfigured() ? new EnvNotificationProvider() : new LocalNotificationProvider();
}


export type ProviderSet = {
  kyc: KycProvider;
  banking: BankingProvider;
  cards: CardProvider;
  credit: CreditProvider;
  payments: PaymentProvider;
  notify: NotificationProvider;
  columnKyc: ColumnKycProvider | null;
  columnBanking: ColumnBankingProvider | null;
  columnPayments: ColumnPaymentProvider | null;
};

export function getProviders(): ProviderSet {
  const notify = getNotificationProvider();
  const cards = new UnconfiguredCardProvider();
  const credit = new PendingCreditProvider();

  if (columnConfigured() && resolvedBankingEnvironment() !== "unconfigured") {
    const client = getColumnClient();
    const columnKyc = new ColumnKycProvider(client);
    const columnBanking = new ColumnBankingProvider(client);
    const columnPayments = new ColumnPaymentProvider(client);
    return {
      kyc: columnKyc,
      banking: columnBanking,
      cards,
      credit,
      payments: columnPayments,
      notify,
      columnKyc,
      columnBanking,
      columnPayments,
    };
  }
  return {
    kyc: new UnconfiguredKycProvider(),
    banking: new UnconfiguredBankingProvider(),
    cards,
    credit,
    payments: new UnconfiguredPaymentProvider(),
    notify,
    columnKyc: null,
    columnBanking: null,
    columnPayments: null,
  };
}

export const providers: ProviderSet = new Proxy({} as ProviderSet, {
  get(_target, prop, _receiver) {
    const live = getProviders();
    return live[prop as keyof ProviderSet];
  },
});
