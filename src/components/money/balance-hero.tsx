import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { HeroAmount } from "@/components/money/amount";
import { usePrivacyMode } from "@/hooks/use-privacy";
import type { BankAccountView } from "@/lib/banking/types";

export function BalanceHero({
  account,
  configured,
}: {
  account: BankAccountView | null | undefined;
  configured?: boolean;
}) {
  const privacy = usePrivacyMode((s) => s.enabled);

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">Balance</p>
        <Link
          to="/bank"
          className="inline-flex h-8 items-center gap-0.5 rounded-full bg-lead-soft px-3 text-xs font-medium text-lead"
        >
          Checking
          <ChevronRight className="size-3.5" aria-hidden />
        </Link>
      </div>
      {account ? (
        <HeroAmount className="mt-3" cents={account.availableCents} masked={privacy} />
      ) : (
        <>
          <HeroAmount className="mt-3" empty />
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
            {configured
              ? "Finish verification to open a checking account. This is not a zero balance."
              : "Your banking account is being prepared. Balance appears when your account is ready."}
          </p>
        </>
      )}
    </section>
  );
}
