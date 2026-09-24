import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Logo } from "@/components/brand/logo";
import { DemoBanner } from "@/components/layout/demo-banner";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { APP_NAME, APP_TAGLINE } from "@/lib/banking/types";
import { PROGRAM_DISCLAIMER, SOFTWARE_STATUS_LINE } from "@/lib/banking/program";
import { HeroAmount } from "@/components/money/amount";

export const Route = createFileRoute("/")({ component: Welcome });

function Welcome() {
  const { user, isPending } = useCurrentUserState();
  if (!isPending && user) return <Navigate to="/home" />;

  return (
    <div className="min-h-dvh bg-paper">
      <DemoBanner />
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6">
        <Logo />
        <Link to="/login" className="inline-flex h-11 items-center text-sm font-medium">
          Sign in
        </Link>
      </header>
      <main className="mx-auto flex max-w-5xl flex-col gap-16 px-5 pb-24 pt-4 md:pt-12">
        <section className="mx-auto max-w-xl text-center">
          <p className="text-xs font-medium tracking-[0.22em] text-muted">{APP_NAME}</p>
          <h1 className="display mt-5 text-5xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-6xl">
            {APP_TAGLINE}
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-muted">
            A calm U.S. checking account, built around you.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-subtle">{SOFTWARE_STATUS_LINE}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/signup">
              <Button size="lg" className="w-full sm:w-auto">
                Get started
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                Sign in
              </Button>
            </Link>
          </div>
        </section>

        <section className="mx-auto w-full max-w-sm">
          <div className="rounded-[2rem] bg-surface p-8 text-center shadow-float">
            <p className="text-sm text-muted">Available balance</p>
            <HeroAmount className="mt-3 justify-center" empty />
            <div className="mt-6 grid grid-cols-3 gap-2 text-xs text-muted">
              <span>Available</span>
              <span>Current</span>
              <span>Pending</span>
            </div>
            <p className="mt-6 text-xs leading-relaxed text-subtle">
              No account yet. This is an empty state — not a fabricated balance.
            </p>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          {[
            { title: "Checking", body: "One account. Available and current balances when your account is open." },
            { title: "Payments", body: "Send, receive, and add money. Status is always the real one." },
            { title: "Credit", body: "Optional. Nothing is auto-approved." },
          ].map((item) => (
            <article key={item.title} className="rounded-2xl bg-surface p-6 shadow-card">
              <h2 className="font-medium text-ink">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
            </article>
          ))}
        </section>
        <p className="mx-auto max-w-2xl text-center text-xs leading-relaxed text-subtle">{PROGRAM_DISCLAIMER}</p>
      </main>
    </div>
  );
}
