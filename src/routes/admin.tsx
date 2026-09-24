import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Logo } from "@/components/brand/logo";
import { DemoBanner } from "@/components/layout/demo-banner";
import { useWorkspace } from "@/hooks/use-workspace";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { ULTIMATE_ADMIN_EMAIL } from "@/lib/banking/program";
import { cn } from "@/lib/utils";
import { SessionLock } from "@/components/security/session-lock";

export const Route = createFileRoute("/admin")({ component: AdminLayout });

type NavItem = { to: string; label: string };
type NavGroup = { label: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { to: "/admin", label: "Overview" },
      { to: "/admin/health", label: "System health" },
    ],
  },
  {
    label: "People",
    items: [
      { to: "/admin/customers", label: "Customers" },
      { to: "/admin/kyc", label: "KYC" },
      { to: "/admin/applications", label: "Applications" },
      { to: "/admin/reviews", label: "Manual review" },
    ],
  },
  {
    label: "Money",
    items: [
      { to: "/admin/accounts", label: "Accounts" },
      { to: "/admin/transactions", label: "Transactions" },
      { to: "/admin/transfers", label: "Transfers" },
      { to: "/admin/ach", label: "ACH" },
      { to: "/admin/credit", label: "Credit" },
      { to: "/admin/cards", label: "Cards" },
      { to: "/admin/creditCards", label: "Credit cards" },
    ],
  },
  {
    label: "Risk",
    items: [
      { to: "/admin/fraud", label: "Fraud / risk" },
      { to: "/admin/disputes", label: "Disputes" },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/admin/support", label: "Support" },
      { to: "/admin/statements", label: "Statements" },
      { to: "/admin/history", label: "Historical data" },
      { to: "/admin/notifications", label: "Notifications" },
      { to: "/admin/webhooks", label: "Webhooks" },
      { to: "/admin/integrations", label: "Integrations" },
      { to: "/admin/reconciliation", label: "Reconciliation" },
      { to: "/admin/errors", label: "Provider errors" },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/admin/audit", label: "Audit logs" },
      { to: "/admin/banking", label: "Banking Program" },
      { to: "/admin/config", label: "Configuration" },
      { to: "/admin/flags", label: "Feature flags" },
      { to: "/admin/ai", label: "AI / System" },
      { to: "/admin/agents", label: "Agents" },
      { to: "/admin/security", label: "Security" },
      { to: "/admin/staff", label: "Staff" },
      { to: "/admin/roles", label: "Roles & Permissions" },
      { to: "/admin/settings", label: "Settings" },
    ],
  },
];

const FLAT = NAV.flatMap((g) => g.items);


function AdminLayout() {
  const { user, authPending, data, isPending } = useWorkspace();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  if (authPending || isPending) return <div className="p-8 text-sm text-muted">Loading operations…</div>;
  if (!user) return <RedirectToSignIn />;
  if (!data?.staffRole) {
    return (
      <div className="min-h-dvh bg-paper">
        <DemoBanner />
        <main className="mx-auto max-w-md space-y-4 px-5 py-16">
          <Logo />
          <h1 className="display text-3xl">MONEYLEAD Control Center</h1>
          <p className="text-sm leading-relaxed text-muted">
            Staff access is invitation-only. Sign in with a designated staff email. The Ultimate Administrator is{" "}
            {ULTIMATE_ADMIN_EMAIL}. Customers cannot claim operator access.
          </p>
          <p className="text-sm leading-relaxed text-muted">
            After you sign in with a designated email, MONEYLEAD assigns the role from authorization records. Roles are
            never chosen on the sign-in screen.
          </p>
          <Link to="/home" className="block text-sm text-lead">
            Back to app
          </Link>
        </main>
      </div>
    );
  }
  return (
    <div className="min-h-dvh bg-paper">
      <DemoBanner />
      <div className="flex">
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 overflow-y-auto border-r border-line bg-surface/60 p-5 md:block">
          <Logo />
          <p className="mt-5 text-[11px] font-semibold tracking-[0.18em] text-lead">CONTROL CENTER</p>
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-muted">{data.staffRole.replaceAll("_", " ")}</p>
          <nav className="mt-5 space-y-4">
            {NAV.map((group) => (
              <div key={group.label}>
                <p className="px-2 text-xs font-medium uppercase tracking-[0.16em] text-subtle">{group.label}</p>
                <div className="mt-1 flex flex-col gap-0.5">
                  {group.items.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to as "/admin"}
                      className={cn(
                        "rounded-lg px-2.5 py-2 text-sm transition-colors",
                        pathname === item.to ? "bg-lead-soft font-medium text-lead" : "text-muted hover:bg-paper hover:text-ink",
                      )}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
          <Link to="/home" className="mt-6 block px-2 text-sm text-lead">
            Customer app
          </Link>
        </aside>
        <div className="min-w-0 flex-1">
          <div className="border-b border-line p-3 md:hidden">
            <label className="sr-only" htmlFor="admin-nav">
              Control Center section
            </label>
            <select
              id="admin-nav"
              className="h-12 w-full rounded-full bg-surface px-4 text-sm shadow-card"
              value={FLAT.some((item) => item.to === pathname) ? pathname : "/admin"}
              onChange={(e) => navigate({ to: e.target.value as "/admin" })}
            >
              {NAV.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.items.map((item) => (
                    <option key={item.to} value={item.to}>
                      {item.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="p-4 md:p-8">
            <Outlet />
          </div>
        </div>
      </div>
      <SessionLock enabled={Boolean(data.profile?.passcodeSet)} />
    </div>
  );
}
