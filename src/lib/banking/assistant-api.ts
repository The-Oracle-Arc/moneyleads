import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { loadHistory, runAssistantTurn } from "./assistant/run";
import { llmAvailable } from "./assistant/llm";
import { listConfirmations, resolveConfirmation } from "./control-plane";
import { loadFeatureFlags } from "./engine";

export const assistantHistoryFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const messages = await loadHistory(context.userId);
    return { messages, llmAvailable: llmAvailable() };
  });

export const assistantAskFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { message: string }) => input)
  .handler(async ({ context, data }) => {
    const flags = await loadFeatureFlags();
    if (!flags.assistantEnabled) {
      return {
        reply: "The MONEYLEAD Assistant is turned off. Banking still works — use Support for help.",
        source: "deterministic" as const,
        llmAvailable: false,
        tools: [],
      };
    }
    return runAssistantTurn(context.userId, data.message);
  });


export const assistantConfirmationsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) =>
    listConfirmations({ kind: "assistant", userId: context.userId }),
  );

export const assistantResolveFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; decision: "confirm" | "deny" }) => input)
  .handler(async ({ context, data }) =>
    resolveConfirmation({ kind: "customer", userId: context.userId }, data.id, data.decision),
  );
