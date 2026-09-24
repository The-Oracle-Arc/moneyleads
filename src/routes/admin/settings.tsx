import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader, Panel } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/input";
import { adminActFn, adminSettingsFn } from "@/lib/banking/admin-api";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings")({ component: Settings });

function Settings() {
  const q = useQuery({ queryKey: ["admin-settings"], queryFn: () => adminSettingsFn() });
  const qc = useQueryClient();
  const d = q.data;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="System settings"
        description="Provider credentials are read from server environment variables. They are never sent to the browser."
      />
      <Panel className="space-y-3 text-sm">
        <Row k="Environment" v={d?.environment ?? (d?.demoMode ? "sandbox" : "—")} />
        <Row k="Database" v={d?.database ?? "—"} />
        <Row k="Banking partner" v={d?.bankingConfigured ? "Column" : "Not configured"} />
        <Row k="Webhook secret" v={d?.webhookSecretConfigured ? "Set" : "Not set"} />
        <Row k="Providers" v={d?.usingMocks ? "Fail-closed (no Column key)" : "Column connected"} />
        {d
          ? Object.entries(d.providers).map(([k, v]) => <Row key={k} k={k} v={v} />)
          : null}
        <p className="text-muted">
          Provider credentials are read from server environment variables only. Add them on the published project:
          Settings → Environment Variables. Mark banking-partner credentials as Sensitive. Do not prefix names with VITE_.
          Redeploy after saving. Do not paste secrets in chat or source.
        </p>
        <p className="text-muted">
          A language model is never used for identity, balances, transfers, credit, or support answers.
        </p>
        <p className="text-muted">Do not paste production secrets into source control. The platform injects them at runtime.</p>
      </Panel>
      <Panel className="space-y-3">
        <h2 className="font-medium">Staff roles</h2>
        <p className="text-sm text-muted">
          viewer reads only. support closes cases. ops and risk review partner-owned account status. compliance reviews
          Column identity status. admin can assign roles. Identity and freeze decisions are not made locally.
        </p>
        {d?.staff.map((s) => (
          <StaffRow
            key={s.userId}
            userId={s.userId}
            role={s.role}
            onSaved={async () => {
              await qc.invalidateQueries({ queryKey: ["admin-settings"] });
            }}
          />
        ))}
      </Panel>
    </div>
  );
}

function StaffRow({
  userId,
  role,
  onSaved,
}: {
  userId: string;
  role: string;
  onSaved: () => Promise<void>;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-line py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <p className="break-all text-sm tabular">{userId}</p>
      <div className="flex items-center gap-2">
        <NativeSelect
          key={role}
          defaultValue={role}
          aria-label={`Role for ${userId}`}
          className="sm:w-44"
          onChange={async (e) => {
            const r = await adminActFn({
              data: { action: "staff.setRole", entityId: userId, note: e.target.value },
            });
            if (!r.ok) toast.error(r.error);
            else toast.success("Role updated");
            await onSaved();
          }}
        >
          <option value="viewer">viewer</option>
          <option value="support">support</option>
          <option value="ops">ops</option>
          <option value="risk">risk</option>
          <option value="compliance">compliance</option>
          <option value="admin">admin</option>
        </NativeSelect>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line py-2 last:border-0">
      <span className="capitalize text-muted">{k}</span>
      <span className="tabular text-ink">{v}</span>
    </div>
  );
}
