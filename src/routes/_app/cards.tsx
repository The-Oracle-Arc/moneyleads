import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { PlasticCard } from "@/components/cards/plastic-card";
import { Amount } from "@/components/money/amount";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/hooks/use-workspace";

export const Route = createFileRoute("/_app/cards")({ component: Cards });

function Cards() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/cards") return <Outlet />;
  return <CardsHome />;
}

function CardsHome() {
  const { data } = useWorkspace();
  return (
    <div className="space-y-6">
      <PageHeader title="Cards" description="Debit and credit, when they’re issued for your account." />
      <Panel className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Debit</p>
          <Badge tone={data?.debitCard ? "ok" : "neutral"}>{data?.debitCard ? data.debitCard.status : "Not issued"}</Badge>
        </div>
        {data?.debitCard ? (
          <>
            <PlasticCard
              variant="debit"
              last4={data.debitCard.last4}
              holder={data.debitCard.holderName}
              expMonth={data.debitCard.expMonth}
              expYear={data.debitCard.expYear}
              frozen={data.debitCard.frozen}
            />
            <Link to="/cards/debit">
              <Button variant="secondary" className="w-full">
                Manage debit card
              </Button>
            </Link>
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex aspect-[1.586/1] w-full max-w-md items-center justify-center rounded-2xl border border-dashed border-line-strong bg-paper">
              <p className="px-8 text-center text-sm leading-relaxed text-muted">
                Card program pending. You can still use checking without a card.
              </p>
            </div>
            <Link to="/cards/debit">
              <Button variant="secondary" className="w-full">
                View debit status
              </Button>
            </Link>
          </div>
        )}
      </Panel>
      <Panel className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Credit</p>
          <Badge tone={data?.creditCard ? "ok" : "neutral"}>
            {data?.creditCard ? data.creditCard.status : data?.profile?.creditStatus === "not_applied" ? "Not applied" : (data?.profile?.creditStatus ?? "Unavailable").replaceAll("_", " ")}
          </Badge>
        </div>
        {data?.creditCard ? (
          <>
            <PlasticCard
              variant="credit"
              last4={data.creditCard.last4}
              holder={data.creditCard.holderName}
              expMonth={data.creditCard.expMonth}
              expYear={data.creditCard.expYear}
              frozen={data.creditCard.frozen}
            />
            <p className="text-sm text-muted">
              Balance <Amount cents={data.creditCard.currentBalanceCents} size="sm" /> ·{" "}
              <Amount cents={data.creditCard.availableCreditCents} size="sm" /> available
            </p>
            <Link to="/cards/credit">
              <Button variant="secondary" className="w-full">
                Manage credit card
              </Button>
            </Link>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-muted">
              Credit program pending. No licensed issuer is connected, so MONEYLEAD will not invent a score, limit, or approval.
            </p>
            {data?.flags?.creditApplicationsOpen === false ? (
              <p className="text-sm leading-relaxed text-muted">Credit applications are not open.</p>
            ) : (
              <Link to="/cards/apply">
                <Button variant="secondary" className="w-full">
                  Apply for credit
                </Button>
              </Link>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}
