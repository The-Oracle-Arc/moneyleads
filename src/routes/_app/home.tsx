import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, Search } from "lucide-react";
import { ActionPills, type MoneyAction } from "@/components/money/action-pills";
import { AddMoneyFlow } from "@/components/money/add-money-flow";
import { BalanceHero } from "@/components/money/balance-hero";
import { ProductRail } from "@/components/money/product-rail";
import { ReceivePanel } from "@/components/money/receive-panel";
import { SendSheet } from "@/components/money/send-flow";
import { EmptyState } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TxRow, TxList } from "@/components/tx/tx-row";
import { Sheet } from "@/components/ui/sheet";
import { Logo } from "@/components/brand/logo";
import { useWorkspace } from "@/hooks/use-workspace";
import { useQuery } from "@tanstack/react-query";
import { listTransactionsFn } from "@/lib/banking/api";
import { greetingFor } from "@/lib/banking/identity";
import { customerBankingPreparing, customerFinishVerification, customerVerificationWait } from "@/lib/banking/customer-copy";
import { cn } from "@/lib/utils";
import type { TransactionView } from "@/lib/banking/types";

export const Route = createFileRoute("/_app/home")({ component: Home });

type TxFilter = "all" | "pending" | "failed";

function matchesFilter(tx: TransactionView, filter: TxFilter) {
  if (filter === "all") return true;
  if (filter === "pending") return tx.status === "pending" || tx.status === "processing";
  return tx.status === "failed";
}

function Home() {
  const { data, user } = useWorkspace();
  const [sheet, setSheet] = useState<MoneyAction | null>(null);
  const [search, setSearch] = useState(false);
  const [q, setQ] = useState("");
  const [txFilter, setTxFilter] = useState<TxFilter>("all");
  const results = useQuery({
    queryKey: ["tx-search", q],
    queryFn: () => listTransactionsFn({ data: { query: q || undefined } }),
    enabled: search && q.length > 1,
  });
  if (!data) return null;
  const checking = data.checking;
  const first = data.profile?.preferredName || data.profile?.legalFirstName;
  const initial = (first || user?.displayName || "M").charAt(0).toUpperCase();
  const unread = data.notificationsUnread ?? 0;
  const assistantOn = data.flags?.assistantEnabled !== false;
  const hello = data.greeting || greetingFor(first);
  const visibleTx = data.recentTransactions.filter((tx) => matchesFilter(tx, txFilter));

  return (
    <div className="space-y-4 animate-rise">
      <header className="space-y-3">
        <div className="md:hidden">
          <Logo compact />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-semibold tracking-tight text-ink">{hello}</h1>
            <p className="mt-0.5 truncate text-xs text-muted">{homeStatus(data)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setSearch(true)}
              className="flex size-12 items-center justify-center rounded-full bg-surface shadow-card"
              aria-label="Search transactions"
            >
              <Search className="size-4" />
            </button>
            <Link
              to="/profile/notifications"
              className="relative flex size-12 items-center justify-center rounded-full bg-surface shadow-card"
              aria-label="Notifications"
            >
              <Bell className="size-4" />
              {unread > 0 ? <span className="absolute top-2 right-2 size-2 rounded-full bg-lead" /> : null}
            </Link>
            <Link
              to="/profile"
              className="flex size-12 items-center justify-center rounded-full bg-ink text-sm font-medium text-paper"
              aria-label="Profile"
            >
              {initial}
            </Link>
          </div>
        </div>
      </header>

      <section className="rounded-3xl bg-surface p-5 shadow-card">
        <BalanceHero account={checking} configured={data.banking.configured} />
        {data.providerSyncError ? <p className="mt-3 text-sm text-warn">{data.providerSyncError}</p> : null}
        <div className="mt-5">
          <ProductRail
            checking={checking}
            debit={data.debitCard}
            credit={data.creditCard}
            configured={data.banking.configured}
          />
        </div>
      </section>

      <div className="px-1">
        <ActionPills onAction={setSheet} />
      </div>

      <NextStep data={data} />

      <section className="rounded-3xl bg-surface px-5 pb-2 pt-5 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Transactions</h2>
          <Link to="/activity" className="text-sm font-medium text-muted">
            View all
          </Link>
        </div>
        <div className="mb-1 flex gap-2 overflow-x-auto pb-1">
          {(
            [
              ["all", "All"],
              ["pending", "Pending"],
              ["failed", "Failed"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTxFilter(id)}
              className={cn(
                "h-8 shrink-0 rounded-full px-3 text-xs font-medium",
                txFilter === id ? "bg-ink text-paper" : "bg-paper text-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {visibleTx.length ? (
          <TxList items={visibleTx} />
        ) : (
          <EmptyState
            title={data.recentTransactions.length ? "Nothing in this filter" : "No transactions yet"}
            body={
              data.recentTransactions.length
                ? "Posted activity from the banking partner appears under All."
                : "Your transactions will appear here once activity begins."
            }
          />
        )}
      </section>

      <SendSheet
        open={sheet === "send"}
        onClose={() => setSheet(null)}
        checking={checking}
        sandboxDemo={data.flags?.sandboxDemonstration !== false}
        bankingTransfers={data.flags?.bankingTransfers !== false}
      />
      <Sheet open={sheet === "receive"} onClose={() => setSheet(null)} title="Receive">
        <ReceivePanel account={checking} profile={data.profile} configured={data.banking.configured} />
      </Sheet>
      <Sheet open={sheet === "add"} onClose={() => setSheet(null)} title="Add money">
        <AddMoneyFlow checking={checking} onClose={() => setSheet(null)} />
      </Sheet>
      <Sheet open={sheet === "more"} onClose={() => setSheet(null)} title="More">
        <div className="grid gap-1">
          {[
            ["/bank/statements", "Statements"],
            ["/bank/details", "Account details"],
            ...(assistantOn ? ([["/assistant", "Assistant"]] as const) : []),
            ["/support", "Support"],
          ].map(([to, label]) => (
            <Link
              key={to}
              to={to as "/bank/statements"}
              className="flex h-12 items-center rounded-md px-2 text-sm font-medium"
              onClick={() => setSheet(null)}
            >
              {label}
            </Link>
          ))}
          <Link
            to="/bank/close"
            className="flex h-12 items-center rounded-md px-2 text-sm font-medium text-danger"
            onClick={() => setSheet(null)}
          >
            Close account
          </Link>
          <Button variant="secondary" className="mt-3 w-full" onClick={() => setSheet(null)}>
            Cancel
          </Button>
        </div>
      </Sheet>

      <Sheet open={search} onClose={() => setSearch(false)} title="Search">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Merchant, amount, or note"
          aria-label="Search transactions"
          autoFocus
        />
        <div className="mt-3">
          {q.length > 1 && results.data?.length ? (
            <div className="divide-y divide-line">
              {results.data.map((tx) => (
                <TxRow key={tx.id} tx={tx} />
              ))}
            </div>
          ) : q.length > 1 && !results.isPending ? (
            <EmptyState title="No matches" body="Nothing in your activity matches that search." />
          ) : (
            <p className="px-1 py-6 text-center text-sm text-muted">Search merchants, amounts, or notes.</p>
          )}
        </div>
      </Sheet>
    </div>
  );
}

function homeStatus(data: NonNullable<ReturnType<typeof useWorkspace>["data"]>) {
  if (data.checking) return "Checking available";
  if (!data.banking.configured) return "Account being prepared";
  const kyc = data.profile?.kycStatus ?? "not_started";
  if (["processing", "manual_review", "additional_info", "pending_documents", "selfie_required"].includes(kyc)) {
    return "Verification in progress";
  }
  return "Finish verification to open checking";
}

function NextStep({ data }: { data: NonNullable<ReturnType<typeof useWorkspace>["data"]> }) {
  if (data.checking) return null;
  const kyc = data.profile?.kycStatus ?? "not_started";
  const waitingOnPartner =
    ["processing", "manual_review", "additional_info", "pending_documents", "selfie_required"].includes(kyc) ||
    ["additional_review", "additional_info", "processing", "submitted"].includes(data.profile?.checkingStatus ?? "");
  const copy = !data.banking.configured
    ? customerBankingPreparing()
    : waitingOnPartner
      ? customerVerificationWait()
      : customerFinishVerification();
  return (
    <Link to="/onboarding" className="block rounded-3xl bg-surface p-5 shadow-card">
      <p className="text-sm font-medium text-ink">{copy.title}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">{copy.body}</p>
      <p className="mt-3 text-sm font-medium text-lead">{waitingOnPartner ? "View application" : "Continue"}</p>
    </Link>
  );
}
