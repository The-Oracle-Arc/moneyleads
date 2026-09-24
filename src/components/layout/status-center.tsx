import type { StatusItem } from "@/lib/banking/types";
import { cn } from "@/lib/utils";

export function StatusCenter({ items }: { items: StatusItem[] }) {
  return (
    <section className="rounded-xl bg-surface p-5 shadow-card" aria-label="Account setup">
      <p className="text-xs font-medium tracking-[0.14em] text-muted uppercase">Account setup</p>
      <ul className="mt-4 divide-y divide-line">
        {items.map((item) => (
          <li key={item.key} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <span className="text-sm text-ink">{item.label}</span>
            <span
              className={cn(
                "text-sm",
                item.state === "complete" && "text-ok",
                item.state === "pending" && "text-warn",
                item.state === "action" && "text-warn",
                item.state === "not_started" && "text-muted",
                item.state === "blocked" && "text-danger",
              )}
            >
              {item.detail}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
