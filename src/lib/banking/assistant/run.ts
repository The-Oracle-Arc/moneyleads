import { getSql } from "@/lib/db";
import { newId } from "../ids";
import { customerSnapshot, type Actor } from "../control-plane";
import { explainTopic } from "./knowledge";
import { matchIntent } from "./intent";
import { llmAvailable, planWithLlm } from "./llm";
import { runTool, type ToolName, type ToolResult } from "./tools";
import { resolveStaffRole } from "../staff";
import { bankingProgramFromStatus } from "../program";
import { publicBankingStatus } from "../env";

export type AssistantTurn = {
  reply: string;
  source: "deterministic" | "llm+tools";
  llmAvailable: boolean;
  href?: string;
  confirmationId?: string;
  tools: ToolResult[];
};

async function threadId(userId: string): Promise<string> {
  const sql = await getSql();
  const existing = await sql<{ id: string }>`select id from assistant_threads where user_id = ${userId} limit 1`;
  if (existing[0]) return existing[0].id;
  const id = newId("ath");
  await sql`insert into assistant_threads (id, user_id) values (${id}, ${userId})`;
  return id;
}

async function persist(userId: string, role: "user" | "assistant", body: string, toolName?: string, source?: string) {
  const sql = await getSql();
  const tid = await threadId(userId);
  await sql`insert into assistant_messages (id, thread_id, user_id, role, body, tool_name, source)
    values (${newId("amsg")}, ${tid}, ${userId}, ${role}, ${body.slice(0, 8000)}, ${toolName ?? null}, ${source ?? "deterministic"})`;
  await sql`update assistant_threads set updated_at = now() where id = ${tid}`;
}

export async function loadHistory(userId: string) {
  const sql = await getSql();
  const rows = await sql<{ id: string; role: string; body: string; created_at: Date; source: string }>`
    select m.id, m.role, m.body, m.created_at, m.source
    from assistant_messages m
    join assistant_threads t on t.id = m.thread_id
    where t.user_id = ${userId}
    order by m.created_at asc
    limit 40
  `;
  return rows.map((r) => ({
    id: r.id,
    role: r.role as "user" | "assistant",
    body: r.body,
    createdAt: new Date(r.created_at).toISOString(),
    source: r.source,
  }));
}

export async function runAssistantTurn(userId: string, message: string): Promise<AssistantTurn> {
  const actor: Actor = { kind: "assistant", userId };
  const text = message.trim().slice(0, 2000);
  if (!text) {
    return {
      reply: "Ask me about MONEYLEAD, onboarding, accounts, transfers, cards, or verification. I cannot change balances.",
      source: "deterministic",
      llmAvailable: llmAvailable(),
      tools: [],
    };
  }
  await persist(userId, "user", text);

  const sql = await getSql();
  const staffRole = await resolveStaffRole(sql, userId);
  if (staffRole && /\b(banking program|system status|control center|staff|ultimate admin|ai provider)\b/i.test(text)) {
    const program = bankingProgramFromStatus(publicBankingStatus());
    const reply = [
      `Your Control Center role is ${staffRole === "ultimate_admin" ? "ULTIMATE_ADMIN" : staffRole}.`,
      `${program.title}: ${program.programStatus}.`,
      `Environment: ${program.environmentLabel}. Production: ${program.productionStatus}.`,
      program.productionNote,
      "I cannot bypass your permissions, invent balances, or approve a banking relationship.",
    ].join(" ");
    await persist(userId, "assistant", reply, "platform_status", "deterministic");
    return { reply, source: "deterministic", llmAvailable: llmAvailable(), tools: [] };
  }

  const tools: ToolResult[] = [];
  const intent = matchIntent(text);
  const snap = await customerSnapshot(actor);

  let plan = null as Awaited<ReturnType<typeof planWithLlm>>;
  if (llmAvailable()) {
    plan = await planWithLlm({ message: text, snapshot: snap });
  }

  if (plan?.tool) {
    const result = await runTool(actor, plan.tool as ToolName, plan.args ?? { query: text });
    tools.push(result);
  } else if (intent.kind === "explain") {
    tools.push(await runTool(actor, "explain_topic", { topic: intent.topic }));
  } else if (intent.kind === "status") {
    tools.push(await runTool(actor, "account_status", {}));
  } else if (intent.kind === "escalate") {
    tools.push(
      await runTool(actor, "escalate_support", {
        subject: intent.subject,
        body: text,
      }),
    );
  } else if (intent.kind === "confirm_transfer") {
    tools.push(await runTool(actor, "request_transfer", { query: text }));
  } else {
    const nav = await runTool(actor, "suggest_navigation", { query: text });
    if (nav.href) tools.push(nav);
    else tools.push(await runTool(actor, "explain_topic", { topic: "assistant" }));
  }

  const toolText = tools.map((t) => t.text).join("\n\n");
  const reply =
    plan?.say && plan.say.trim()
      ? `${plan.say.trim()}\n\n${toolText}`
      : toolText || explainTopic("assistant", snap);

  const source = plan ? "llm+tools" : "deterministic";
  await persist(userId, "assistant", reply, tools[0]?.name, source);

  return {
    reply,
    source,
    llmAvailable: llmAvailable(),
    href: tools.find((t) => t.href)?.href,
    confirmationId: tools.find((t) => t.confirmationId)?.confirmationId,
    tools,
  };
}
