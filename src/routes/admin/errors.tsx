import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, EmptyState } from "@/components/ui/field";
import { adminErrorsFn } from "@/lib/banking/admin-api";

export const Route = createFileRoute("/admin/errors")({ component: Errors });

function Errors() {
  const q = useQuery({ queryKey: ["admin-errors"], queryFn: () => adminErrorsFn() });
  const rows = q.data ?? [];
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Provider errors"
        description="Sanitized banking-partner failures. Secrets are never stored."
      />
      {rows.length === 0 ? (
        <EmptyState title="No recorded partner errors" body="Column failures will appear here after the control plane logs them." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-[0.12em] text-muted">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Operation</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Message</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line">
                  <td className="px-3 py-2 tabular text-muted">{r.createdAt.slice(0, 19).replace("T", " ")}</td>
                  <td className="px-3 py-2">{r.operation}</td>
                  <td className="px-3 py-2 tabular">{r.httpStatus ?? "—"}</td>
                  <td className="px-3 py-2">{r.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
