/**
 * Optional language layer. MONEYLEAD CORE does not depend on any LLM vendor.
 * Banking, KYC, ledger, and authorization never call this module as source of truth.
 */

import { serverEnv } from "@/lib/banking/env";

export type AiCompleteInput = {
  system: string;
  user: string;
  maxTokens?: number;
};

export interface AiProvider {
  readonly id: string;
  readonly label: string;
  readonly configured: boolean;
  complete(input: AiCompleteInput): Promise<string | null>;
}

class UnconfiguredAiProvider implements AiProvider {
  readonly id = "none";
  readonly label = "Not configured";
  readonly configured = false;
  async complete(): Promise<null> {
    return null;
  }
}

class EnvBackedAiProvider implements AiProvider {
  readonly id: string;
  readonly label: string;
  readonly configured: boolean;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(id: string, label: string, apiKey: string, baseUrl: string, model: string) {
    this.id = id;
    this.label = label;
    this.configured = true;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async complete(input: AiCompleteInput): Promise<string | null> {
    try {
      const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.2,
          max_tokens: input.maxTokens ?? 400,
          messages: [
            { role: "system", content: input.system },
            { role: "user", content: input.user },
          ],
        }),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return json.choices?.[0]?.message?.content ?? null;
    } catch {
      return null;
    }
  }
}

function read(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}

/**
 * Resolve an optional provider from server env. No vendor is the identity of MONEYLEAD.
 * Missing configuration is a pending state, not a silent fallback to a specific vendor.
 */
export function getAiProvider(): AiProvider {
  const named = (read("AI_PROVIDER") ?? "").toLowerCase();
  const env = serverEnv();
  const openai = read("OPENAI_API_KEY");
  const generic = read("AI_API_KEY");
  const genericBase = read("AI_API_BASE_URL");
  const genericModel = read("AI_MODEL") ?? env.xaiModel;

  if (named === "none") return new UnconfiguredAiProvider();

  if ((named === "openai" || (!named && openai && !env.xaiApiKey)) && openai) {
    return new EnvBackedAiProvider(
      "openai-compatible",
      "Configured (OpenAI-compatible)",
      openai,
      read("OPENAI_API_BASE_URL") ?? "https://api.openai.com/v1",
      read("OPENAI_MODEL") ?? "gpt-4.1-mini",
    );
  }

  if (generic && genericBase) {
    return new EnvBackedAiProvider("openai-compatible", "Configured", generic, genericBase, genericModel);
  }

  if (env.xaiApiKey) {
    return new EnvBackedAiProvider(
      "openai-compatible",
      "Configured",
      env.xaiApiKey,
      "https://api.x.ai/v1",
      env.xaiModel,
    );
  }

  return new UnconfiguredAiProvider();
}

export function aiProviderStatus() {
  const provider = getAiProvider();
  return {
    configured: provider.configured,
    label: provider.label,
    requiredMessage: provider.configured
      ? null
      : "AI provider configuration required. The MONEYLEAD Assistant still works with deterministic platform tools. Natural-language phrasing needs an optional AI provider configured as a server environment variable. MONEYLEAD is not coupled to a single vendor.",
  };
}

export function emailProviderConfigured(): boolean {
  return Boolean(read("RESEND_API_KEY") || read("SMTP_URL") || read("EMAIL_PROVIDER_API_KEY") || read("POSTMARK_API_KEY"));
}
