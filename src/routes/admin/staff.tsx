import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader, Panel, Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { adminActFn, adminStaffFn } from "@/lib/banking/admin-api";
import { formatStaffRole, STAFF_ROLES } from "@/lib/banking/types";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/staff")({ component: Staff });

function Staff() {
  const q = useQuery({ queryKey: ["admin-staff"], queryFn: () => adminStaffFn() });
  const qc = useQueryClient();
  const d = q.data;
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Control Center"
        title="Staff"
        description="Invitation-only. Customers cannot claim operator access. Roles are assigned after sign-in from the authenticated email."
      />
      <Panel className="space-y-2 text-sm">
        <Row k="Ultimate Administrator" v={d?.ultimateAdminEmail ?? "coltonhogan444@gmail.com"} />
        <Row
          k="Activation"
          v={
            d?.designations?.find((x) => x.role === "ultimate_admin" && x.status === "active")
              ? "Active — signed in"
              : "Pending first sign-in. Sign in with that email. MONEYLEAD does not invent passwords."
          }
        />
        <Row
          k="Email provider"
          v={d?.emailProviderConfigured ? "Configured" : "Administrator email provider required."}
        />
        {!d?.emailProviderConfigured ? (
          <p className="text-muted">
            Staff designations are stored. Invite emails cannot be sent until an email provider is configured as a
            server environment variable. Do not invent credentials.
          </p>
        ) : null}
      </Panel>
      <Panel className="space-y-3">
        <h2 className="font-medium">Invite staff</h2>
        <p className="text-sm text-muted">
          They establish their own sign-in with this email. There is no public staff registration.
        </p>
        <Field label="Email" htmlFor="staff-email">
          <Input id="staff-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Role" htmlFor="staff-role">
          <NativeSelect id="staff-role" value={role} onChange={(e) => setRole(e.target.value)}>
            {STAFF_ROLES.filter((r) => r !== "ultimate_admin").map((r) => (
              <option key={r} value={r}>
                {formatStaffRole(r)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Button
          onClick={async () => {
            if (!email.trim()) return;
            const r = await adminActFn({ data: { action: "staff.invite", entityId: email, note: role } });
            if (!r.ok) toast.error(r.error);
            else toast.message("notice" in r && r.notice ? String(r.notice) : "Staff designation stored");
            setEmail("");
            await qc.invalidateQueries({ queryKey: ["admin-staff"] });
          }}
        >
          Invite
        </Button>
      </Panel>
      <Panel className="space-y-3">
        <h2 className="font-medium">Designations</h2>
        {(d?.designations ?? []).map((row) => (
          <div key={row.email} className="flex flex-col gap-2 border-b border-line py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">{row.email}</p>
              <p className="text-xs text-muted">
                {formatStaffRole(row.role)} · {row.status.replaceAll("_", " ")}
                {row.userId ? " · linked" : " · awaiting sign-in"}
              </p>
            </div>
            {row.role !== "ultimate_admin" ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  if (!window.confirm(`Revoke staff access for ${row.email}? This immediately removes operator permissions.`)) return;
                  const r = await adminActFn({ data: { action: "staff.revoke", entityId: row.email } });
                  if (!r.ok) toast.error(r.error);
                  else toast.success("Access revoked");
                  await qc.invalidateQueries({ queryKey: ["admin-staff"] });
                }}
              >
                Revoke
              </Button>
            ) : null}
          </div>
        ))}
      </Panel>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line py-2 last:border-0">
      <span className="text-muted">{k}</span>
      <span className="max-w-xs text-right text-ink">{v}</span>
    </div>
  );
}
