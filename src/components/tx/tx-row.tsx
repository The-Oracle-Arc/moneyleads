import { Link } from "@tanstack/react-router";
import { Amount } from "@/components/money/amount";
import { Badge, txTone } from "@/components/ui/badge";
import { formatCustomerTxStatus, groupLabelForDate } from "@/lib/banking/customer-copy";
import type { TransactionView } from "@/lib/banking/types";
import { cn } from "@/lib/utils";

export function TxRow({ tx }: { tx: TransactionView }) {
  const date = tx.createdAt ? new Date(tx.createdAt) : null;
  const initial = (tx.merchant || "?").trim().charAt(0).toUpperCase();
  const inbound = tx.amountCents > 0;
  const showStatus = tx.status !== "posted" && tx.status !== "completed";
  return (
    <Link to="/transactions/$id" params={{ id: tx.id }} className="flex min-h-14 items-center gap-3 py-3">
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-2xl text-sm font-medium",
          inbound ? "bg-ok-soft text-ok" : "bg-paper text-ink",
        )}
      >
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{tx.merchant}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <span className="capitalize">{tx.category.replaceAll("_", " ")}</span>
          <span aria-hidden>·</span>
          <span>{date ? date.toLocaleString("en-US", { month: "short", day: "numeric" }) : ""}</span>
          {showStatus ? <Badge tone={txTone(tx.status)}>{formatCustomerTxStatus(tx.status)}</Badge> : null}
          {tx.isDemonstration ? <Badge tone="warn">Demo</Badge> : null}
        </p>
      </div>
      <Amount cents={tx.amountCents} signed size="sm" />
    </Link>
  );
}

export function TxList({ items }: { items: TransactionView[] }) {
  const groups: { label: string; items: TransactionView[] }[] = [];
  for (const tx of items) {
    const label = groupLabelForDate(tx.createdAt) || "Earlier";
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(tx);
    else groups.push({ label, items: [tx] });
  }
  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.label}>
          <h3 className="px-1 text-xs font-medium uppercase tracking-[0.14em] text-muted">{group.label}</h3>
          <div className="divide-y divide-line">
            {group.items.map((tx) => (
              <TxRow key={tx.id} tx={tx} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
