import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Field, DetailRow } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { AmountDisplay, AmountKeypad } from "@/components/ui/amount-input";
import { Amount, HeroAmount } from "@/components/money/amount";
import { DemoMark } from "@/components/money/demo-mark";
import { ReauthDialog } from "@/components/security/reauth-dialog";
import { Sheet } from "@/components/ui/sheet";
import { createDemoTransferFn, getTransactionFn, sendMoneyFn } from "@/lib/banking/api";
import { formatUsd, visibleLast4 } from "@/lib/banking/money";
import { DEMO_WATERMARK } from "@/lib/banking/identity";
import type { BankAccountView } from "@/lib/banking/types";
import { Landmark } from "lucide-react";

type Step = "mode" | "who" | "amount" | "details" | "confirm" | "done";
type Mode = "ach" | "demo";

export function SendSheet({
  open,
  onClose,
  checking,
  sandboxDemo = true,
  bankingTransfers = true,
}: {
  open: boolean;
  onClose: () => void;
  checking: BankAccountView | null | undefined;
  sandboxDemo?: boolean;
  bankingTransfers?: boolean;
}) {
  const [title, setTitle] = useState("Send");
  return (
    <Sheet
      open={open}
      onClose={() => {
        setTitle("Send");
        onClose();
      }}
      title={title}
    >
      <SendFlow
        key={open ? "open" : "closed"}
        checking={checking}
        sandboxDemo={sandboxDemo}
        bankingTransfers={bankingTransfers}
        onClose={onClose}
        onTitle={setTitle}
      />
    </Sheet>
  );
}

export function SendFlow({
  checking,
  onClose,
  onTitle,
  sandboxDemo = true,
  bankingTransfers = true,
}: {
  checking: BankAccountView | null | undefined;
  onClose?: () => void;
  onTitle?: (title: string) => void;
  sandboxDemo?: boolean;
  bankingTransfers?: boolean;
}) {
  const qc = useQueryClient();
  const last4 = visibleLast4(checking?.accountNumberMasked);
  const [mode, setMode] = useState<Mode | null>(null);
  const [step, setStep] = useState<Step>("mode");
  const [name, setName] = useState("");
  const [routing, setRouting] = useState("");
  const [account, setAccount] = useState("");
  const [cents, setCents] = useState(0);
  const [note, setNote] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [demoTxId, setDemoTxId] = useState<string | null>(null);
  const [demoStatus, setDemoStatus] = useState<"pending" | "failed" | null>(null);
  const [reauth, setReauth] = useState(false);
  const demo = mode === "demo";

  useEffect(() => {
    if (!demoTxId) return;
    const t = window.setInterval(async () => {
      const tx = await getTransactionFn({ data: { id: demoTxId } });
      if (tx?.status === "failed") {
        setDemoStatus("failed");
        window.clearInterval(t);
        await qc.invalidateQueries({ queryKey: ["workspace"] });
        await qc.invalidateQueries({ queryKey: ["tx"] });
      }
    }, 2000);
    return () => window.clearInterval(t);
  }, [demoTxId, qc]);

  useEffect(() => {
    if (!onTitle) return;
    if (step === "confirm") onTitle("Confirm transaction");
    else if (step === "done") {
      onTitle(demo ? (demoStatus === "failed" ? "Demonstration failed" : "Demonstration") : "Submitted");
    } else if (step === "who") onTitle("Recipient");
    else if (step === "amount") onTitle("Amount");
    else if (step === "details") onTitle("Details");
    else onTitle("Send");
  }, [step, demo, demoStatus, onTitle]);

  function pick(next: Mode) {
    setMode(next);
    setError(null);
    setStep("who");
  }

  const speedLabel = demo ? "Does not settle" : "When it settles";
  const fromName = demo ? "Demonstration" : "Checking";
  const fromHint = demo ? "No real funds moved" : last4 ? `•••• ${last4}` : "MONEYLEAD checking";
  const toHint = demo ? "Sandbox demonstration" : "U.S. bank · ACH";

  if (step === "mode") {
    return (
      <div className="flex min-h-[50dvh] flex-col gap-4">
        <p className="text-sm leading-relaxed text-muted">
          Send money to a U.S. bank account. We’ll show the real status of your transfer.
        </p>
        {bankingTransfers ? (
          <Button
            className="w-full"
            size="lg"
            disabled={!checking}
            onClick={() => (checking ? pick("ach") : setError("Your checking account needs to be open first."))}
          >
            <Landmark className="size-4" aria-hidden />
            Bank transfer
          </Button>
        ) : (
          <p className="text-sm text-muted">Partner transfers are paused.</p>
        )}
        {!checking ? (
          <p className="text-sm leading-relaxed text-muted">
            Bank transfer is available after your checking account is open.
          </p>
        ) : null}
        {sandboxDemo ? (
          <Button variant="secondary" className="w-full" size="lg" onClick={() => pick("demo")}>
            Sandbox demonstration
          </Button>
        ) : null}
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex min-h-[60dvh] flex-col">
      {demo && step !== "confirm" && step !== "done" ? <DemoMark className="mb-4" /> : null}

      {step === "who" ? (
        <div className="flex flex-1 flex-col gap-5">
          <p className="text-sm leading-relaxed text-muted">
            {demo
              ? "Demonstration only. Enter a recipient name. No routing number is submitted to a bank."
              : "ACH to a U.S. bank account. Sending by email, phone, or name is not available yet."}
          </p>
          <Field label="Recipient" htmlFor="name">
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jordan Lee" autoComplete="name" />
          </Field>
          {!demo ? (
            <>
              <Field label="Routing number" htmlFor="rt">
                <Input id="rt" value={routing} onChange={(e) => setRouting(e.target.value)} inputMode="numeric" placeholder="9 digits" />
              </Field>
              <Field label="Account number" htmlFor="ac">
                <Input id="ac" value={account} onChange={(e) => setAccount(e.target.value)} inputMode="numeric" />
              </Field>
            </>
          ) : (
            <Field label="Note" htmlFor="note" hint="Optional. Demonstration only — not sent to a bank.">
              <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} />
            </Field>
          )}
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button
            className="mt-auto w-full"
            size="lg"
            onClick={() => {
              if (!name.trim()) return setError("Enter a recipient name.");
              if (!demo && !/^\d{9}$/.test(routing.replace(/\D/g, ""))) return setError("Enter a 9-digit routing number.");
              if (!demo && account.replace(/\D/g, "").length < 4) return setError("Enter a valid account number.");
              setError(null);
              setStep("amount");
            }}
          >
            Continue
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => setStep("mode")}>
            Back
          </Button>
        </div>
      ) : null}

      {step === "amount" ? (
        <div className="flex flex-1 flex-col gap-5">
          <button type="button" className="text-left text-sm text-muted" onClick={() => setStep("who")}>
            To {name}
          </button>
          <AmountDisplay cents={cents} />
          {checking && !demo ? (
            <p className="text-center text-sm text-muted">
              Available <Amount cents={checking.availableCents} size="sm" />
            </p>
          ) : (
            <p className="text-center text-sm text-muted">Demonstration amounts do not change a balance.</p>
          )}
          <AmountKeypad cents={cents} onChange={setCents} />
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button
            className="mt-auto w-full"
            size="lg"
            onClick={() => {
              if (cents < 100) return setError("Minimum transfer is $1.00.");
              setError(null);
              setStep(demo ? "confirm" : "details");
            }}
          >
            Continue
          </Button>
        </div>
      ) : null}

      {step === "details" && !demo ? (
        <div className="flex flex-1 flex-col gap-5">
          <div className="divide-y divide-line">
            <DetailRow label="From" value={last4 ? `Checking · •••• ${last4}` : "Checking"} />
            <DetailRow label="To" value={name} />
            <DetailRow label="Amount" value={formatUsd(cents)} />
            <DetailRow label="Fee" value="$0.00" />
            <DetailRow label="Speed" value="When it settles" />
          </div>
          <Field label="Note" htmlFor="note" hint="Optional. Shown to the banking partner as the ACH description.">
            <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} />
          </Field>
          <div className="mt-auto flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setStep("amount")}>
              Back
            </Button>
            <Button className="flex-1" onClick={() => setStep("confirm")}>
              Review
            </Button>
          </div>
        </div>
      ) : null}

      {step === "confirm" ? (
        <div className="flex flex-1 flex-col">
          <HeroAmount cents={cents} align="center" />
          <div className="amount-ruler mx-auto mt-3 w-full max-w-xs" aria-hidden />
          {demo ? <DemoMark className="mt-5" /> : null}
          <div className="mt-5">
            <PartyCard
              fromName={fromName}
              fromHint={fromHint}
              toName={name.trim()}
              toHint={toHint}
              fromAvatar={demo ? "D" : <Landmark className="size-4" aria-hidden />}
              toAvatar={name.trim().charAt(0).toUpperCase() || "?"}
            />
          </div>
          <div className="mt-4 divide-y divide-line">
            <DetailRow label="Fee" value="$0.00" />
            <DetailRow label="Speed" value={speedLabel} />
            <DetailRow label="Note" value={note.trim() || "—"} />
          </div>
          {!demo ? (
            <label className="mt-4 flex items-start gap-3 text-sm leading-relaxed">
              <input type="checkbox" className="mt-1 size-4" checked={authorized} onChange={(e) => setAuthorized(e.target.checked)} />
              I authorize this ACH debit. It is not complete until the banking partner reports it.
            </label>
          ) : (
            <p className="mt-4 text-center text-sm text-muted">Your actual balance will not change.</p>
          )}
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
          <Button
            className="mt-6 w-full"
            size="lg"
            disabled={busy}
            onClick={() => {
              if (!demo && !authorized) return setError("Authorization is required.");
              if (!demo) setReauth(true);
              else void submit();
            }}
          >
            {busy ? "Submitting…" : demo ? "Start demonstration" : "Confirm"}
          </Button>
          <Button variant="ghost" className="mt-2 w-full" onClick={() => setStep(demo ? "amount" : "details")}>
            Back
          </Button>
        </div>
      ) : null}

      {step === "done" ? (
        <div className="mt-2 flex flex-1 flex-col">
          {demo ? <DemoMark className="mb-5" /> : null}
          <p className="text-center text-sm text-muted">
            {demo
              ? demoStatus === "failed"
                ? "Demonstration failed. No funds moved."
                : "Demonstration pending"
              : "Submitted to the banking partner"}
          </p>
          <HeroAmount className="mt-4" cents={cents} align="center" />
          <div className="amount-ruler mx-auto mt-3 w-full max-w-xs" aria-hidden />
          <div className="mt-8">
            <PartyCard
              fromName={fromName}
              fromHint={fromHint}
              toName={name.trim()}
              toHint={toHint}
              fromAvatar={demo ? "D" : <Landmark className="size-4" aria-hidden />}
              toAvatar={name.trim().charAt(0).toUpperCase() || "?"}
            />
          </div>
          <p className="mt-6 text-sm leading-relaxed text-muted">
            {demo
              ? `${DEMO_WATERMARK} Status will move from pending to failed. Activity will show this demonstration.`
              : `Status will update when the transfer settles. This is not marked complete here.`}
          </p>
          <Button className="mt-8 w-full" size="lg" onClick={onClose}>
            Done
          </Button>
          <Button
            variant="ghost"
            className="mt-2 w-full"
            onClick={() => {
              setStep("mode");
              setMode(null);
              setCents(0);
              setAuthorized(false);
              setNote("");
              setDemoTxId(null);
              setDemoStatus(null);
              setKey(crypto.randomUUID());
            }}
          >
            Send another
          </Button>
        </div>
      ) : null}

      <ReauthDialog
        open={reauth}
        title="Confirm this transfer"
        description="Sending money requires a security check."
        onClose={() => setReauth(false)}
        onSuccess={() => {
          setReauth(false);
          void submit();
        }}
      />
    </div>
  );

  async function submit() {
    setBusy(true);
    setError(null);
    if (demo) {
      const r = await createDemoTransferFn({
        data: { amountCents: cents, name, memo: note || undefined, idempotencyKey: key },
      });
      setBusy(false);
      if (!r.ok) setError(r.error);
      else {
        setDemoTxId(r.transactionId ?? r.id);
        setDemoStatus("pending");
        await qc.invalidateQueries({ queryKey: ["workspace"] });
        await qc.invalidateQueries({ queryKey: ["tx"] });
        setStep("done");
      }
      return;
    }
    const r = await sendMoneyFn({
      data: {
        amountCents: cents,
        name,
        routing,
        account,
        memo: note || undefined,
        authorized: true,
        idempotencyKey: key,
      },
    });
    setBusy(false);
    if (!r.ok) setError(r.error);
    else {
      await qc.invalidateQueries({ queryKey: ["workspace"] });
      await qc.invalidateQueries({ queryKey: ["transfers"] });
      await qc.invalidateQueries({ queryKey: ["tx"] });
      setStep("done");
    }
  }
}

function PartyCard({
  fromName,
  fromHint,
  toName,
  toHint,
  fromAvatar,
  toAvatar,
}: {
  fromName: string;
  fromHint: string;
  toName: string;
  toHint: string;
  fromAvatar: React.ReactNode;
  toAvatar: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-paper p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted">From</p>
          <p className="mt-0.5 truncate text-sm font-semibold text-ink">{fromName}</p>
          <p className="truncate text-xs text-muted">{fromHint}</p>
        </div>
        <div className="relative h-12 w-16 shrink-0">
          <span className="absolute left-0 top-0 flex size-11 items-center justify-center rounded-full bg-surface text-sm font-medium text-ink shadow-card">
            {fromAvatar}
          </span>
          <span className="absolute left-5 top-0 flex size-11 items-center justify-center rounded-full bg-ink text-sm font-medium text-paper shadow-card">
            {toAvatar}
          </span>
        </div>
      </div>
      <div className="mt-4 border-t border-line pt-4">
        <p className="text-xs text-muted">To</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-ink">{toName}</p>
        <p className="truncate text-xs text-muted">{toHint}</p>
      </div>
    </div>
  );
}
