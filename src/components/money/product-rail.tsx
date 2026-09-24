import { Link } from "@tanstack/react-router";
import { CreditCard, Landmark, WalletCards } from "lucide-react";
import { Amount } from "@/components/money/amount";
import type { BankAccountView, CreditCardView, DebitCardView } from "@/lib/banking/types";

export function ProductRail({
  checking,
  debit,
  credit,
  configured,
}: {
  checking: BankAccountView | null | undefined;
  debit: DebitCardView | null | undefined;
  credit: CreditCardView | null | undefined;
  configured: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Tile
        to="/bank/details"
        icon={Landmark}
        label="Checking"
        value={
          checking ? (
            <Amount cents={checking.availableCents} size="sm" />
          ) : (
            <span className="text-sm font-medium text-ink">—</span>
          )
        }
        hint={checking ? "Available" : configured ? "Not open" : "Preparing"}
      />
      <Tile
        to="/cards"
        icon={CreditCard}
        label="Cards"
        value={<span className="text-sm font-medium capitalize text-ink">{debit ? debit.status.replaceAll("_", " ") : "Pending"}</span>}
        hint={debit ? `•••• ${debit.last4}` : "Program pending"}
      />
      <Tile
        to="/cards/apply"
        icon={WalletCards}
        label="Credit"
        value={
          credit ? (
            <Amount cents={credit.availableCreditCents} size="sm" />
          ) : (
            <span className="text-sm font-medium text-ink">—</span>
          )
        }
        hint={credit ? "Available" : "Not applied"}
      />
    </div>
  );
}

function Tile({
  to,
  icon: Icon,
  label,
  value,
  hint,
}: {
  to: "/bank/details" | "/cards" | "/cards/apply";
  icon: typeof Landmark;
  label: string;
  value: React.ReactNode;
  hint: string;
}) {
  return (
    <Link
      to={to}
      className="flex min-h-30 flex-col rounded-2xl bg-paper p-3 transition-transform duration-150 active:scale-[0.98]"
    >
      <span className="flex size-8 items-center justify-center rounded-full bg-surface text-ink shadow-card">
        <Icon className="size-4" aria-hidden />
      </span>
      <p className="mt-3 text-xs text-muted">{label}</p>
      <div className="mt-1 truncate">{value}</div>
      <p className="mt-auto truncate pt-1 text-xs text-subtle">{hint}</p>
    </Link>
  );
}
