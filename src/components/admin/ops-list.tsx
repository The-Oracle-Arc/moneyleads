import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminActFn, adminListFn } from "@/lib/banking/admin-api";
import { PageHeader, EmptyState } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, txTone } from "@/components/ui/badge";
import { formatUsd } from "@/lib/banking/money";
import { toast } from "sonner";

export type OpsColumn = {
  key: string;
  label: string;
  kind?: "text" | "money" | "status" | "date" | "id";
};

export function OpsList({
  resource,
  title,
  description,
  columns,
  actions,
  search,
  customerLink,
  supportLink,
}: {
  resource: string;
  title: string;
  description: string;
  columns: OpsColumn[];
  actions?: { label: string; action: string }[];
  search?: boolean;
  customerLink?: "id" | "user_id";
  supportLink?: boolean;
}) {
  const [query, setQuery] = useState("");
  const q = useQuery({
    queryKey: ["admin", resource, query],
    queryFn: () => adminListFn({ data: { resource, query: query || undefined } }),
  });
  const qc = useQueryClient();
  const rows = q.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Control Center" title={title} description={description} />
      {search ? (
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          aria-label={`Search ${title}`}
        />
      ) : null}
      {q.isPending ? <p className="text-sm text-muted">Loading…</p> : null}
      {q.error ? <p className="text-sm text-danger">Could not load this list. You may not have access.</p> : null}
      {!q.isPending && rows.length === 0 ? (
        <EmptyState title="Nothing here" body="Records appear as customers use the product. Nothing is invented." />
      ) : null}
      {rows.length ? (
        <div className="overflow-x-auto rounded-2xl bg-surface shadow-card">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line text-[11px] uppercase tracking-[0.12em] text-muted">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className="px-4 py-3 font-medium">
                    {c.label}
                  </th>
                ))}
                {actions?.length ? <th className="px-4 py-3">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={String(row.id ?? i)} className="border-b border-line last:border-0">
                  {columns.map((c, ci) => (
                    <td key={c.key} className="max-w-[240px] truncate px-4 py-3 tabular">
                      {ci === 0 && customerLink ? (
                        <Link
                          to="/admin/customers/$id"
                          params={{ id: String(row[customerLink] ?? row.id) }}
                          className="font-medium text-lead"
                        >
                          {formatCell(row[c.key], c.kind)}
                        </Link>
                      ) : ci === 0 && supportLink ? (
                        <Link to="/admin/support/$id" params={{ id: String(row.id) }} className="font-medium text-lead">
                          {formatCell(row[c.key], c.kind)}
                        </Link>
                      ) : (
                        formatCell(row[c.key], c.kind)
                      )}
                    </td>
                  ))}
                  {actions?.length ? (
                    <td className="px-4 py-3">
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
                              else toast.success("Updated");
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

function formatCell(v: unknown, kind?: OpsColumn["kind"]) {
  if (v == null || v === "") return "—";
  if (kind === "money" && (typeof v === "number" || typeof v === "string")) return formatUsd(Number(v));
  if (kind === "status") {
    return <Badge tone={txTone(String(v))}>{String(v).replaceAll("_", " ")}</Badge>;
  }
  if (kind === "date") {
    const d = new Date(String(v));
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
  }
  if (typeof v === "boolean") return v ? "yes" : "no";
  return String(v);
}
