import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ActionPills, type MoneyAction } from "@/components/money/action-pills";
import { PageHeader, EmptyState } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { SendSheet } from "@/components/money/send-flow";
import { ReceivePanel } from "@/components/money/receive-panel";
import { AddMoneyFlow } from "@/components/money/add-money-flow";
import { Amount } from "@/components/money/amount";
import { Badge, txTone } from "@/components/ui/badge";
import { useWorkspace } from "@/hooks/use-workspace";
import { useQuery } from "@tanstack/react-query";
import { listTransfersFn } from "@/lib/banking/api";
import { formatCustomerTxStatus } from "@/lib/banking/customer-copy";

export const Route = createFileRoute("/_app/payments")({ component: Payments });

function Payments() {
  const { data } = useWorkspace();
  const [sheet, setSheet] = useState<Exclude<MoneyAction, "more"> | null>(null);
  const transfers = useQuery({ queryKey: ["transfers"], queryFn: () => listTransfersFn() });
  const checking = data?.checking;

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" description="Send, receive, and add money." />
      <ActionPills
        showMore={false}
        onAction={(action) => {
          if (action === "more") return;
          setSheet(action);
        }}
      />
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Transfers</h2>
          <Link to="/bank/transfers" className="text-sm font-medium text-muted">
            Details
          </Link>
        </div>
        {transfers.isPending ? (
          <p className="py-8 text-center text-sm text-muted">Loading transfers…</p>
        ) : transfers.data?.length ? (
          <ul className="divide-y divide-line">
            {transfers.data.map((t) => (
              <li key={t.id} className="flex min-h-14 items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{t.counterpartyName}</p>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                    <span className="capitalize">{t.direction}</span>
                    <span aria-hidden>·</span>
                    <span className="uppercase">{t.method}</span>
                    <Badge tone={txTone(t.status)}>{formatCustomerTxStatus(t.status)}</Badge>
                  </p>
                </div>
                <Amount cents={t.direction === "inbound" ? t.amountCents : -t.amountCents} signed size="sm" />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No transfers yet" body="Sends and deposits will appear here as they happen." />
        )}
      </section>

      <SendSheet
        open={sheet === "send"}
        onClose={() => setSheet(null)}
        checking={checking}
        sandboxDemo={data?.flags?.sandboxDemonstration !== false}
        bankingTransfers={data?.flags?.bankingTransfers !== false}
      />
      <Sheet open={sheet === "receive"} onClose={() => setSheet(null)} title="Receive">
        <ReceivePanel account={checking} profile={data?.profile} configured={data?.banking.configured} />
      </Sheet>
      <Sheet open={sheet === "add"} onClose={() => setSheet(null)} title="Add money">
        <AddMoneyFlow checking={checking} onClose={() => setSheet(null)} />
      </Sheet>
    </div>
  );
}
