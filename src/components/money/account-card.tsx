import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton, copyText } from "@/components/money/copy-button";
import type { BankAccountView } from "@/lib/banking/types";
import { usePrivacyMode } from "@/hooks/use-privacy";
import { cn } from "@/lib/utils";

function statusTone(status: BankAccountView["status"]) {
  if (status === "open") return "ok" as const;
  if (status === "pending") return "pending" as const;
  if (status === "frozen") return "warn" as const;
  return "danger" as const;
}

export function AccountCard({
  account,
  holder,
  sandbox,
  configured,
}: {
  account: BankAccountView | null | undefined;
  holder?: string;
  sandbox?: boolean;
  configured?: boolean;
}) {
  const [reveal, setReveal] = useState(false);
  const privacy = usePrivacyMode((s) => s.enabled);

  if (!account) {
    return (
      <section className="rounded-2xl bg-surface p-6 shadow-card">
        <p className="text-sm font-medium text-ink">MONEYLEAD Checking</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {configured
            ? "Account numbers appear after your checking account is open."
            : "Your banking account is being prepared. Account numbers will appear when it’s ready."}
        </p>
      </section>
    );
  }

  const accountValue = reveal ? account.accountNumberFull || "Unavailable" : account.accountNumberMasked;
  const routingValue =
    privacy && !reveal ? `••••${(account.routingNumber || "").replace(/\D/g, "").slice(-4)}` : account.routingNumber || "Unavailable";

  return (
    <section className="rounded-2xl bg-surface p-6 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-[0.16em] text-muted">CHECKING</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-ink">{account.name || "MONEYLEAD Checking"}</h2>
          {holder ? <p className="mt-0.5 text-sm text-muted">{holder}</p> : null}
        </div>
        <Badge tone={statusTone(account.status)}>{account.status}</Badge>
      </div>

      <dl className="mt-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <dt className="text-xs text-muted">Account number</dt>
            <dd className="mt-0.5 font-medium tabular tracking-wide text-ink">{accountValue}</dd>
          </div>
          <div className="flex items-center">
            <button
              type="button"
              className="inline-flex h-11 items-center gap-1.5 px-2 text-sm font-medium text-lead"
              onClick={() => setReveal((v) => !v)}
            >
              {reveal ? <EyeOff className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />}
              {reveal ? "Hide" : "Show"}
            </button>
            <CopyButton label="Account number" value={account.accountNumberFull || account.accountNumberMasked} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <dt className="text-xs text-muted">Routing number</dt>
            <dd className="mt-0.5 font-medium tabular tracking-wide text-ink">{routingValue}</dd>
          </div>
          <CopyButton label="Routing number" value={account.routingNumber} />
        </div>
      </dl>

      <p className={cn("mt-5 text-xs leading-relaxed text-muted")}>
        {sandbox || account.isSandbox
          ? "Sandbox account and routing numbers. Production banking integration is pending approval."
          : "Treat these numbers as sensitive. Show them only when making a transfer."}
      </p>

      <Button
        variant="secondary"
        className="mt-4 w-full"
        onClick={() =>
          void copyText(
            "Account details",
            `MONEYLEAD Checking\nRouting ${account.routingNumber}\nAccount ${account.accountNumberFull || account.accountNumberMasked}`,
          )
        }
      >
        Copy account details
      </Button>
    </section>
  );
}
