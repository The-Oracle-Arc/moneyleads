import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

type AppPath =
  | "/bank/transfers"
  | "/bank/send"
  | "/bank/add"
  | "/bank/receive"
  | "/bank/details"
  | "/bank/statements"
  | "/assistant"
  | "/support"
  | "/cards"
  | "/cards/apply"
  | "/cards/debit"
  | "/cards/credit";

export function ActionGrid({
  actions,
}: {
  actions: { to?: AppPath; onClick?: () => void; label: string; icon: LucideIcon; disabled?: boolean }[];
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {actions.map((action) => {
        const inner = (
          <>
            <span className="flex size-14 items-center justify-center rounded-full bg-surface text-ink shadow-card">
              <action.icon className="size-5" aria-hidden />
            </span>
            <span className="text-[11px] font-medium text-ink">{action.label}</span>
          </>
        );
        if (action.disabled) {
          return (
            <div key={action.label} className="flex min-h-16 flex-col items-center justify-center gap-2 opacity-40">
              {inner}
            </div>
          );
        }
        if (action.to) {
          return (
            <Link key={action.label} to={action.to} className="flex min-h-16 flex-col items-center justify-center gap-2 active:scale-[0.96]">
              {inner}
            </Link>
          );
        }
        return (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            className="flex min-h-16 flex-col items-center justify-center gap-2 active:scale-[0.96]"
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
}
