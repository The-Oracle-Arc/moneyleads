import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, Panel } from "@/components/ui/field";
import { adminHealthFn } from "@/lib/banking/admin-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/health")({ component: Health });

function Health() {
  const q = useQuery({ queryKey: ["admin-health"], queryFn: () => adminHealthFn() });
  const d = q.data;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Control Center"
        title="System health"
        description="Control-plane view of partner configuration, webhooks, and errors. Operators cannot invent balances from this screen."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <StatusCard
          label="Column"
          state={d?.columnConfigured ? "operational" : "unavailable"}
          detail={d?.columnConfigured ? `${d.environment}` : "Not configured"}
        />
        <StatusCard
          label="Webhook secret"
          state={d?.webhookSecretConfigured ? "operational" : "unavailable"}
          detail={d?.webhookSecretConfigured ? "Set" : "Not set"}
        />
        <StatusCard label="Database" state={d?.database ? "operational" : "error"} detail={d?.database ?? "Unknown"} />
        <StatusCard
          label="Assistant language layer"
          state={d?.xaiConfigured ? "operational" : "unavailable"}
          detail={d?.xaiConfigured ? "Available for phrasing" : "Off — deterministic assistant"}
        />
      </div>
      <Panel className="space-y-2 text-sm">
        <Row k="Product" v={d?.product ?? "MONEYLEAD"} />
        <Row k="Environment" v={d?.environment ?? "—"} />
        <Row k="Failed webhooks" v={String(d?.failedWebhooks ?? "—")} />
        <Row k="Open reconciliation" v={String(d?.openReconciliation ?? "—")} />
        <Row k="Provider errors (24h)" v={String(d?.providerErrors24h ?? "—")} />
        <Row k="Last webhook" v={d?.lastWebhookAt ? `${d.lastWebhookType ?? "event"} · ${d.lastWebhookStatus}` : "None"} />
        <Row k="Debit cards" v="Unavailable (Column public API)" />
        <Row k="Credit issuer" v="Unavailable" />
      </Panel>
    </div>
  );
}

function StatusCard({
  label,
  state,
  detail,
}: {
  label: string;
  state: "operational" | "warning" | "error" | "unavailable";
  detail: string;
}) {
  return (
    <div className="rounded-2xl bg-surface p-5 shadow-card">
      <p className="text-xs uppercase tracking-[0.14em] text-muted">{label}</p>
      <p
        className={cn(
          "mt-2 text-sm font-medium capitalize",
          state === "operational" && "text-ok",
          state === "warning" && "text-warn",
          state === "error" && "text-danger",
          state === "unavailable" && "text-muted",
        )}
      >
        {state}
      </p>
      <p className="mt-1 text-sm text-muted">{detail}</p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line py-2 last:border-0">
      <span className="text-muted">{k}</span>
      <span className="tabular text-ink">{v}</span>
    </div>
  );
}
