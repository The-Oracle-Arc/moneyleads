import { createFileRoute } from "@tanstack/react-router";
import { OpsList } from "@/components/admin/ops-list";

export const Route = createFileRoute("/admin/creditCards")({
  component: () => (
    <OpsList
      resource="creditCards"
      title="Credit cards"
      description="No credit-card issuer is connected. Cards are never auto-approved or invented."
      customerLink="user_id"
      columns={[
        { key: "last4", label: "Last 4" },
        { key: "status", label: "Status", kind: "status" },
        { key: "holder_name", label: "Holder" },
        { key: "current_balance_cents", label: "Balance", kind: "money" },
        { key: "credit_limit_cents", label: "Limit", kind: "money" },
        { key: "created_at", label: "Created", kind: "date" },
      ]}
    />
  ),
});
