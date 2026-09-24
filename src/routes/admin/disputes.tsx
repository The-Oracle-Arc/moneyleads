import { createFileRoute } from "@tanstack/react-router";
import { OpsList } from "@/components/admin/ops-list";

export const Route = createFileRoute("/admin/disputes")({
  component: () => (
    <OpsList
      resource="disputes"
      title="Disputes"
      description="Customer-reported transaction problems. Resolving is an operations action and is audited."
      search
      customerLink="user_id"
      actions={[{ label: "Resolve", action: "dispute.resolve" }]}
      columns={[
        { key: "reason", label: "Reason" },
        { key: "status", label: "Status", kind: "status" },
        { key: "transaction_id", label: "Transaction", kind: "id" },
        { key: "created_at", label: "When", kind: "date" },
      ]}
    />
  ),
});
