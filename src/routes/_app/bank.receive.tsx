import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/field";
import { ReceivePanel } from "@/components/money/receive-panel";
import { useWorkspace } from "@/hooks/use-workspace";

export const Route = createFileRoute("/_app/bank/receive")({ component: Receive });

function Receive() {
  const { data } = useWorkspace();
  return (
    <div className="space-y-6">
      <PageHeader title="Receive" description="Share your checking details only when you have a real account from the banking partner." />
      <ReceivePanel account={data?.checking} profile={data?.profile} configured={data?.banking.configured} />
    </div>
  );
}
