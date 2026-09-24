import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, Panel } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { adminIntegrationsFn } from "@/lib/banking/admin-api";

export const Route = createFileRoute("/admin/integrations")({ component: Integrations });

function Integrations() {
  const q = useQuery({ queryKey: ["admin-integrations"], queryFn: () => adminIntegrationsFn() });
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Control Center"
        title="Integrations"
        description="Modular providers. Missing credentials are stated, never invented. Banking, KYC, and the ledger continue without an LLM."
      />
      <div className="grid gap-3">
        {(q.data?.items ?? []).map((item) => (
          <Panel key={item.id} className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{item.kind}</p>
                <h2 className="mt-1 font-medium text-ink">{item.name}</h2>
              </div>
              <Badge tone={item.requirement ? "warn" : "ok"}>{item.status}</Badge>
            </div>
            <p className="text-sm leading-relaxed text-muted">{item.detail}</p>
            {item.requirement ? <p className="text-sm font-medium text-warn">{item.requirement}</p> : null}
          </Panel>
        ))}
      </div>
      <p className="text-sm text-muted">
        Banking program details live under{" "}
        <Link to="/admin/banking" className="font-medium text-lead">
          Banking Program
        </Link>
        . Webhook events are under{" "}
        <Link to="/admin/webhooks" className="font-medium text-lead">
          Webhooks
        </Link>
        .
      </p>
    </div>
  );
}
