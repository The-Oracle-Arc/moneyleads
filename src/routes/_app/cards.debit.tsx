import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader, Panel, Field, EmptyState } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlasticCard } from "@/components/cards/plastic-card";
import { activateDebitFn, setDebitPinFn, updateDebitFn } from "@/lib/banking/api";
import { useWorkspace } from "@/hooks/use-workspace";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/cards/debit")({ component: Debit });

function Debit() {
  const { data, refetch } = useWorkspace();
  const card = data?.debitCard;
  const qc = useQueryClient();
  const [last4, setLast4] = useState("");
  const [pin, setPin] = useState("");
  if (!card) {
    return (
      <div className="space-y-4">
        <PageHeader title="Debit card" description="Card program pending until a card processor is connected." />
        <EmptyState
          title="Card program pending"
          body="Debit cards aren’t issued in this environment yet. Checking still works without a card."
        />
      </div>
    );
  }

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["workspace"] });
    await refetch();
  }

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Cards" title="Debit card" description="Manage your MONEYLEAD debit card when it’s issued." />
      <div className="grid gap-6 lg:grid-cols-2">
        <PlasticCard
          variant="debit"
          last4={card.last4}
          holder={card.holderName}
          expMonth={card.expMonth}
          expYear={card.expYear}
          frozen={card.frozen}
        />
        <Panel className="space-y-3 text-sm">
          <p>Status: {card.status}</p>
          <p>Network: Not issued</p>
          <p>Expiration: {String(card.expMonth).padStart(2, "0")}/{card.expYear}</p>
          <p>PIN: {card.pinSet ? "Set" : "Not set"}</p>
          <p>Shipping: {card.shippingStatus ?? "—"}</p>
        </Panel>
      </div>
      {card.status !== "active" && card.status !== "frozen" ? (
        <Panel className="max-w-md space-y-3">
          <Field label="Last four digits" htmlFor="l4">
            <Input id="l4" value={last4} onChange={(e) => setLast4(e.target.value)} />
          </Field>
          <Button
            onClick={async () => {
              const r = await activateDebitFn({ data: { last4: last4 || card.last4 } });
              if (r.ok) toast.success("Card activated");
              await refresh();
            }}
          >
            Activate
          </Button>
        </Panel>
      ) : null}
      <Panel className="max-w-md space-y-3">
        <Field label="Set 4-digit PIN" htmlFor="pin">
          <Input id="pin" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value)} />
        </Field>
        <Button
          variant="secondary"
          onClick={async () => {
            const r = await setDebitPinFn({ data: { pin } });
            if (!r.ok) toast.error(r.error);
            else toast.success("PIN saved");
            await refresh();
          }}
        >
          Save PIN
        </Button>
      </Panel>
      <Panel className="space-y-3">
        <h2 className="font-medium">Controls</h2>
        {(
          [
            ["online", "Online purchases"],
            ["atm", "ATM withdrawals"],
            ["pos", "In-store"],
            ["international", "International"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex h-11 items-center justify-between gap-3 text-sm">
            {label}
            <input
              type="checkbox"
              checked={card.controls[key]}
              onChange={async (e) => {
                await updateDebitFn({
                  data: { controls: { ...card.controls, [key]: e.target.checked } },
                });
                await refresh();
              }}
            />
          </label>
        ))}
      </Panel>
      <Panel className="space-y-3">
        <h2 className="font-medium">Card actions</h2>
        <p className="text-sm text-muted">
          Freeze, replace, and PIN changes are available once a card is issued.
        </p>
      </Panel>
      <Panel className="space-y-3">
        <h2 className="font-medium">Mobile wallets</h2>
        <p className="text-sm text-muted">
          Mobile wallets like Apple Pay and Google Pay are set up on a supported device after a card is issued.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => toast.message("Apple Pay is available through the card processor on a supported iPhone.")}
          >
            Add to Apple Wallet
          </Button>
          <Button
            variant="secondary"
            onClick={() => toast.message("Google Pay is available through the card processor on a supported Android device.")}
          >
            Add to Google Wallet
          </Button>
        </div>
      </Panel>
    </div>
  );
}
