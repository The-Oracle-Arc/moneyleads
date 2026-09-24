import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { adminHealthFn, adminOverviewFn } from "@/lib/banking/admin-api";
import { PageHeader, Panel } from "@/components/ui/field";
import { formatUsd } from "@/lib/banking/money";
import { SOFTWARE_STATUS, SOFTWARE_STATUS_LINE } from "@/lib/banking/program";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/")({ component: AdminHome });

function AdminHome() {
  const q = useQuery({ queryKey: ["admin-overview"], queryFn: () => adminOverviewFn() });
  const health = useQuery({ queryKey: ["admin-health"], queryFn: () => adminHealthFn() });
  const d = q.data;
  const h = health.data;
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Control Center"
        title="Overview"
        description="Internal MONEYLEAD console. Identity and balances come from the banking partner when connected."
      />
      <Panel>
        <p className="text-xs uppercase tracking-[0.14em] text-muted">Software</p>
        <p className="mt-2 text-lg font-semibold text-ink">{SOFTWARE_STATUS}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">{SOFTWARE_STATUS_LINE}</p>
      </Panel>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Customers" value={d?.customers} to="/admin/customers" />
        <Stat label="Verified" value={d?.verifiedUsers} to="/admin/kyc" />
        <Stat label="Pending verification" value={d?.pendingVerification} to="/admin/kyc" />
        <Stat label="Active accounts" value={d?.openAccounts} to="/admin/accounts" />
        <Stat label="Pending accounts" value={d?.pendingAccounts} to="/admin/accounts" />
        <Stat label="Transfers today" value={d?.transfersToday} to="/admin/transfers" />
        <Stat label="Failed transfers" value={d?.failedTransfers} to="/admin/transfers" />
        <Stat label="Flagged activity" value={d?.openFraud} to="/admin/fraud" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Panel>
          <p className="text-xs uppercase tracking-[0.14em] text-muted">ACH volume today</p>
          <p className="display mt-2 text-3xl tabular">{d ? formatUsd(d.achVolumeTodayCents) : "—"}</p>
        </Panel>
        <Panel>
          <p className="text-xs uppercase tracking-[0.14em] text-muted">Support open</p>
          <p className="display mt-2 text-3xl tabular">{d?.openSupport ?? "—"}</p>
        </Panel>
      </div>
      <Panel>
        <h2 className="font-medium">Provider status</h2>
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <HealthRow label="Column" state={h?.columnConfigured ? "operational" : "unavailable"} detail={h?.columnConfigured ? "Connected" : "Not configured"} />
          <HealthRow label="KYC provider" state={h?.columnConfigured ? "operational" : "unavailable"} detail={d?.providers.kyc ?? "—"} />
          <HealthRow label="Email / SMS" state={h?.emailProviderConfigured ? "operational" : "warning"} detail={h?.emailProviderConfigured ? "Connected" : "Not configured — codes are not delivered off-device"} />
          <HealthRow
            label="Database"
            state={h?.database ? "operational" : "error"}
            detail={h?.database ?? "Unknown"}
          />
          <HealthRow
            label="Webhook processing"
            state={!h?.webhookSecretConfigured ? "unavailable" : (h.failedWebhooks ?? 0) > 0 ? "warning" : "operational"}
            detail={!h?.webhookSecretConfigured ? "Secret not set" : `${h.failedWebhooks} failed`}
          />
          <HealthRow label="Debit cards" state="unavailable" detail="Column public API does not issue consumer debit" />
          <HealthRow label="Credit issuer" state="unavailable" detail="None connected" />
          <HealthRow
            label="Reconciliation"
            state={(h?.openReconciliation ?? 0) > 0 ? "warning" : "operational"}
            detail={`${h?.openReconciliation ?? 0} open`}
          />
        </ul>
      </Panel>
    </div>
  );
}

function Stat({
  label,
  value,
  to,
}: {
  label: string;
  value?: number;
  to: "/admin/customers" | "/admin/kyc" | "/admin/accounts" | "/admin/transfers" | "/admin/fraud";
}) {
  return (
    <Link to={to} className="rounded-2xl bg-surface p-4 shadow-card">
      <p className="text-xs uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-2 display text-3xl tabular">{value ?? "—"}</p>
    </Link>
  );
}

function HealthRow({
  label,
  state,
  detail,
}: {
  label: string;
  state: "operational" | "warning" | "error" | "unavailable";
  detail: string;
}) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-0">
      <span className="flex items-center gap-2 text-muted">
        <span
          className={cn(
            "size-2 rounded-full",
            state === "operational" && "bg-ok",
            state === "warning" && "bg-warn",
            state === "error" && "bg-danger",
            state === "unavailable" && "bg-subtle",
          )}
        />
        {label}
      </span>
      <span className="truncate text-right tabular capitalize text-ink">{detail}</span>
    </li>
  );
}
