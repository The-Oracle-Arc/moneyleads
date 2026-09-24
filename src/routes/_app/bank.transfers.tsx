import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader, Panel, Field, EmptyState } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Amount } from "@/components/money/amount";
import { Badge, txTone } from "@/components/ui/badge";
import { fundAccountFn, listTransfersFn, sendMoneyFn } from "@/lib/banking/api";
import { parseUsdToCents } from "@/lib/banking/money";
import { useWorkspace } from "@/hooks/use-workspace";
import { toast } from "sonner";
import { ReauthDialog } from "@/components/security/reauth-dialog";

export const Route = createFileRoute("/_app/bank/transfers")({ component: Transfers });

function Transfers() {
  const { data } = useWorkspace();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["transfers"], queryFn: () => listTransfersFn() });
  const [tab, setTab] = useState<"add" | "send" | "direct">("add");
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [routing, setRouting] = useState("");
  const [account, setAccount] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reauth, setReauth] = useState(false);

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["workspace"] });
    await qc.invalidateQueries({ queryKey: ["transfers"] });
    await qc.invalidateQueries({ queryKey: ["tx"] });
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Transfers"
        description="Send and add money. A transfer isn’t complete until it settles."
      />
      <div className="flex flex-wrap gap-2">
        <Button variant={tab === "add" ? "primary" : "secondary"} onClick={() => setTab("add")}>
          Add money
        </Button>
        <Button variant={tab === "send" ? "primary" : "secondary"} onClick={() => setTab("send")}>
          Send money
        </Button>
        <Button variant={tab === "direct" ? "primary" : "secondary"} onClick={() => setTab("direct")}>
          Direct deposit
        </Button>
      </div>
      <Panel className="max-w-lg space-y-4">
        {tab === "add" ? (
          <>
            <p className="text-sm text-muted">
              Incoming transfers can take a little time to appear. We’ll show funds when they actually arrive.
            </p>
            <Field label="Amount" htmlFor="amt">
              <Input id="amt" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="250.00" />
            </Field>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1" checked={authorized} onChange={(e) => setAuthorized(e.target.checked)} />
              I authorize this incoming ACH credit to my MONEYLEAD checking account in this sandbox environment.
            </label>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button
              disabled={busy}
              onClick={async () => {
                const cents = parseUsdToCents(amount);
                if (!cents) return setError("Enter a valid amount.");
                if (!authorized) return setError("Authorization is required.");
                setBusy(true);
                setError(null);
                const r = await fundAccountFn({
                  data: {
                    method: "ach",
                    amountCents: cents,
                    counterparty: "External bank (demo)",
                    idempotencyKey: crypto.randomUUID(),
                  },
                });
                setBusy(false);
                if (!r.ok) setError(r.error);
                else {
                  toast.success("Incoming transfer submitted");
                  setAmount("");
                  await refresh();
                }
              }}
            >
              {busy ? "Sending transfer…" : "Transfer in"}
            </Button>
          </>
        ) : tab === "direct" ? (
          <>
            <p className="text-sm text-muted">
              Give these numbers to payroll for direct deposit.
            </p>
            <Field label="Routing number">
              <p className="tabular font-medium">{data?.checking?.routingNumber ?? "—"}</p>
            </Field>
            <Field label="Account number">
              <p className="tabular font-medium">{data?.checking?.accountNumberMasked ?? "—"}</p>
            </Field>
            <Field label="Simulate a payroll amount" htmlFor="dd">
              <Input id="dd" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="2500.00" />
            </Field>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button
              disabled={busy}
              onClick={async () => {
                const cents = parseUsdToCents(amount);
                if (!cents) return setError("Enter a valid amount.");
                setBusy(true);
                setError(null);
                const r = await fundAccountFn({
                  data: {
                    method: "direct_deposit",
                    amountCents: cents,
                    counterparty: "Payroll",
                    idempotencyKey: crypto.randomUUID(),
                  },
                });
                setBusy(false);
                if (!r.ok) setError(r.error);
                else {
                  toast.success("Payroll transfer submitted");
                  setAmount("");
                  await refresh();
                }
              }}
            >
              Request payroll deposit
            </Button>
          </>
        ) : (
          <>
            <Field label="Recipient name" htmlFor="name">
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name on the account" />
            </Field>
            <Field label="Routing number" htmlFor="rt">
              <Input id="rt" value={routing} onChange={(e) => setRouting(e.target.value)} inputMode="numeric" />
            </Field>
            <Field label="Account number" htmlFor="ac">
              <Input id="ac" value={account} onChange={(e) => setAccount(e.target.value)} inputMode="numeric" />
            </Field>
            <Field label="Amount" htmlFor="amt2">
              <Input
                id="amt2"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="h-16 text-center text-3xl font-semibold tabular"
                inputMode="decimal"
              />
            </Field>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 size-4" checked={authorized} onChange={(e) => setAuthorized(e.target.checked)} />
              I authorize this ACH debit. It is not complete until the banking partner reports it.
            </label>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button
              disabled={busy}
              className="w-full"
              onClick={() => {
                const cents = parseUsdToCents(amount);
                if (!cents) return setError("Enter a valid amount.");
                if (!name.trim()) return setError("Enter a recipient.");
                if (!authorized) return setError("Authorization is required.");
                setError(null);
                setReauth(true);
              }}
            >
              Confirm transfer
            </Button>
          </>
        )}
      </Panel>
      <Panel>
        <h2 className="font-medium">Transfer history</h2>
        {list.isPending ? (
          <p className="mt-3 text-sm text-muted">Loading transfers…</p>
        ) : list.data?.length ? (
          <ul className="mt-3 divide-y divide-line">
            {list.data.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium">{t.counterpartyName}</p>
                  <p className="text-xs text-muted">
                    {t.direction} · {t.method.replace("_", " ")} · <Badge tone={txTone(t.status)}>{t.status}</Badge>
                  </p>
                </div>
                <Amount cents={t.direction === "outbound" ? -t.amountCents : t.amountCents} signed size="sm" />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4">
            <EmptyState title="No transfers" body="Inbound and outbound ACH will list here." />
          </div>
        )}
      </Panel>
      <ReauthDialog
        open={reauth}
        title="Confirm this transfer"
        description="Sending money requires a security check."
        onClose={() => setReauth(false)}
        onSuccess={() => {
          setReauth(false);
          void (async () => {
            const cents = parseUsdToCents(amount);
            if (!cents) return setError("Enter a valid amount.");
            setBusy(true);
            const r = await sendMoneyFn({
              data: {
                amountCents: cents,
                name,
                routing,
                account,
                authorized: true,
                idempotencyKey: crypto.randomUUID(),
              },
            });
            setBusy(false);
            if (!r.ok) setError(r.error);
            else {
              toast.success("Transfer submitted to the banking partner");
              await refresh();
            }
          })();
        }}
      />
    </div>
  );
}
