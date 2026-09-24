import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminActFn, adminListFn } from "@/lib/banking/admin-api";
import { PageHeader, EmptyState } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ResourceTable({
  resource,
  title,
  description,
  actions,
}: {
  resource: string;
  title: string;
  description: string;
  actions?: { label: string; action: string }[];
}) {
  const q = useQuery({
    queryKey: ["admin", resource],
    queryFn: () => adminListFn({ data: { resource } }),
  });
  const qc = useQueryClient();
  const rows = q.data ?? [];
  const keys = rows[0] ? Object.keys(rows[0]).slice(0, 8) : [];
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Operations" title={title} description={description} />
      {q.isPending ? <p className="text-sm text-muted">Loading…</p> : null}
      {q.error ? (
        <p className="text-sm text-danger">Could not load this list. You may not have access.</p>
      ) : null}
      {!q.isPending && rows.length === 0 ? (
        <EmptyState title="Nothing here" body="Records will appear as customers use the product." />
      ) : null}
      {rows.length ? (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-[0.12em] text-muted">
              <tr>
                {keys.map((k) => (
                  <th key={k} className="px-3 py-3 font-medium">
                    {k.replaceAll("_", " ")}
                  </th>
                ))}
                {actions?.length ? <th className="px-3 py-3">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={String(row.id ?? i)} className="border-b border-line last:border-0">
                  {keys.map((k) => (
                    <td key={k} className="max-w-[220px] truncate px-3 py-2 tabular">
                      {formatCell(row[k])}
                    </td>
                  ))}
                  {actions?.length ? (
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {actions.map((a) => (
                          <Button
                            key={a.action}
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              const r = await adminActFn({
                                data: { action: a.action, entityId: String(row.id) },
                              });
                              if (!r.ok) toast.error(r.error);
                              else toast.success("Record updated");
                              await qc.invalidateQueries({ queryKey: ["admin", resource] });
                            }}
                          >
                            {a.label}
                          </Button>
                        ))}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function formatCell(v: unknown) {
  if (v == null) return "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  return String(v);
}
