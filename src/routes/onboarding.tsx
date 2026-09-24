import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Logo } from "@/components/brand/logo";
import { DemoBanner } from "@/components/layout/demo-banner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect, CodeInput } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { UsernameField } from "@/components/ui/username-field";
import { AddressFields, type AddressValue } from "@/components/ui/address-field";
import { StatusCenter } from "@/components/layout/status-center";
import { DocumentCapture, LivenessCapture } from "@/components/kyc/liveness-capture";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  activateDebitFn,
  fundAccountFn,
  issueDebitFn,
  kycStartFn,
  kycSubmitDocumentFn,
  savePersonalFn,
  saveSecurityFn,
  skipToDebitFn,
  startOtpFn,
  submitCheckingFn,
  verifyOtpFn,
  claimUsernameFn,
  continueOpeningFn,
  continueKycFn,
  rewindOnboardingFn,
  runCustomerKycAgentFn,
} from "@/lib/banking/api";
import { type OnboardingStep } from "@/lib/banking/types";
import { parseUsdToCents } from "@/lib/banking/money";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({ component: Onboarding });

const STEPS: OnboardingStep[] = [
  "email",
  "username",
  "phone",
  "personal",
  "kyc",
  "security",
  "review",
  "opening",
  "funding",
  "debit_card",
];

function Onboarding() {
  const { user, authPending, data, isPending, refetch } = useWorkspace();
  const qc = useQueryClient();

  if (authPending || isPending) {
    return (
      <div className="min-h-dvh bg-paper px-5 py-12">
        <Logo />
        <p className="mt-10 text-sm text-muted">Loading your application…</p>
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;
  if (data?.profile?.onboardingStep === "complete" && data.profile.checkingStatus === "approved") {
    return <Navigate to="/home" />;
  }

  const profile = data?.profile;
  const step: OnboardingStep = profile?.onboardingStep === "welcome" ? "email" : (profile?.onboardingStep ?? "email");

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["workspace"] });
    await refetch();
  }

  return (
    <div className="min-h-dvh bg-paper">
      <DemoBanner />
      <div className="mx-auto grid max-w-5xl gap-8 px-5 py-8 lg:grid-cols-[1fr_280px]">
        <div>
          <Logo />
          <p className="mt-8 text-xs font-medium tracking-[0.14em] text-muted">
            Step {Math.max(1, STEPS.indexOf(step) + 1)} of {STEPS.length}
          </p>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-line">
            <div
              className="h-full bg-ink transition-[width] duration-300"
              style={{ width: `${((Math.max(0, STEPS.indexOf(step)) + 1) / STEPS.length) * 100}%` }}
            />
          </div>
          <StepView step={step} email={user.primaryEmail ?? profile?.email ?? ""} onDone={refresh} />
        </div>
        <aside className="space-y-4">
          {data ? <StatusCenter items={data.status} /> : null}
          <div className="rounded-xl border border-line bg-surface p-5">
            <p className="text-sm font-medium text-ink">How accounts are opened</p>
            <p className="mt-1 text-sm text-muted">
              {data?.banking.configured
                ? "We’ll verify your identity, then open your checking account. Account numbers come from our banking partner — never created here."
                : "Your banking account is being prepared. You can still complete your application."}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function StepView({ step, email, onDone }: { step: OnboardingStep; email: string; onDone: () => Promise<void> }) {
  switch (step) {
    case "welcome":
    case "email":
      return <EmailStep defaultEmail={email} onDone={onDone} />;
    case "username":
      return <UsernameStep onDone={onDone} />;
    case "phone":
      return <PhoneStep onDone={onDone} />;
    case "personal":
      return <PersonalStep onDone={onDone} />;
    case "kyc":
      return <KycStep onDone={onDone} />;
    case "security":
      return <SecurityStep onDone={onDone} />;
    case "review":
      return <ReviewStep onDone={onDone} />;
    case "opening":
      return <OpeningStep onDone={onDone} />;
    case "funding":
      return <FundingStep onDone={onDone} />;
    case "debit_card":
      return <DebitStep onDone={onDone} />;
    default:
      return <p className="mt-4 text-sm text-muted">You are all set.</p>;
  }
}

function EmailStep({ defaultEmail, onDone }: { defaultEmail: string; onDone: () => Promise<void> }) {
  const [email, setEmail] = useState(defaultEmail);
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [delivered, setDelivered] = useState(true);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mt-3 max-w-md space-y-6">
      <h1 className="display text-4xl font-medium text-ink">Verify your email</h1>
      <p className="text-muted">We’ll send a one-time code to confirm this inbox. This is not legal identity verification.</p>
      <Field label="Email" htmlFor="email">
        <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      {sent ? (
        <Field label="Verification code" htmlFor="code" hint="Enter the code we sent to your email.">
          <CodeInput id="code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
        </Field>
      ) : null}
      {sent && !delivered && previewCode ? (
        <div className="rounded-2xl bg-surface p-4 shadow-card">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Message</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Sent to {email}. Until email delivery is connected, your code appears here.
          </p>
          <p className="mt-3 text-center text-2xl font-semibold tracking-[0.35em] tabular text-ink">{previewCode}</p>
        </div>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {!sent ? (
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            const r = await startOtpFn({ data: { destination: email, method: "email" } });
            setBusy(false);
            if (!r.ok) setError(r.error);
            else {
              setSent(true);
              setDelivered(r.delivered);
              setPreviewCode(r.previewCode ?? null);
            }
          }}
        >
          {busy ? "Sending…" : "Send verification email"}
        </Button>
      ) : (
        <div className="flex gap-3">
          <Button
            disabled={busy || code.length !== 6}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                const r = await verifyOtpFn({ data: { code, method: "email" } });
                if (!r.ok) setError(r.error);
                else {
                  toast.success("Email verified");
                  await onDone();
                }
              } catch (err) {
                setError(err instanceof Error ? err.message : "We couldn't complete that request. Please try again.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Verifying…" : "Verify"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setSent(false);
              setCode("");
              setPreviewCode(null);
            }}
          >
            Resend
          </Button>
        </div>
      )}
    </div>
  );
}

function UsernameStep({ onDone }: { onDone: () => Promise<void> }) {
  const { data } = useWorkspace();
  const existing = data?.profile?.username ?? "";
  const [username, setUsername] = useState(existing);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (existing && !username) setUsername(existing);
  }, [existing, username]);
  return (
    <div className="mt-3 max-w-md space-y-6">
      <h1 className="display text-4xl font-medium text-ink">Choose a username</h1>
      <p className="text-muted">This is how you appear in MONEYLEAD. It is not your email or account number.</p>
      <UsernameField value={username} onChange={setUsername} hint="3–20 characters. Start with a letter." />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const r = await claimUsernameFn({ data: { username } });
            if (!r.ok) setError(r.error);
            else await onDone();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save username.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Saving…" : "Continue"}
      </Button>
    </div>
  );
}

function PhoneStep({ onDone }: { onDone: () => Promise<void> }) {
  const { data } = useWorkspace();
  const [phone, setPhone] = useState(data?.profile?.phone ?? "");
  const [method, setMethod] = useState<"sms" | "voice">("sms");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [delivered, setDelivered] = useState(true);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mt-3 max-w-md space-y-6">
      <h1 className="display text-4xl font-medium text-ink">Verify your phone</h1>
      <p className="text-muted">
        We’ll {method === "voice" ? "call you with" : "text you"} a verification code. This confirms control of the number.
        It is not a substitute for identity verification.
      </p>
      <Field label="U.S. mobile number" htmlFor="phone">
        <Input id="phone" type="tel" autoComplete="tel" placeholder="2025550188" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      {sent ? (
        <Field
          label="Verification code"
          htmlFor="code"
          hint={method === "voice" ? "Enter the code from your call." : "Enter the code we sent to your phone."}
        >
          <CodeInput id="code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
        </Field>
      ) : null}
      {sent && !delivered && previewCode ? (
        <div className="rounded-2xl bg-surface p-4 shadow-card">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Message</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Sent to {phone}. Until SMS delivery is connected, your code appears here.
          </p>
          <p className="mt-3 text-center text-2xl font-semibold tracking-[0.35em] tabular text-ink">{previewCode}</p>
        </div>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {!sent ? (
        <div className="flex flex-col gap-2">
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              const r = await startOtpFn({ data: { destination: phone, method } });
              setBusy(false);
              if (!r.ok) setError(r.error);
              else {
                setSent(true);
                setDelivered(r.delivered);
                setPreviewCode(r.previewCode ?? null);
                toast.message(method === "voice" ? "Calling you now" : "Code sent");
              }
            }}
          >
            {busy ? "Sending…" : method === "voice" ? "Call me" : "Send SMS"}
          </Button>
          <Button variant="ghost" onClick={() => setMethod(method === "sms" ? "voice" : "sms")}>
            {method === "sms" ? "Send a voice call instead" : "Send SMS instead"}
          </Button>
        </div>
      ) : (
        <>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy || code.length !== 6}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                const r = await verifyOtpFn({ data: { code, method } });
                if (!r.ok) setError(r.error);
                else await onDone();
              } catch (err) {
                setError(err instanceof Error ? err.message : "We couldn't complete that request. Please try again.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Verifying…" : "Verify"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setSent(false);
              setCode("");
              setError(null);
              setPreviewCode(null);
            }}
          >
            Change number
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const r = await startOtpFn({ data: { destination: phone, method } });
              setBusy(false);
              if (!r.ok) setError(r.error);
              else {
                setError(null);
                setDelivered(r.delivered);
                setPreviewCode(r.previewCode ?? null);
                toast.message("New code sent");
              }
            }}
          >
            Resend
          </Button>
        </div>
        <p className="text-xs text-muted">
          Incorrect, expired, or locked codes need a new send. Too many attempts will temporarily block this step.
        </p>
        </>
      )}
    </div>
  );
}

function PersonalStep({ onDone }: { onDone: () => Promise<void> }) {
  const { data } = useWorkspace();
  const p = data?.profile;
  const [form, setForm] = useState({
    legalFirstName: p?.legalFirstName ?? "",
    middleName: p?.middleName ?? "",
    legalLastName: p?.legalLastName ?? "",
    preferredName: p?.preferredName ?? p?.legalFirstName ?? "",
    dob: p?.dob ?? "",
    citizenship: p?.citizenship ?? "US",
    residencyStatus: p?.residencyStatus ?? "citizen",
    ssn: "",
    line1: p?.addressLine1 ?? "",
    line2: p?.addressLine2 ?? "",
    city: p?.city ?? "",
    state: p?.state ?? "",
    postalCode: p?.postalCode ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const address: AddressValue = {
    line1: form.line1,
    line2: form.line2,
    city: form.city,
    state: form.state,
    postalCode: form.postalCode,
    country: "US",
  };
  return (
    <form
      className="mt-3 max-w-md space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await savePersonalFn({ data: form });
        setBusy(false);
        if (!r.ok) setError(r.error);
        else await onDone();
      }}
    >
      <h1 className="display text-4xl font-medium text-ink">Personal information</h1>
      <p className="text-sm text-muted">Use the name on your government ID. This appears on statements and your account.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Legal first name" htmlFor="first">
          <Input id="first" autoComplete="given-name" required value={form.legalFirstName} onChange={(e) => set("legalFirstName", e.target.value)} />
        </Field>
        <Field label="Middle name" htmlFor="middle">
          <Input id="middle" autoComplete="additional-name" value={form.middleName} onChange={(e) => set("middleName", e.target.value)} />
        </Field>
      </div>
      <Field label="Legal last name" htmlFor="last">
        <Input id="last" autoComplete="family-name" required value={form.legalLastName} onChange={(e) => set("legalLastName", e.target.value)} />
      </Field>
      <Field label="Preferred name" htmlFor="pref" hint="Used in greetings. Legal name remains on statements and KYC.">
        <Input id="pref" value={form.preferredName} onChange={(e) => set("preferredName", e.target.value)} />
      </Field>
      <Field label="Date of birth" htmlFor="dob">
        <Input id="dob" type="date" required value={form.dob} onChange={(e) => set("dob", e.target.value)} />
      </Field>
      <Field label="Citizenship" htmlFor="cit">
        <NativeSelect id="cit" value={form.citizenship} onChange={(e) => set("citizenship", e.target.value)}>
          <option value="US">United States</option>
          <option value="other">Other</option>
        </NativeSelect>
      </Field>
      <Field label="U.S. residency" htmlFor="res">
        <NativeSelect id="res" value={form.residencyStatus} onChange={(e) => set("residencyStatus", e.target.value)}>
          <option value="citizen">U.S. citizen</option>
          <option value="permanent_resident">Permanent resident</option>
          <option value="visa">Visa holder</option>
        </NativeSelect>
      </Field>
      <Field label="Social Security number" htmlFor="ssn" hint="Encrypted after submit. Only the last four is stored for display.">
        <Input id="ssn" inputMode="numeric" autoComplete="off" required value={form.ssn} onChange={(e) => set("ssn", e.target.value)} />
      </Field>
      <AddressFields
        value={address}
        onChange={(next) =>
          setForm((f) => ({
            ...f,
            line1: next.line1,
            line2: next.line2,
            city: next.city,
            state: next.state,
            postalCode: next.postalCode,
          }))
        }
      />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}

function KycStep({ onDone }: { onDone: () => Promise<void> }) {
  const { data } = useWorkspace();
  const status = data?.profile?.kycStatus ?? "not_started";
  const agent = useQuery({ queryKey: ["kyc-agent"], queryFn: () => runCustomerKycAgentFn() });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const p = data?.profile;
  const checks = [
    { label: "Identity information", done: Boolean(p?.legalFirstName && p?.legalLastName && p?.dob) },
    { label: "Address", done: Boolean(p?.addressLine1 && p?.city && p?.state && p?.postalCode) },
    { label: "Document", done: status !== "not_started" && status !== "pending_documents" },
    { label: "Verification", done: status === "approved" },
    { label: "Review pending", done: ["processing", "manual_review"].includes(status) || Boolean(p?.kycSubmittedAt) },
  ];
  const deadline = p?.kycReviewDeadline ? new Date(p.kycReviewDeadline) : null;
  return (
    <div className="mt-3 max-w-md space-y-5">
      <h1 className="display text-4xl font-medium text-ink">Identity verification</h1>
      <p className="text-muted">
        Confirm who you are with an ID and a live face check. We’ll let you know if anything else is needed.
      </p>
      <ul className="space-y-2 rounded-2xl bg-surface p-4 shadow-card">
        {checks.map((c) => (
          <li key={c.label} className="flex items-center justify-between text-sm">
            <span>{c.label}</span>
            <span className={c.done ? "text-ok" : "text-muted"}>{c.done ? "Complete" : "Needed"}</span>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted">Status: {p?.kycLabel ?? status.replaceAll("_", " ")}</p>
      {p?.kycSubmittedAt ? (
        <p className="text-sm text-muted">
          KYC submitted
          {deadline ? ` · Estimated review by ${deadline.toLocaleString()}` : ""}
        </p>
      ) : null}
      {agent.data?.reviewDeadline && !p?.kycSubmittedAt ? (
        <p className="text-sm text-muted">Estimated review deadline: {new Date(agent.data.reviewDeadline).toLocaleString()}</p>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {status === "not_started" ? (
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const r = await kycStartFn();
            setBusy(false);
            if (r && "ok" in r && r.ok === false) setError(r.error);
            else await onDone();
          }}
        >
            {busy ? "Starting verification…" : "Start verification"}
        </Button>
      ) : null}
      {status === "failed" ? (
        <>
          <p className="rounded-md bg-danger-soft p-4 text-sm text-danger">
            Your verification requires additional information. You can retry this step.
          </p>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const r = await kycStartFn();
              setBusy(false);
              if (r && "ok" in r && r.ok === false) setError(r.error);
              else await onDone();
            }}
          >
            Retry verification
          </Button>
        </>
      ) : null}
      {status === "pending_documents" || status === "processing" ? (
        <div className="space-y-3">
          {status === "pending_documents" ? (
            <DocumentCapture
              configured={Boolean(data?.banking.configured)}
              busy={busy}
              onSelect={async (type) => {
                setBusy(true);
                const r = await kycSubmitDocumentFn({ data: { documentType: type } });
                setBusy(false);
                if (r && "ok" in r && r.ok === false) setError(r.error);
                else await onDone();
              }}
            />
          ) : null}
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const r = await kycStartFn();
              setBusy(false);
              if (r && "ok" in r && r.ok === false) setError(r.error);
              else await onDone();
            }}
          >
            {busy ? "Refreshing…" : "Refresh identity status"}
          </Button>
        </div>
      ) : null}
      {status === "selfie_required" ? (
        <LivenessCapture
          configured={Boolean(data?.banking.configured)}
          onDone={async () => {
            await onDone();
          }}
        />
      ) : null}
      {status === "manual_review" || status === "additional_info" ? (
        <p className="rounded-md bg-warn-soft p-4 text-sm text-warn">
          Additional review is required. We’ll notify you when this is complete.
        </p>
      ) : null}
      {status === "approved" ? (
        <Button
          onClick={async () => {
            const r = await continueKycFn();
            if (!r.ok) setError(r.error);
            else await onDone();
          }}
        >
          Continue
        </Button>
      ) : null}
    </div>
  );
}

function SecurityStep({ onDone }: { onDone: () => Promise<void> }) {
  const [passcode, setPasscode] = useState("");
  const [biometrics, setBiometrics] = useState(true);
  const [twoFactor, setTwoFactor] = useState(true);
  const [loginAlerts, setLoginAlerts] = useState(true);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mt-3 max-w-md space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await saveSecurityFn({
          data: { passcode, biometrics, twoFactor, loginAlerts, trustedDevice: true },
        });
        if (!r.ok) setError(r.error);
        else await onDone();
      }}
    >
      <h1 className="display text-4xl font-medium text-ink">Security setup</h1>
      <Field label="6-digit passcode" htmlFor="pass">
        <CodeInput id="pass" required value={passcode} onChange={(e) => setPasscode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
      </Field>
      <label className="flex h-12 items-center justify-between text-sm">
        Enable Face ID / Touch ID on supported devices
        <Switch checked={biometrics} onCheckedChange={setBiometrics} />
      </label>
      <label className="flex h-12 items-center justify-between text-sm">
        Two-factor authentication
        <Switch checked={twoFactor} onCheckedChange={setTwoFactor} />
      </label>
      <label className="flex h-12 items-center justify-between text-sm">
        Login alerts
        <Switch checked={loginAlerts} onCheckedChange={setLoginAlerts} />
      </label>
      <p className="text-xs text-muted">This browser will be marked as a trusted device.</p>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button type="submit">Continue</Button>
    </form>
  );
}

function ReviewStep({ onDone }: { onDone: () => Promise<void> }) {
  const { data } = useWorkspace();
  const p = data?.profile;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rows = useMemo(
    () => [
      ["Name", [p?.legalFirstName, p?.middleName, p?.legalLastName].filter(Boolean).join(" ")],
      ["Username", p?.username],
      ["MONEYLEAD User ID", p?.moneyleadUserId],
      ["Date of birth", p?.dob],
      ["Email", p?.email],
      ["Phone", p?.phone],
      ["Address", [p?.addressLine1, p?.city, p?.state, p?.postalCode].filter(Boolean).join(", ")],
      ["SSN", p?.ssnLast4 ? `•••-••-${p.ssnLast4}` : ""],
      ["Citizenship", p?.citizenship],
    ],
    [p],
  );
  return (
    <div className="mt-3 max-w-md space-y-5">
      <h1 className="display text-4xl font-medium text-ink">Review</h1>
      <p className="text-sm text-muted">Confirm before we submit your checking application to the banking partner.</p>
      <dl className="divide-y divide-line rounded-xl border border-line bg-surface">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-4 py-3 text-sm">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right text-ink">{v || "—"}</dd>
          </div>
        ))}
      </dl>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const r = await submitCheckingFn();
            setBusy(false);
            if (!r.ok) setError(r.error);
            else await onDone();
          }}
        >
          {busy ? "Submitting…" : "Submit application"}
        </Button>
        <Button
          variant="ghost"
          onClick={async () => {
            await rewindOnboardingFn({ data: { step: "personal" } });
            await onDone();
          }}
        >
          Edit information
        </Button>
      </div>
    </div>
  );
}

function OpeningStep({ onDone }: { onDone: () => Promise<void> }) {
  const { data } = useWorkspace();
  const status = data?.profile?.checkingStatus;
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mt-3 max-w-md space-y-5">
      <h1 className="display text-4xl font-medium text-ink">Account opening</h1>
      <p className="text-muted">We’re opening your checking account. This happens after identity is verified.</p>
      <p className="rounded-xl border border-line bg-surface p-5 text-sm">
        Status: {status === "submitted" || status === "processing" ? "Processing" : status?.replaceAll("_", " ")}
      </p>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {status === "approved" ? (
        <Button
          onClick={async () => {
            const r = await continueOpeningFn();
            if (!r.ok) setError(r.error);
            else await onDone();
          }}
        >
          Continue
        </Button>
      ) : null}
      {status === "additional_review" || status === "additional_info" ? (
        <p className="text-sm text-warn">Additional review is underway. You will be notified.</p>
      ) : null}
      {status === "declined" || status === "withdrawn" ? (
        <p className="text-sm text-danger">This application could not be verified.</p>
      ) : null}
    </div>
  );
}

function FundingStep({ onDone }: { onDone: () => Promise<void> }) {
  const [amount, setAmount] = useState("2500.00");
  const [error, setError] = useState<string | null>(null);
  const checking = useWorkspace().data?.checking;
  return (
    <div className="mt-3 max-w-md space-y-5">
      <h1 className="display text-4xl font-medium text-ink">Fund your account</h1>
      <p className="text-sm text-muted">
        Add money by bank transfer. Incoming transfers can take a little time to appear. We’ll show the real status — nothing is marked complete early.
      </p>
      {checking ? (
        <p className="text-sm text-muted">
          Direct deposit uses routing {checking.routingNumber} and account {checking.accountNumberMasked}.
        </p>
      ) : null}
      <Field label="Amount" htmlFor="amt">
        <Input id="amt" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="flex flex-col gap-2">
        <Button
          onClick={async () => {
            const cents = parseUsdToCents(amount);
            if (!cents) {
              setError("Enter a valid amount.");
              return;
            }
            const r = await fundAccountFn({
              data: {
                method: "ach",
                amountCents: cents,
                counterparty: "External checking (demo)",
                idempotencyKey: crypto.randomUUID(),
              },
            });
            if (!r.ok) setError(r.error);
            else await onDone();
          }}
        >
          Add money
        </Button>
        <Button
          variant="secondary"
          onClick={async () => {
            const cents = parseUsdToCents(amount) ?? 250000;
            const r = await fundAccountFn({
              data: {
                method: "direct_deposit",
                amountCents: cents,
                counterparty: "Payroll",
                idempotencyKey: crypto.randomUUID(),
              },
            });
            if (!r.ok) setError(r.error);
            else await onDone();
          }}
        >
          Direct deposit
        </Button>
        <Button variant="ghost" onClick={async () => { await skipToDebitFn(); await onDone(); }}>
          Fund later
        </Button>
      </div>
    </div>
  );
}

function DebitStep({ onDone }: { onDone: () => Promise<void> }) {
  const { data, refetch } = useWorkspace();
  const card = data?.debitCard;
  const [last4, setLast4] = useState("");
  const navigate = useNavigate();
  return (
    <div className="mt-3 max-w-md space-y-5">
      <h1 className="display text-4xl font-medium text-ink">Your debit card</h1>
      <p className="text-sm text-muted">
        Debit cards are part of MONEYLEAD. They aren’t issued in this environment yet. You can continue with checking only.
      </p>
      {!card ? (
        <Button
          onClick={async () => {
            await issueDebitFn();
            await refetch();
            navigate({ to: "/home" });
          }}
        >
          Continue without a debit card
        </Button>
      ) : (
        <>
          <p className="text-sm">
            Status: {card.status}
            {card.shippingStatus ? ` · ${card.shippingStatus}` : ""} · •••• {card.last4}
          </p>
          {card.status !== "active" ? (
            <Field label="Last four to activate" htmlFor="l4">
              <Input id="l4" value={last4} onChange={(e) => setLast4(e.target.value)} />
            </Field>
          ) : null}
          {card.status !== "active" ? (
            <Button
              onClick={async () => {
                await activateDebitFn({ data: { last4: last4 || card.last4 } });
                await refetch();
              }}
            >
              Activate card
            </Button>
          ) : (
            <Button
              onClick={async () => {
                await onDone();
                navigate({ to: "/home" });
              }}
            >
              Go to home
            </Button>
          )}
          <p className="text-xs text-muted">Apple Pay and Google Pay provisioning would be completed by the card processor on a supported device.</p>
        </>
      )}
    </div>
  );
}
