import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader, Panel, Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { PlasticCard } from "@/components/cards/plastic-card";
import { Amount } from "@/components/money/amount";
import { TxRow } from "@/components/tx/tx-row";
import { listTransactionsFn, payCreditFn, updateCreditFn } from "@/lib/banking/api";
import { parseUsdToCents } from "@/lib/banking/money";
import { useWorkspace } from "@/hooks/use-workspace";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/cards/credit")({ component: Credit });

function Credit() {
  const { data, refetch } = useWorkspace();
  const card = data?.creditCard;
  const qc = useQueryClient();
  const tx = useQuery({ queryKey: ["tx"], queryFn: () => listTransactionsFn({ data: {} }) });
  const [amount, setAmount] = useState("");
  if (!card) {
    const status = data?.profile?.creditStatus ?? "not_applied";
    return (
      <div className="space-y-4">
        <PageHeader
          title="Credit card"
          description="Credit program pending. No licensed issuer is connected, so MONEYLEAD will not invent a card, APR, or limit."
        />
        {status === "not_applied" ? (
          <Link to="/cards/apply">
            <Button>Apply now</Button>
          </Link>
        ) : (
          <Panel>
            <p className="text-sm leading-relaxed text-muted">
              Application status: {status.replaceAll("_", " ")}. A licensed issuer must be connected before a card can
              exist.
            </p>
            <Link to="/cards/apply" className="mt-3 inline-flex h-11 items-center text-sm font-medium text-lead">
              View application
            </Link>
          </Panel>
        )}
      </div>
    );
  }
  const creditTx = tx.data?.filter((t) => t.last4 === card.last4 || t.cardId === card.id) ?? [];

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["workspace"] });
    await refetch();
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Cards"
        title="Credit card"
        description="Issued only by a connected credit provider. MONEYLEAD does not invent limits or APRs."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <PlasticCard
          variant="credit"
          last4={card.last4}
          holder={card.holderName}
          expMonth={card.expMonth}
          expYear={card.expYear}
          frozen={card.frozen}
        />
        <Panel className="space-y-3">
          <Row k="Current balance" v={<Amount cents={card.currentBalanceCents} />} />
          <Row k="Available credit" v={<Amount cents={card.availableCreditCents} />} />
          <Row k="Credit limit" v={<Amount cents={card.creditLimitCents} />} />
          <Row k="Statement balance" v={<Amount cents={card.statementBalanceCents} />} />
          <Row k="Minimum payment" v={<Amount cents={card.minimumPaymentCents} />} />
          <Row k="Payment due" v={<span>{card.paymentDueDate ?? "—"}</span>} />
          <Row k="Purchase APR" v={<span>{(card.aprPurchaseBps / 100).toFixed(2)}%</span>} />
        </Panel>
      </div>
      <Panel className="max-w-md space-y-3">
        <h2 className="font-medium">Make a payment</h2>
        <Field label="Amount from checking" htmlFor="pay">
          <Input id="pay" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="35.00" />
        </Field>
        <Button
          onClick={async () => {
            const cents = parseUsdToCents(amount);
            if (!cents) return toast.error("Enter a valid amount.");
            const r = await payCreditFn({ data: { amountCents: cents, idempotencyKey: crypto.randomUUID() } });
            if (!r.ok) toast.error(r.error);
            else toast.success("Payment submitted");
            setAmount("");
            await refresh();
          }}
        >
          Pay from checking
        </Button>
      </Panel>
      <Panel className="max-w-md space-y-3">
        <h2 className="font-medium">Autopay</h2>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={card.autopayEnabled}
            onChange={async (e) => {
              await updateCreditFn({ data: { autopayEnabled: e.target.checked, autopayAmount: card.autopayAmount ?? "minimum" } });
              await refresh();
            }}
          />
          Enable autopay
        </label>
        <NativeSelect
          value={card.autopayAmount ?? "minimum"}
          onChange={async (e) => {
            await updateCreditFn({
              data: { autopayEnabled: card.autopayEnabled, autopayAmount: e.target.value as "minimum" | "statement" | "full" },
            });
            await refresh();
          }}
        >
          <option value="minimum">Minimum payment</option>
          <option value="statement">Statement balance</option>
          <option value="full">Current balance</option>
        </NativeSelect>
      </Panel>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={async () => { await updateCreditFn({ data: { frozen: !card.frozen } }); await refresh(); }}>
          {card.frozen ? "Unfreeze" : "Freeze"} card
        </Button>
        <Link to="/bank/statements">
          <Button variant="ghost">View statement</Button>
        </Link>
      </div>
      <p className="text-sm text-muted">
        Replacement cards are not issued here. No credit-card issuer is connected, so MONEYLEAD will not invent a new
        last four.
      </p>
      <Panel>
        <h2 className="font-medium">Pending</h2>
        {tx.isPending ? (
          <p className="mt-3 text-sm text-muted">Loading activity…</p>
        ) : creditTx.filter((t) => t.status === "pending").length ? (
          <div className="mt-2 divide-y divide-line">
            {creditTx.filter((t) => t.status === "pending").map((t) => (
              <TxRow key={t.id} tx={t} />
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">No pending charges.</p>
        )}
      </Panel>
      <Panel>
        <h2 className="font-medium">Posted activity</h2>
        {tx.isPending ? (
          <p className="mt-3 text-sm text-muted">Loading activity…</p>
        ) : creditTx.filter((t) => t.status !== "pending").length ? (
          <div className="mt-2 divide-y divide-line">
            {creditTx.filter((t) => t.status !== "pending").map((t) => (
              <TxRow key={t.id} tx={t} />
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">No posted card activity.</p>
        )}
      </Panel>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted">{k}</span>
      <span className="text-ink">{v}</span>
    </div>
  );
}
