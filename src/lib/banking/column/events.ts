export type ColumnEventKind = "identity" | "account" | "transfer" | "ignored";

const TRANSFER_PREFIXES = ["ach.outgoing_transfer.", "ach.incoming_transfer.", "book.transfer."] as const;

/** Classify only documented Column webhook types. Unknown types are ignored, never guessed. */
export function classifyColumnEventType(type: string | undefined | null): ColumnEventKind {
  const t = (type ?? "").toLowerCase();
  if (t.startsWith("identity.")) return "identity";
  if (t.startsWith("account.")) return "account";
  if (TRANSFER_PREFIXES.some((prefix) => t.startsWith(prefix))) return "transfer";
  return "ignored";
}
