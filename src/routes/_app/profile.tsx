import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/ui/field";
import { useWorkspace } from "@/hooks/use-workspace";
import { signOut } from "@/lib/auth/client";
import { visibleLast4 } from "@/lib/banking/money";
import { PROGRAM_SUMMARY, programStatusLine } from "@/lib/banking/program";

export const Route = createFileRoute("/_app/profile")({ component: Profile });

function Profile() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/profile") return <Outlet />;
  return <ProfileHome />;
}

function ProfileHome() {
  const { data, user } = useWorkspace();
  const p = data?.profile;
  const preferred = p?.preferredName || p?.legalFirstName;
  const legal = [p?.legalFirstName, p?.legalLastName].filter(Boolean).join(" ");
  const name = preferred || user?.displayName || "You";
  const last4 = visibleLast4(data?.checking?.accountNumberMasked);
  return (
    <div className="space-y-6">
      <PageHeader title="Profile" />
      <Panel className="flex items-center gap-4">
        <span className="flex size-14 items-center justify-center rounded-full bg-ink text-lg font-medium text-paper">
          {name.charAt(0).toUpperCase()}
        </span>
        <div>
          <p className="font-semibold">{name}</p>
          {legal && legal !== name ? <p className="text-xs text-subtle">Legal name used on statements</p> : null}
          <p className="text-sm text-muted">{p?.email ?? user?.primaryEmail}</p>
          {p?.username ? <p className="text-sm text-muted">@{p.username}</p> : null}
          {p?.moneyleadUserId ? <p className="mt-1 font-mono text-xs text-subtle">{p.moneyleadUserId}</p> : null}
        </div>
      </Panel>
      <Group title="Personal">
        <Item k="Personal information" v={[p?.addressLine1, p?.city].filter(Boolean).join(", ") || "Add details"} to="/onboarding" />
        <Item k="Identity verification" v={p?.kycLabel ?? (p?.kycStatus ?? "not_started").replaceAll("_", " ")} to="/onboarding" />
        <Item k="Account" v={last4 ? `Checking · •••• ${last4}` : "No checking account"} to="/bank/details" />
      </Group>
      <Group title="Security">
        <Item k="Security" v={p?.twoFactorEnabled ? "On" : "Review"} to="/profile/security" />
        <Item k="Privacy" v={p?.privacyMode ? "Balances hidden" : "Off"} to="/profile/privacy" />
      </Group>
      <Group title="Preferences">
        <Item k="Notifications" v="" to="/profile/notifications" />
        <Item k="Cards" v={data?.debitCard ? "Issued" : "Not issued"} to="/cards" />
        <Item k="Documents" v="Statements, receipts, notices" to="/profile/documents" />
      </Group>
      <Group title="Help">
        <Item k="Support" v="" to="/support" />
        <Item k="Assistant" v="" to="/assistant" />
        <Item k="Legal" v="Privacy & program" to="/profile/privacy" />
      </Group>
      {data?.staffRole ? (
        <Group title="Operations">
          <Item k="Control Center" v={data.staffRole} to="/admin" />
        </Group>
      ) : null}
      <div className="space-y-2 pt-2">
        <button type="button" className="flex h-12 w-full items-center text-sm font-medium text-ink" onClick={() => void signOut("/")}>
          Log out
        </button>
        <Link to="/bank/close" className="flex h-12 items-center text-sm font-medium text-danger">
          Close account
        </Link>
      </div>
      {data?.banking && data.banking.environment !== "live" ? (
        <p className="text-xs leading-relaxed text-subtle">
          {PROGRAM_SUMMARY} {programStatusLine(data.banking)}
        </p>
      ) : null}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="mb-2 px-1 text-xs font-medium uppercase tracking-[0.14em] text-muted">{title}</p>
      <div className="overflow-hidden rounded-2xl bg-surface shadow-card">{children}</div>
    </section>
  );
}

function Item({
  k,
  v,
  to,
}: {
  k: string;
  v: string;
  to:
    | "/onboarding"
    | "/profile/security"
    | "/profile/notifications"
    | "/profile/privacy"
    | "/support"
    | "/assistant"
    | "/admin"
    | "/bank/details"
    | "/cards"
    | "/bank/statements"
    | "/profile/documents";
}) {
  return (
    <Link to={to} className="flex min-h-12 items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-0">
      <span className="text-sm font-medium">{k}</span>
      <span className="truncate text-sm capitalize text-muted">{v}</span>
    </Link>
  );
}
