import { Link, Navigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowLeftRight, Bell, CreditCard, House, LifeBuoy, List, UserRound, WalletCards } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { DemoBanner } from "@/components/layout/demo-banner";
import { AssistantLauncher } from "@/components/assistant/assistant-panel";
import { SessionLock } from "@/components/security/session-lock";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useWorkspace, isUnauthorized } from "@/hooks/use-workspace";
import { usePrivacyMode } from "@/hooks/use-privacy";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const MOBILE_NAV = [
  { to: "/home", label: "Home", icon: House },
  { to: "/payments", label: "Payments", icon: ArrowLeftRight },
  { to: "/cards", label: "Cards", icon: CreditCard },
  { to: "/activity", label: "Activity", icon: List },
  { to: "/profile", label: "Profile", icon: UserRound },
] as const;

const DESKTOP_NAV = [
  { to: "/home", label: "Home", icon: House },
  { to: "/payments", label: "Payments", icon: ArrowLeftRight },
  { to: "/cards", label: "Cards", icon: CreditCard },
  { to: "/activity", label: "Activity", icon: List },
  { to: "/cards/apply", label: "Credit", icon: WalletCards },
  { to: "/support", label: "Support", icon: LifeBuoy },
  { to: "/profile", label: "Profile", icon: UserRound },
] as const;

function isFocused(pathname: string) {
  return pathname === "/bank/send" || pathname === "/bank/add" || pathname === "/bank/close";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, authPending, data, isPending, error, refetch } = useWorkspace();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hideChromeHeader = pathname === "/home" || isFocused(pathname);
  const hideTabs = isFocused(pathname);
  const privacy = usePrivacyMode((s) => s.setEnabled);
  useEffect(() => {
    privacy(Boolean(data?.profile?.privacyMode));
  }, [data?.profile?.privacyMode, privacy]);

  if (authPending) {
    return (
      <div className="min-h-dvh bg-paper p-6">
        <Skeleton className="h-10 w-40" />
        <p className="mt-6 text-sm text-muted">Loading account…</p>
        <Skeleton className="mt-4 h-40 w-full" />
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;
  if (isUnauthorized(error)) return <RedirectToSignIn />;

  if (
    data?.profile &&
    data.profile.onboardingStep !== "complete" &&
    data.profile.checkingStatus !== "approved" &&
    !pathname.startsWith("/onboarding")
  ) {
    const step = data.profile.onboardingStep === "welcome" ? "email" : data.profile.onboardingStep;
    const stillCollecting = step === "email" || step === "username" || step === "phone" || step === "personal";
    const waitingOnPartner =
      ["processing", "manual_review", "additional_info", "pending_documents"].includes(data.profile.kycStatus) ||
      ["additional_review", "additional_info", "processing", "submitted"].includes(data.profile.checkingStatus);
    const partnerMissing = !data.banking.configured && !stillCollecting;
    if (!partnerMissing && !waitingOnPartner) {
      return <Navigate to="/onboarding" />;
    }
  }

  const unread = data?.notificationsUnread ?? 0;
  return (
    <div className="min-h-dvh bg-paper">
      <DemoBanner />
      <div className="mx-auto flex min-h-[calc(100dvh-32px)] max-w-6xl">
        <aside className="sticky top-0 hidden h-[calc(100dvh-32px)] w-56 shrink-0 flex-col px-4 py-6 md:flex">
          <Logo />
          <nav className="mt-10 flex flex-1 flex-col gap-1" aria-label="Primary">
            {DESKTOP_NAV.map((item) => {
              const active =
                item.to === "/cards"
                  ? pathname === "/cards" || pathname.startsWith("/cards/debit")
                  : item.to === "/cards/apply"
                    ? pathname.startsWith("/cards/apply") || pathname.startsWith("/cards/credit")
                    : pathname === item.to || pathname.startsWith(item.to + "/");
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex h-12 items-center gap-3 rounded-full px-4 text-sm font-medium transition-colors duration-150",
                    active ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink",
                  )}
                >
                  <item.icon className="size-4" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          {data?.staffRole ? (
            <Link to="/admin" className="mb-2 flex h-11 items-center rounded-full px-4 text-sm text-muted hover:text-ink">
              Control Center
            </Link>
          ) : null}
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          {!hideChromeHeader ? (
            <header className="flex items-center justify-between px-5 py-3 md:px-8">
              <Logo compact />
              <Link
                to="/profile/notifications"
                className="relative flex size-11 items-center justify-center rounded-full bg-surface shadow-card"
                aria-label="Notifications"
              >
                <Bell className="size-4" />
                {unread > 0 ? <span className="absolute top-2 right-2 size-2 rounded-full bg-lead" /> : null}
              </Link>
            </header>
          ) : null}
          <main
            className={cn(
              "mx-auto w-full max-w-[560px] flex-1 px-5 py-4 md:max-w-xl md:px-8 md:pb-12",
              hideTabs ? "pb-8" : "pb-28",
            )}
          >
            {isPending && !data ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-36 w-full" />
              </div>
            ) : error && !data ? (
              <div className="rounded-2xl bg-danger-soft p-6">
                <p className="font-medium text-danger">Could not load your account</p>
                <p className="mt-1 text-sm text-muted">Please try again.</p>
                <button type="button" className="mt-3 text-sm font-medium text-lead underline" onClick={() => void refetch()}>
                  Retry
                </button>
              </div>
            ) : (
              children
            )}
          </main>
        </div>
      </div>
      {!hideTabs ? (
        <nav
          className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/92 backdrop-blur md:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          aria-label="Primary"
        >
          <ul className="mx-auto grid max-w-lg grid-cols-5">
            {MOBILE_NAV.map((item) => {
              const active = pathname === item.to || pathname.startsWith(item.to + "/");
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={cn(
                      "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                      active ? "text-ink" : "text-muted",
                    )}
                  >
                    <item.icon className={cn("size-5", active && "fill-ink/10")} aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
      {!hideTabs && data?.flags?.assistantEnabled !== false ? <AssistantLauncher /> : null}
      <SessionLock enabled={Boolean(user && data?.profile?.passcodeSet)} />
    </div>
  );
}
