import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/ui/field";
import { ROLE_CAPABILITIES, ROLE_LABELS, STAFF_ROLES, type StaffRole } from "@/lib/banking/types";
import { ULTIMATE_ADMIN_EMAIL } from "@/lib/banking/program";

export const Route = createFileRoute("/admin/roles")({ component: Roles });

const DISPLAY_ROLES: StaffRole[] = STAFF_ROLES.filter((r) => r !== "viewer");

function Roles() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Control Center"
        title="Roles & Permissions"
        description="Least privilege. Roles are assigned from authorization records after sign-in. Customers cannot choose or claim a staff role."
      />
      <Panel className="space-y-2 text-sm">
        <p>
          Ultimate Administrator: <span className="font-medium text-ink">{ULTIMATE_ADMIN_EMAIL}</span>
        </p>
        <p className="text-muted">
          Viewer can read Control Center records but cannot mutate. Partner KYC approve/fail is blocked for every role —
          Column remains the source of truth for identity used to open accounts.
        </p>
      </Panel>
      <Panel className="space-y-3">
        <h2 className="font-medium">Role catalog</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {STAFF_ROLES.map((role) => (
            <li key={role} className="rounded-xl bg-paper px-4 py-3 text-sm">
              <p className="font-medium text-ink">{ROLE_LABELS[role]}</p>
              <p className="text-xs text-muted">{role}</p>
            </li>
          ))}
        </ul>
      </Panel>
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <table className="min-w-[720px] w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-[0.12em] text-muted">
              <th className="py-3 pr-3 font-medium">Action</th>
              {DISPLAY_ROLES.map((role) => (
                <th key={role} className="px-1 py-3 font-medium">
                  {ROLE_LABELS[role].split(" ")[0]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROLE_CAPABILITIES.map((cap) => (
              <tr key={cap.id} className="border-b border-line">
                <td className="py-3 pr-3 text-ink">{cap.label}</td>
                {DISPLAY_ROLES.map((role) => (
                  <td key={role} className="px-1 py-3 text-center text-muted">
                    {cap.roles.includes(role) ? <span className="text-lead">Yes</span> : "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
