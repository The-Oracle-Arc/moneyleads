import { TOPICS, type KnowledgeTopic } from "./knowledge.ts";

export type AssistantIntent =
  | { kind: "explain"; topic: KnowledgeTopic }
  | { kind: "escalate"; subject: string }
  | { kind: "confirm_transfer" }
  | { kind: "status" }
  | { kind: "unknown" };

export function matchIntent(text: string): AssistantIntent {
  const q = text.toLowerCase().trim();
  if (!q) return { kind: "unknown" };

  if (
    /\b(escalate|human|agent|representative|talk to (a )?person|real person)\b/.test(q) ||
    /\b(file a (case|ticket)|open a (case|ticket))\b/.test(q)
  ) {
    return { kind: "escalate", subject: text.slice(0, 80) };
  }
  if (/\b(send money|transfer|pay (someone|a friend)|ach (out|to))\b/.test(q) && /\b(send|transfer|pay)\b/.test(q)) {
    return { kind: "confirm_transfer" };
  }
  if (/\b(my (account )?status|where am i|what's going on)\b/.test(q)) {
    return { kind: "status" };
  }

  let best: { topic: KnowledgeTopic; score: number } | null = null;
  for (const topic of TOPICS) {
    let score = 0;
    for (const hint of topic.hints) {
      if (q.includes(hint)) score += hint.length;
    }
    if (score > 0 && (!best || score > best.score)) best = { topic: topic.id, score };
  }
  if (best) return { kind: "explain", topic: best.topic };
  return { kind: "unknown" };
}
