import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, Panel, EmptyState } from "@/components/ui/field";
import { Amount } from "@/components/money/amount";
import { adminStatementsFn } from "@/lib/banking/admin-api";

export const Route = createFileRoute("/admin/statements")({ component: AdminStatements });

function AdminStatements() {
  const q = useQuery({ queryKey: ["admin-statements"], queryFn: () => adminStatementsFn() });
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Control Center"
        title="Statements"
        description="Generated statements of account from stored customer records. Dates remain the original source dates."
      />
      <Panel>
        {q.data?.length ? (
          <ul className="divide-y divide-line text-sm">
            {q.data.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-muted">
                    {s.moneyleadUserId ?? "—"} · {s.periodStart} – {s.periodEnd}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted">Closing</p>
                  <Amount cents={s.closingCents} size="sm" />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No statements generated" body="Statements appear after a customer generates a period from stored activity." />
        )}
      </Panel>
    </div>
  );
}
