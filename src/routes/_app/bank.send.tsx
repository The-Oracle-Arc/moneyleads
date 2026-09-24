import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BackLink } from "@/components/ui/back-link";
import { SendFlow } from "@/components/money/send-flow";
import { useWorkspace } from "@/hooks/use-workspace";

export const Route = createFileRoute("/_app/bank/send")({ component: Send });

function Send() {
  const { data } = useWorkspace();
  const navigate = useNavigate();
  const [title, setTitle] = useState("Send");
  return (
    <div className="space-y-4">
      <BackLink to="/home" label="Home" />
      <h1 className="display text-3xl font-semibold tracking-tight">{title}</h1>
      <SendFlow
        checking={data?.checking}
        sandboxDemo={data?.flags?.sandboxDemonstration !== false}
        bankingTransfers={data?.flags?.bankingTransfers !== false}
        onClose={() => navigate({ to: "/activity" })}
        onTitle={setTitle}
      />
    </div>
  );
}
