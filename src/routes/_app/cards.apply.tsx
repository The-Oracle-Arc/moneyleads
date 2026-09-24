import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Panel, Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { applyCreditFn } from "@/lib/banking/api";
import { parseUsdToCents } from "@/lib/banking/money";
import { useWorkspace } from "@/hooks/use-workspace";

export const Route = createFileRoute("/_app/cards/apply")({ component: Apply });

function Apply() {
  const { data, refetch } = useWorkspace();
  const navigate = useNavigate();
  const [employmentStatus, setEmployment] = useState("employed");
  const [income, setIncome] = useState("");
  const [housingStatus, setHousing] = useState("rent");
  const [housingPayment, setHousingPayment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ status: string; reason?: string; adverseAction?: string } | null>(null);

  if (data?.profile?.creditStatus === "submitted" || data?.profile?.creditStatus === "additional_info") {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Credit application"
          description="Your application is on file. No licensed issuer is connected, so there is no decision yet."
        />
        <Button onClick={() => navigate({ to: "/cards" })}>Back to cards</Button>
      </div>
    );
  }

  if (data?.flags && !data.flags.creditApplicationsOpen) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Credit application"
          description="Credit applications are not open. MONEYLEAD will not invent an approval while this is off."
        />
        <Button onClick={() => navigate({ to: "/cards" })}>Back to cards</Button>
      </div>
    );
  }

  if (data?.creditCard) {
    return (
      <div className="space-y-4">
        <PageHeader title="Credit application" description="You already have a credit card on file." />
        <Button onClick={() => navigate({ to: "/cards/credit" })}>View card</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Credit"
        title="Apply for credit"
        description="Credit is optional. No licensed issuer is connected. This application is stored only — MONEYLEAD will not invent an approval, APR, or credit limit."
      />
      <Panel className="max-w-lg space-y-4">
        <Field label="Employment status" htmlFor="emp">
          <NativeSelect id="emp" value={employmentStatus} onChange={(e) => setEmployment(e.target.value)}>
            <option value="employed">Employed</option>
            <option value="self_employed">Self-employed</option>
            <option value="student">Student</option>
            <option value="retired">Retired</option>
            <option value="unemployed">Unemployed</option>
          </NativeSelect>
        </Field>
        <Field label="Annual income" htmlFor="inc">
          <Input id="inc" value={income} onChange={(e) => setIncome(e.target.value)} placeholder="85000" />
        </Field>
        <Field label="Housing" htmlFor="hou">
          <NativeSelect id="hou" value={housingStatus} onChange={(e) => setHousing(e.target.value)}>
            <option value="rent">Rent</option>
            <option value="own">Own</option>
            <option value="family">Live with family</option>
          </NativeSelect>
        </Field>
        <Field label="Monthly housing payment" htmlFor="hp">
          <Input id="hp" value={housingPayment} onChange={(e) => setHousingPayment(e.target.value)} placeholder="1800" />
        </Field>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {result ? (
          <div className="rounded-md bg-lead-soft p-4 text-sm text-lead">
            <p className="font-medium capitalize">{result.status.replaceAll("_", " ")}</p>
            <p className="mt-1">{result.reason}</p>
            {result.adverseAction ? <p className="mt-2 text-ink">{result.adverseAction}</p> : null}
          </div>
        ) : null}
        <div className="flex gap-2">
          <Button
            onClick={async () => {
              const annual = parseUsdToCents(income);
              const housing = parseUsdToCents(housingPayment) ?? 0;
              if (!annual) return setError("Enter annual income.");
              const r = await applyCreditFn({
                data: {
                  employmentStatus,
                  annualIncomeCents: annual,
                  housingStatus,
                  housingPaymentCents: housing,
                },
              });
              if (!r.ok) setError(r.error);
              else {
                setResult({ status: r.status, reason: r.reason, adverseAction: r.adverseAction });
                await refetch();
                if (r.status === "approved") navigate({ to: "/cards/credit" });
              }
            }}
          >
            Submit application
          </Button>
          <Button variant="ghost" onClick={() => navigate({ to: "/cards" })}>
            Maybe later
          </Button>
        </div>
      </Panel>
    </div>
  );
}
