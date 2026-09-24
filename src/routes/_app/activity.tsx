import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { TxList } from "@/components/tx/tx-row";
import { useQuery } from "@tanstack/react-query";
import { listTransactionsFn } from "@/lib/banking/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/activity")({ component: Activity });

const FILTERS = [
  { id: "", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "posted", label: "Completed" },
  { id: "failed", label: "Failed" },
] as const;

function Activity() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const tx = useQuery({
    queryKey: ["tx", q, status],
    queryFn: () => listTransactionsFn({ data: { query: q || undefined, status: status || undefined } }),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Activity" description="Every payment, deposit, and transfer in one place." />
      <Input placeholder="Search merchant, amount, or note" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search transactions" />
      <div className="flex gap-2 overflow-x-auto">
        {FILTERS.map((s) => (
          <button
            key={s.id || "all"}
            type="button"
            onClick={() => setStatus(s.id)}
            className={cn(
              "h-10 shrink-0 rounded-full px-4 text-sm font-medium",
              status === s.id ? "bg-ink text-paper" : "bg-surface text-muted shadow-card",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      {tx.isPending ? (
        <p className="py-8 text-center text-sm text-muted">Retrieving transactions…</p>
      ) : tx.isError ? (
        <p className="text-sm text-danger">We couldn't load your activity. Please try again.</p>
      ) : tx.data?.length ? (
        <TxList items={tx.data} />
      ) : (
        <EmptyState title="No transactions yet" body="Your transactions will appear here once activity begins." />
      )}
    </div>
  );
}
