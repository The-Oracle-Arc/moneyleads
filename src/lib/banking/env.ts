/**
 * Server-only environment. Never import from client components.
 * Secrets are injected by the platform. This file only reads process.env.
 */

import type { BankingEnvironment } from "./types";

export type { BankingEnvironment };

function read(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}

export function serverEnv() {
  const columnApiKey = read("COLUMN_API_KEY");
  const requested = (read("BANKING_ENVIRONMENT") ?? "sandbox").toLowerCase();
  const bankingEnvironment: BankingEnvironment = requested === "live" || requested === "production" ? "live" : "sandbox";

  return {
    xaiApiKey: read("XAI_API_KEY"),
    xaiModel: read("XAI_MODEL") ?? "grok-4.6",
    databaseUrl: read("DATABASE_URL"),
    columnApiKey,
    columnWebhookSecret: read("COLUMN_WEBHOOK_SECRET"),
    bankingEnvironment,
    columnBaseUrl: read("COLUMN_API_BASE_URL") ?? "https://api.column.com",
  };
}

export class BankingConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BankingConfigError";
  }
}

/** Reject live keys in sandbox and sandbox keys in live. Never log the key. */
export function assertColumnKeyMatchesEnvironment(apiKey: string, environment: BankingEnvironment): void {
  const prefix = apiKey.slice(0, 5);
  if (environment === "live") {
    if (prefix === "test_") {
      throw new BankingConfigError("Sandbox Column keys cannot be used when BANKING_ENVIRONMENT is live.");
    }
    if (prefix !== "live_") {
      throw new BankingConfigError("Live Column keys must start with live_.");
    }
    return;
  }
  if (prefix === "live_") {
    throw new BankingConfigError("Live Column keys cannot be used in sandbox. Set BANKING_ENVIRONMENT=live only for production.");
  }
}

export function columnConfigured(): boolean {
  return Boolean(serverEnv().columnApiKey);
}

export function requireColumnWebhookSecret():
  | { ok: true; secret: string }
  | { ok: false; error: string; status: number } {
  const secret = serverEnv().columnWebhookSecret;
  if (!secret) return { ok: false, error: "Webhook secret is not configured.", status: 503 };
  return { ok: true, secret };
}

export function resolvedBankingEnvironment(): BankingEnvironment {
  const env = serverEnv();
  if (!env.columnApiKey) return "unconfigured";
  try {
    assertColumnKeyMatchesEnvironment(env.columnApiKey, env.bankingEnvironment);
    return env.bankingEnvironment;
  } catch {
    return "unconfigured";
  }
}

export function usingMockProviders(): boolean {
  return !columnConfigured();
}

export function publicBankingStatus() {
  const env = serverEnv();
  const environment = resolvedBankingEnvironment();
  return {
    configured: environment !== "unconfigured",
    environment,
    providerName: environment === "unconfigured" ? "unconfigured" : "column",
    cardsAvailable: false,
    creditIssuerAvailable: false,
    simulateAvailable: environment === "sandbox",
    webhookSecretConfigured: Boolean(env.columnWebhookSecret),
  };
}
