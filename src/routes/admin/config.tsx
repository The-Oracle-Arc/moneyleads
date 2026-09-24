import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader, Panel } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminBankingFn, adminConfigFn, adminUpdateConfigFn } from "@/lib/banking/admin-api";
import {
  PROGRAM_CAPABILITIES,
  PROGRAM_PRODUCTION_NOTE,
  PROGRAM_SUMMARY,
} from "@/lib/banking/program";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/admin/config")({ component: Config });

function Config() {
  const q = useQuery({ queryKey: ["admin-config"], queryFn: () => adminConfigFn() });
  const banking = useQuery({ queryKey: ["admin-banking"], queryFn: () => adminBankingFn() });
  const qc = useQueryClient();
  const d = banking.data;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Control Center"
        title="Configuration"
        description="Non-secret policy values. Banking-partner credentials cannot be stored or changed here."
      />
      <Panel className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium tracking-[0.16em] text-muted uppercase">Banking</p>
            <h2 className="mt-1 font-medium">Banking Program</h2>
          </div>
          <Link to="/admin/banking" className="text-sm font-medium text-lead">
            Open
          </Link>
        </div>
        <p className="text-sm leading-relaxed text-muted">{PROGRAM_SUMMARY}</p>
        <dl className="grid gap-3 sm:grid-cols-3">
          <MiniStat label="Status" value={d?.programStatus ?? "Preparing for Banking Program"} />
          <MiniStat label="Current environment" value={d?.environmentLabel ?? "Column Sandbox"} />
          <MiniStat label="Production status" value={d?.productionStatus ?? "Pending banking-partner onboarding"} />
        </dl>
        <div>
          <p className="text-sm font-medium">Banking capabilities being prepared</p>
          <ul className="mt-2 grid gap-1.5 text-sm text-muted sm:grid-cols-2">
            {(d?.capabilities ?? PROGRAM_CAPABILITIES).map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-lead" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm leading-relaxed text-muted">{d?.productionNote ?? PROGRAM_PRODUCTION_NOTE}</p>
      </Panel>
      <Panel className="space-y-4">
        <div>
          <p className="text-[11px] font-medium tracking-[0.16em] text-muted uppercase">KYC</p>
          <h2 className="mt-1 font-medium">KYC review SLA</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Every submitted application receives a review deadline. Deadline expiry escalates the case. The KYC Agent
            never auto-approves unless this policy is explicitly enabled.
          </p>
        </div>
        {(q.data ?? [])
          .filter((row) => row.key === "kyc_sla_hours" || row.key === "kyc_auto_approval_enabled")
          .map((row) => (
            <ConfigRow
              key={`kyc-${row.key}`}
              row={row}
              onSaved={async () => {
                await qc.invalidateQueries({ queryKey: ["admin-config"] });
              }}
            />
          ))}
      </Panel>
      <Panel className="space-y-4">
        {(q.data ?? []).map((row) => (
          <ConfigRow
            key={row.key}
            row={row}
            onSaved={async () => {
              await qc.invalidateQueries({ queryKey: ["admin-config"] });
            }}
          />
        ))}
      </Panel>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-paper px-4 py-3">
      <p className="text-[11px] font-medium tracking-[0.14em] text-muted uppercase">{label}</p>
      <p className="mt-1 text-sm font-medium text-ink">{value}</p>
    </div>
  );
}

function ConfigRow({
  row,
  onSaved,
}: {
  row: { key: string; value: string; updatedAt: string };
  onSaved: () => Promise<void>;
}) {
  const [value, setValue] = useState(row.value);
  const locked =
    row.key === "debit_cards_issued" ||
    row.key === "credit_issuer" ||
    row.key === "banking_program_status" ||
    row.key === "production_banking_status" ||
    /key|secret|token|password/i.test(row.key);
  return (
    <div className="border-b border-line py-3 last:border-0">
      <p className="text-sm font-medium">{row.key.replaceAll("_", " ")}</p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <Input value={value} onChange={(e) => setValue(e.target.value)} disabled={locked} />
        <Button
          variant="secondary"
          disabled={locked}
          onClick={async () => {
            const r = await adminUpdateConfigFn({ data: { key: row.key, value } });
            if (!r.ok) toast.error(r.error);
            else toast.success("Saved");
            await onSaved();
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
