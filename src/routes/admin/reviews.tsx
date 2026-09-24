import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, Panel, EmptyState } from "@/components/ui/field";
import { adminReviewsFn } from "@/lib/banking/admin-api";
import { Badge, txTone } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/reviews")({ component: Reviews });

function Reviews() {
  const q = useQuery({ queryKey: ["admin-reviews"], queryFn: () => adminReviewsFn() });
  const items = [...(q.data?.kyc ?? []), ...(q.data?.credit ?? []), ...(q.data?.other ?? [])];
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Manual review"
        description="Queues owned by the control plane. KYC decisions stay with the banking partner. Credit cannot be approved without an issuer."
      />
      {q.isPending ? <p className="text-sm text-muted">Loading reviews…</p> : null}
      {!q.isPending && items.length === 0 ? (
        <EmptyState
          title="No open reviews"
          body="Identity and credit items appear here when they need a human look — not a local approve button."
        />
      ) : (
        <Panel>
          <ul className="divide-y divide-line text-sm">
            {items.map((item) => (
              <li key={`${item.kind}-${item.id}`} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium capitalize">
                    {item.kind} · {item.status.replaceAll("_", " ")}
                  </p>
                  <p className="mt-1 text-muted">{item.summary}</p>
                  <Link to="/admin/customers/$id" params={{ id: item.userId }} className="mt-2 inline-block text-sm text-lead">
                    Open customer
                  </Link>
                </div>
                <Badge tone={txTone(item.status)}>{item.status.replaceAll("_", " ")}</Badge>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
