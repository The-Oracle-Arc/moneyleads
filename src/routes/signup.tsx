import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, PasswordInput } from "@/components/ui/input";
import { UsernameField } from "@/components/ui/username-field";
import { GROK_PROVIDERS, authClient, signIn } from "@/lib/auth/client";
import { DemoBanner } from "@/components/layout/demo-banner";
import { claimUsernameFn, publicFlagsFn, saveSignupBasicsFn } from "@/lib/banking/api";
import { validateUsername } from "@/lib/banking/identity";
import { useQuery } from "@tanstack/react-query";

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        window.clearTimeout(t);
        resolve(value);
      },
      (err) => {
        window.clearTimeout(t);
        reject(err);
      },
    );
  });
}

export const Route = createFileRoute("/signup")({ component: Signup });

function Signup() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const flags = useQuery({ queryKey: ["public-flags"], queryFn: () => publicFlagsFn() });

  if (flags.data && !flags.data.newSignupsOpen) {
    return (
      <div className="min-h-dvh bg-paper">
        <DemoBanner />
        <main className="mx-auto flex max-w-sm flex-col gap-6 px-5 py-12">
          <Logo />
          <h1 className="display text-3xl font-semibold tracking-tight">Sign-ups are paused</h1>
          <p className="text-sm leading-relaxed text-muted">
            New MONEYLEAD accounts are not being created right now. Existing customers can still sign in.
          </p>
          <Link to="/login">
            <Button className="w-full">Sign in</Button>
          </Link>
        </main>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setError("Enter your first and last name.");
      return;
    }
    if (password.length < 10) {
      setError("Use at least 10 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    const parsed = validateUsername(username);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setBusy(true);
    try {
      const name = `${firstName.trim()} ${lastName.trim()}`;
      const { error: err } = await withTimeout(
        authClient.signUp.email({ email, password, name }),
        20000,
        "Account creation is taking too long. Try again in a moment.",
      );
      if (err) {
        setError(err.message ?? "Could not create account.");
        return;
      }
      try {
        await withTimeout(
          saveSignupBasicsFn({ data: { firstName: firstName.trim(), lastName: lastName.trim(), phone } }),
          8000,
          "Continuing…",
        );
      } catch {
        /* Names can still be completed during onboarding. */
      }
      try {
        const claimed = await withTimeout(
          claimUsernameFn({ data: { username: parsed.username } }),
          12000,
          "Username will be confirmed during onboarding.",
        );
        if (!claimed.ok) setError(claimed.error);
      } catch {
        /* Username can still be claimed on the onboarding step. */
      }
      navigate({ to: "/onboarding" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create account.");
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
          <h1 className="display text-3xl font-semibold tracking-tight text-ink">Create your MONEYLEAD account</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            A few details to get started. Next we’ll verify your contact information and identity.
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" htmlFor="first">
              <Input
                id="first"
                autoComplete="given-name"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </Field>
            <Field label="Last name" htmlFor="last">
              <Input
                id="last"
                autoComplete="family-name"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </Field>
          </div>
          <UsernameField
            value={username}
            onChange={setUsername}
            hint="3–20 characters. Letters, numbers, periods, or underscores."
          />
          <Field label="Email" htmlFor="email">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Phone" htmlFor="phone" hint="U.S. mobile number.">
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              required
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
          <Field label="Password" htmlFor="password" hint="At least 10 characters.">
            <PasswordInput
              id="password"
              autoComplete="new-password"
              required
              minLength={10}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Field label="Confirm password" htmlFor="confirm">
            <PasswordInput
              id="confirm"
              autoComplete="new-password"
              required
              minLength={10}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Creating your account…" : "Continue"}
          </Button>
        </form>
        <div className="space-y-2">
          {GROK_PROVIDERS.map((p) => (
            <Button
              key={p.providerId}
              variant="secondary"
              className="w-full"
              onClick={() => void signIn(p.providerId, { callbackURL: "/onboarding" })}
            >
              Continue with {p.label}
            </Button>
          ))}
        </div>
        <p className="text-sm text-muted">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-lead">
            Sign in
          </Link>
        </p>
      </main>
    </div>
  );
}
