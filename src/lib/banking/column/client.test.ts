import assert from "node:assert/strict";
import test from "node:test";
import { ColumnClient, ColumnApiError } from "./client.ts";

test("Column client uses Basic auth with empty username", async () => {
  const original = globalThis.fetch;
  type Captured = { url: string; headers: Record<string, string>; body: string | null };
  let captured: Captured | undefined;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    captured = {
      url: String(url),
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: typeof init?.body === "string" ? init.body : null,
    };
    return new Response(JSON.stringify({ id: "enti_1", verification_status: "VERIFIED", type: "PERSON", name: "A" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const client = new ColumnClient("test_key", "sandbox", "https://api.column.com");
    const result = await client.request<{ id: string }>("/entities/person", {
      method: "POST",
      body: { first_name: "Ada" },
      idempotencyKey: "person:1",
    });
    assert.ok(captured);
    assert.equal(captured.url, "https://api.column.com/entities/person");
    const expected = `Basic ${Buffer.from(":test_key", "utf8").toString("base64")}`;
    assert.equal(captured.headers.Authorization, expected);
    assert.equal(captured.headers["Idempotency-Key"], "person:1");
    assert.equal(captured.body, JSON.stringify({ first_name: "Ada" }));
    assert.equal(captured.headers.Authorization.startsWith("Basic "), true);
    assert.equal(JSON.stringify(captured.body).includes("test_key"), false);
  } finally {
    globalThis.fetch = original;
  }
});

test("Column client maps HTTP errors without leaking secrets", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ code: 400, message: "insufficient available balance" }), { status: 400 })) as typeof fetch;
  try {
    const client = new ColumnClient("test_key", "sandbox", "https://api.column.com");
    await assert.rejects(
      () => client.request("/transfers/ach", { method: "POST", body: { amount: 1 } }),
      (err: unknown) => {
        assert.ok(err instanceof ColumnApiError);
        assert.equal(err.customerMessage.includes("available balance"), true);
        assert.equal(err.message.includes("test_key"), false);
        return true;
      },
    );
  } finally {
    globalThis.fetch = original;
  }
});
