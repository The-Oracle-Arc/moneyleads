import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/field";
import { AccountCard } from "@/components/money/account-card";
import { useWorkspace } from "@/hooks/use-workspace";

export const Route = createFileRoute("/_app/bank/details")({ component: Details });

function Details() {
  const { data } = useWorkspace();
  const holder = [data?.profile?.legalFirstName, data?.profile?.legalLastName].filter(Boolean).join(" ");
  return (
    <div className="space-y-6">
      <PageHeader title="Account details" description="Your routing and account numbers." />
      <AccountCard
        account={data?.checking}
        holder={holder}
        sandbox={data?.banking.environment === "sandbox"}
        configured={data?.banking.configured}
      />
    </div>
  );
}
