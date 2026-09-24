import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, Panel } from "@/components/ui/field";
import { adminBankingFn } from "@/lib/banking/admin-api";
import { PROGRAM_CAPABILITIES, PROGRAM_PRODUCTION_NOTE, PROGRAM_SUMMARY } from "@/lib/banking/program";

export const Route = createFileRoute("/admin/banking")({ component: BankingProgram });

function BankingProgram() {
  const q = useQuery({ queryKey: ["admin-banking"], queryFn: () => adminBankingFn() });
  const d = q.data;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Control Center"
        title="Banking Program"
        description={PROGRAM_SUMMARY}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Status" value={d?.programStatus ?? "Preparing for Banking Program"} />
        <Stat label="Current environment" value={d?.environmentLabel ?? "Column Sandbox"} />
        <Stat label="Production status" value={d?.productionStatus ?? "Pending banking-partner onboarding"} />
      </div>
      <Panel className="space-y-3">
        <h2 className="font-medium">Banking capabilities being prepared</h2>
        <ul className="grid gap-2 text-sm text-muted sm:grid-cols-2">
          {(d?.capabilities ?? PROGRAM_CAPABILITIES).map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-lead" />
              {item}
            </li>
          ))}
        </ul>
      </Panel>
      <Panel>
        <p className="text-sm leading-relaxed text-muted">
          {d?.productionNote ?? PROGRAM_PRODUCTION_NOTE}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Column remains the current banking infrastructure when a server credential is present. Credentials stay
          server-side. Fail-closed behavior is unchanged: missing partner access does not invent accounts, balances, or
          approvals.
        </p>
        {d?.statusLine ? <p className="mt-3 text-xs leading-relaxed text-subtle">{d.statusLine}</p> : null}
      </Panel>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface p-5 shadow-card">
      <p className="text-[11px] font-medium tracking-[0.16em] text-muted uppercase">{label}</p>
      <p className="mt-2 text-sm font-medium leading-relaxed text-ink">{value}</p>
    </div>
  );
}
