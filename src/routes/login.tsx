import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, PasswordInput } from "@/components/ui/input";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { DemoBanner } from "@/components/layout/demo-banner";
import { checkLoginThrottleFn, recordFailedLoginFn, resolveLoginFn } from "@/lib/banking/api";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const resolved = await resolveLoginFn({ data: { identifier: email } });
      const throttle = await checkLoginThrottleFn({ data: { email: resolved.email } });
      if (!throttle.ok) {
        setError(throttle.error);
        return;
      }
      const { error: err } = await authClient.signIn.email({ email: resolved.email, password });
      if (err) {
        const locked = await recordFailedLoginFn({ data: { email: resolved.email } });
        setError(!locked.ok ? locked.error : (err.message ?? "Could not sign in."));
        return;
      }
      navigate({ to: "/home" });
    } catch {
      setError("Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-paper">
      <DemoBanner />
      <main className="mx-auto flex max-w-sm flex-col gap-8 px-5 py-12">
        <Logo />
        <div>
          <h1 className="display text-3xl font-semibold tracking-tight text-ink">Welcome back</h1>
          <p className="mt-2 text-sm text-muted">Sign in to your MONEYLEAD account.</p>
        </div>
        {authEnabled ? (
          <>
            <form onSubmit={onSubmit} className="space-y-4">
              <Field label="Email or username" htmlFor="email">
                <Input id="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label="Password" htmlFor="password">
                <PasswordInput
                  id="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              {error ? <p className="text-sm text-danger">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </Button>
            </form>
            <div className="space-y-2">
              {GROK_PROVIDERS.map((p) => (
                <Button
                  key={p.providerId}
                  variant="secondary"
                  className="w-full"
                  onClick={() => void signIn(p.providerId, { callbackURL: "/home" })}
                >
                  Continue with {p.label}
                </Button>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">Sign-in is disabled.</p>
        )}
        <p className="text-sm text-muted">
          New here?{" "}
          <Link to="/signup" className="font-medium text-lead">
            Create an account
          </Link>
        </p>
      </main>
    </div>
  );
}
