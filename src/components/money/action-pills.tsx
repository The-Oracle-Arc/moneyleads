import type { LucideIcon } from "lucide-react";
import { ArrowDownLeft, ArrowUpRight, Ellipsis, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export type MoneyAction = "send" | "receive" | "add" | "more";

export function ActionPills({
  onAction,
  disabled,
  showMore = true,
}: {
  onAction: (action: MoneyAction) => void;
  disabled?: boolean;
  showMore?: boolean;
}) {
  const items: { id: MoneyAction; label: string; icon: LucideIcon; iconOnly?: boolean }[] = [
    { id: "send", label: "Send", icon: ArrowUpRight },
    { id: "receive", label: "Receive", icon: ArrowDownLeft },
    { id: "add", label: "Add money", icon: Plus },
    ...(showMore ? [{ id: "more" as const, label: "More", icon: Ellipsis, iconOnly: true }] : []),
  ];
  return (
    <div className="flex items-center rounded-full bg-ink p-1.5 text-paper shadow-float">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          disabled={disabled && item.id !== "more"}
          onClick={() => onAction(item.id)}
          className={cn(
            "flex h-12 min-h-12 flex-1 items-center justify-center gap-1.5 rounded-full px-2 text-sm font-medium text-paper transition-transform duration-150 active:scale-[0.97] disabled:opacity-40",
            item.iconOnly && "max-w-14 flex-none",
          )}
          aria-label={item.label}
        >
          <item.icon className="size-4 shrink-0" aria-hidden />
          {item.iconOnly ? null : <span>{item.label}</span>}
        </button>
      ))}
    </div>
  );
}
