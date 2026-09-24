import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, EmptyState } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { AmountDisplay, AmountKeypad } from "@/components/ui/amount-input";
import { AccountCard } from "@/components/money/account-card";
import { copyText } from "@/components/money/copy-button";
import { formatUsd } from "@/lib/banking/money";
import type { BankAccountView, CustomerProfile } from "@/lib/banking/types";
import { toast } from "sonner";

export function ReceivePanel({
  account,
  profile,
  configured,
}: {
  account: BankAccountView | null | undefined;
  profile?: CustomerProfile | null;
  configured?: boolean;
}) {
  const [request, setRequest] = useState(false);
  const [cents, setCents] = useState(0);
  const [note, setNote] = useState("");
  const holder = [profile?.legalFirstName, profile?.legalLastName].filter(Boolean).join(" ");

  if (!account) {
    return (
      <EmptyState
        title="Account details unavailable"
        body={
          configured
            ? "Open a checking account first. Routing and account numbers appear when your account is ready."
            : "Your banking account is being prepared. Account numbers will appear when it’s ready."
        }
      />
    );
  }

  const checking: BankAccountView = account;

  async function shareRequest() {
    if (cents < 100) {
      toast.error("Enter at least $1.00.");
      return;
    }
    const message = [
      `Please send ${formatUsd(cents)} to my MONEYLEAD checking account.`,
      holder ? `Account holder: ${holder}` : null,
      `Routing: ${checking.routingNumber}`,
      `Account: ${checking.accountNumberFull || checking.accountNumberMasked}`,
      note ? `Note: ${note}` : null,
      checking.isSandbox ? "MONEYLEAD sandbox. Production banking integration pending approval." : null,
    ]
      .filter(Boolean)
      .join("\n");
    if (navigator.share) {
      try {
        await navigator.share({ title: "MONEYLEAD request", text: message });
        return;
      } catch {
        /* fall through to copy */
      }
    }
    await copyText("Request", message);
  }

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-muted">
        Share these details for a paycheck or bank deposit.
      </p>
      <AccountCard account={checking} holder={holder} sandbox={checking.isSandbox} configured={configured} />
      {request ? (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold tracking-tight">Request money</h3>
          <p className="text-sm text-muted">
            This shares your real account details. It does not create a payment network request.
          </p>
          <AmountDisplay cents={cents} />
          <AmountKeypad cents={cents} onChange={setCents} />
          <Field label="Note" htmlFor="req-note" hint="Optional.">
            <Input id="req-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} />
          </Field>
          <Button className="w-full" size="lg" onClick={() => void shareRequest()}>
            Share request
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => setRequest(false)}>
            Back
          </Button>
        </div>
      ) : (
        <Button variant="secondary" className="w-full" onClick={() => setRequest(true)}>
          Request money
        </Button>
      )}
    </div>
  );
}
