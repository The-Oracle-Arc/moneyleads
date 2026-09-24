import { assertColumnKeyMatchesEnvironment, BankingConfigError, serverEnv } from "../env.ts";
import { customerMessageForColumnError } from "./status.ts";

export class ColumnApiError extends Error {
  readonly status: number;
  readonly code: unknown;
  readonly type?: string;
  readonly customerMessage: string;

  constructor(input: { status: number; code?: unknown; type?: string; message: string }) {
    super(input.message);
    this.name = "ColumnApiError";
    this.status = input.status;
    this.code = input.code;
    this.type = input.type;
    this.customerMessage = customerMessageForColumnError(input.code ?? input.status, input.message);
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: Record<string, unknown> | null;
  query?: Record<string, string | number | boolean | undefined>;
  idempotencyKey?: string;
};

function basicAuthHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`:${apiKey}`, "utf8").toString("base64")}`;
}

function encodeQuery(query: RequestOptions["query"]): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export class ColumnClient {
  readonly baseUrl: string;
  private readonly apiKey: string;
  readonly environment: "sandbox" | "live";

  constructor(apiKey: string, environment: "sandbox" | "live", baseUrl: string) {
    this.apiKey = apiKey;
    this.environment = environment;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const method = options.method ?? (options.body ? "POST" : "GET");
    const url = `${this.baseUrl}${path}${encodeQuery(options.query)}`;
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: basicAuthHeader(this.apiKey),
    };
    if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;
    if (options.body) headers["Content-Type"] = "application/json";

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
    } catch {
      throw new ColumnApiError({
        status: 503,
        message: "Banking provider unavailable",
      });
    }

    const text = await response.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = { message: text.slice(0, 200) };
      }
    }

    if (!response.ok) {
      const payload = (json ?? {}) as { message?: string; code?: unknown; type?: string };
      throw new ColumnApiError({
        status: response.status,
        code: payload.code,
        type: payload.type,
        message: payload.message || `Column request failed (${response.status})`,
      });
    }

    return (json ?? {}) as T;
  }
}

let cached: ColumnClient | null = null;
let cachedKey: string | null = null;

export function getColumnClient(): ColumnClient {
  const env = serverEnv();
  if (!env.columnApiKey) {
    throw new BankingConfigError("Banking partner is not configured.");
  }
  assertColumnKeyMatchesEnvironment(env.columnApiKey, env.bankingEnvironment);
  if (cached && cachedKey === env.columnApiKey) return cached;
  cached = new ColumnClient(env.columnApiKey, env.bankingEnvironment, env.columnBaseUrl);
  cachedKey = env.columnApiKey;
  return cached;
}

export function resetColumnClientCache() {
  cached = null;
  cachedKey = null;
}
