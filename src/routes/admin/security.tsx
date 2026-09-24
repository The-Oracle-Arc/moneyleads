import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, Panel } from "@/components/ui/field";
import { adminSecurityFn } from "@/lib/banking/admin-api";

export const Route = createFileRoute("/admin/security")({ component: SecurityOps });

function SecurityOps() {
  const q = useQuery({ queryKey: ["admin-security"], queryFn: () => adminSecurityFn() });
  const d = q.data;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Control Center"
        title="Security"
        description="Session, device, and access posture from stored records. Privileged actions remain authenticated, authorized, audited, and attributable."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Inactivity lock" value={d ? `${d.lockMinutes} min` : "—"} />
        <Stat label="Active sessions" value={d?.activeSessions ?? "—"} />
        <Stat label="Failed logins (24h)" value={d?.failedLogins24h ?? "—"} />
        <Stat label="Device credentials" value={d?.webauthnCredentials ?? "—"} />
      </div>
      <Panel>
        <p className="text-sm leading-relaxed text-muted">{d?.note}</p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted">
          <li>Staff are invitation-only. Customers cannot claim Control Center access.</li>
          <li>Sending money and security changes require a step-up check.</li>
          <li>Device unlock uses the browser authenticator. MONEYLEAD does not simulate Face ID.</li>
        </ul>
      </Panel>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Panel>
      <p className="text-xs uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="display mt-2 text-3xl tabular">{value}</p>
    </Panel>
  );
}
