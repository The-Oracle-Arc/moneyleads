import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { EmptyState, Panel } from "@/components/ui/field";
import { AmountDisplay, AmountKeypad } from "@/components/ui/amount-input";
import { fundAccountFn } from "@/lib/banking/api";
import { formatUsd } from "@/lib/banking/money";
import type { BankAccountView } from "@/lib/banking/types";
import { Building2, Landmark, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/use-workspace";
import { toast } from "sonner";

type Method = "ach" | "linked" | "direct";

export function AddMoneyFlow({
  checking,
  onClose,
}: {
  checking: BankAccountView | null | undefined;
  onClose?: () => void;
}) {
  const qc = useQueryClient();
  const { data } = useWorkspace();
  const incomingAllowed = data?.flags?.sandboxIncomingAch !== false;
  const [method, setMethod] = useState<Method>(incomingAllowed ? "ach" : "direct");
  const [cents, setCents] = useState(0);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (!checking) {
    return (
      <EmptyState
        title="No checking account"
        body="Add money after your checking account is open."
      />
    );
  }

  if (done) {
    return (
      <div className="space-y-4 py-6 text-center">
        <p className="text-sm text-muted">Submitted to the banking partner</p>
        <p className="display text-4xl font-semibold tabular">{formatUsd(cents)}</p>
        <p className="text-sm leading-relaxed text-muted">
          Incoming transfers can take a little time to appear. We’ll show the real status.
        </p>
        <Button className="w-full" size="lg" onClick={onClose}>
          Done
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm leading-relaxed text-muted">
        Only methods that actually exist are offered. Linked external banks are not connected.
      </p>
      <div className="grid gap-2">
        <MethodRow
          active={method === "ach"}
          icon={Landmark}
          title="Bank transfer"
          body={
            incomingAllowed
              ? "Incoming bank transfer. Funds appear when the transfer settles."
              : "Sandbox incoming ACH is turned off."
          }
          onClick={() => incomingAllowed && setMethod("ach")}
        />
        <MethodRow
          active={method === "direct"}
          icon={Building2}
          title="Direct deposit"
          body="Use your routing and account numbers with payroll."
          onClick={() => setMethod("direct")}
        />
        <MethodRow
          active={method === "linked"}
          icon={Wallet}
          title="Linked bank"
          body="Not connected. MONEYLEAD does not pretend a Plaid-style link exists."
          onClick={() => setMethod("linked")}
        />
      </div>

      {method === "linked" ? (
        <Panel>
          <p className="text-sm leading-relaxed text-muted">
            Linking an external bank is not implemented. Use a bank transfer or direct deposit when those are available.
          </p>
        </Panel>
      ) : method === "direct" ? (
        <Panel className="space-y-2">
          <p className="text-sm text-muted">Give these numbers to payroll.</p>
          <p className="tabular text-sm">Routing {checking.routingNumber || "unavailable"}</p>
          <p className="tabular text-sm">Account {checking.accountNumberMasked || "unavailable"}</p>
        </Panel>
      ) : !incomingAllowed ? (
        <Panel>
          <p className="text-sm leading-relaxed text-muted">
            Incoming bank transfers are paused. Direct deposit details are still available when you have an account.
          </p>
        </Panel>
      ) : (
        <>
          <AmountDisplay cents={cents} />
          <AmountKeypad cents={cents} onChange={setCents} />
          <label className="flex items-start gap-3 text-sm leading-relaxed">
            <input
              type="checkbox"
              className="mt-1 size-4"
              checked={authorized}
              onChange={(e) => setAuthorized(e.target.checked)}
            />
            I understand this transfer is pending until it settles.
          </label>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button
            className="w-full"
            size="lg"
            disabled={busy}
            onClick={async () => {
              if (cents < 100) return setError("Minimum is $1.00.");
              if (!authorized) return setError("Authorization is required.");
              setBusy(true);
              setError(null);
              const r = await fundAccountFn({
                data: {
                  method: "ach",
                  amountCents: cents,
                  counterparty: "External bank",
                  idempotencyKey: crypto.randomUUID(),
                },
              });
              setBusy(false);
              if (!r.ok) {
                setError(r.error);
                toast.error(r.error);
              } else {
                await qc.invalidateQueries({ queryKey: ["workspace"] });
                await qc.invalidateQueries({ queryKey: ["transfers"] });
                await qc.invalidateQueries({ queryKey: ["tx"] });
                setDone(true);
              }
            }}
          >
            {busy ? "Sending transfer…" : "Add money"}
          </Button>
        </>
      )}
    </div>
  );
}

function MethodRow({
  active,
  icon: Icon,
  title,
  body,
  onClick,
}: {
  active: boolean;
  icon: typeof Landmark;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-2xl px-4 py-4 text-left shadow-card",
        active ? "bg-ink text-paper" : "bg-surface text-ink",
      )}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className={cn("mt-1 block text-sm leading-relaxed", active ? "text-paper/70" : "text-muted")}>{body}</span>
      </span>
    </button>
  );
}
