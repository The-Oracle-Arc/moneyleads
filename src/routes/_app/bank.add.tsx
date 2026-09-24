import { createFileRoute } from "@tanstack/react-router";
import { BackLink } from "@/components/ui/back-link";
import { AddMoneyFlow } from "@/components/money/add-money-flow";
import { useWorkspace } from "@/hooks/use-workspace";

export const Route = createFileRoute("/_app/bank/add")({ component: AddMoney });

function AddMoney() {
  const { data } = useWorkspace();
  return (
    <div className="space-y-4">
      <BackLink to="/home" label="Home" />
      <h1 className="display text-3xl font-semibold tracking-tight">Add money</h1>
      <AddMoneyFlow checking={data?.checking} />
    </div>
  );
}
