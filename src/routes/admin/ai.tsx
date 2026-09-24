import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, Panel } from "@/components/ui/field";
import { adminAiFn } from "@/lib/banking/admin-api";

export const Route = createFileRoute("/admin/ai")({ component: AiSystem });

function AiSystem() {
  const q = useQuery({ queryKey: ["admin-ai"], queryFn: () => adminAiFn() });
  const d = q.data;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Control Center"
        title="AI / System"
        description="The language layer is optional. MONEYLEAD CORE — authentication, banking, ledger, KYC, risk, and audit — does not depend on an LLM vendor."
      />
      <Panel className="space-y-3 text-sm">
        <Row k="Language provider" v={d?.configured ? d.label : "Not configured"} />
        <Row k="Assistant without AI" v="Deterministic tools remain available" />
        <Row k="Banking source of truth" v="Backend, database, and banking-partner APIs" />
      </Panel>
      {!d?.configured ? (
        <Panel>
          <p className="text-sm font-medium text-ink">AI provider configuration required.</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {d?.requiredMessage ??
              "Natural-language phrasing needs an optional AI provider as a server environment variable. MONEYLEAD is not coupled to a single vendor. Configure AI_PROVIDER plus the matching server key, or leave it unset. The rest of the platform continues to operate."}
          </p>
        </Panel>
      ) : (
        <Panel>
          <p className="text-sm leading-relaxed text-muted">
            A language provider is configured for phrasing only. It cannot change balances, approve KYC, move money, or
            bypass authorization.
          </p>
        </Panel>
      )}
      <Panel>
        <p className="text-sm leading-relaxed text-muted">
          {d?.note} High-risk actions still require explicit confirmation from an authorized person.
        </p>
      </Panel>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line py-2 last:border-0">
      <span className="text-muted">{k}</span>
      <span className="text-right text-ink">{v}</span>
    </div>
  );
}
