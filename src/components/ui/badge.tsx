import { cn } from "@/lib/utils";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "danger" | "pending";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
        tone === "neutral" && "bg-paper text-muted",
        tone === "ok" && "bg-ok-soft text-ok",
        tone === "warn" && "bg-warn-soft text-warn",
        tone === "danger" && "bg-danger-soft text-danger",
        tone === "pending" && "bg-lead-soft text-lead",
      )}
    >
      {children}
    </span>
  );
}

export function txTone(status: string) {
  if (status === "posted" || status === "refunded" || status === "completed") return "ok" as const;
  if (status === "pending" || status === "processing") return "pending" as const;
  if (status === "failed" || status === "disputed") return "danger" as const;
  return "neutral" as const;
}
