import { createFileRoute } from "@tanstack/react-router";
import { OpsList } from "@/components/admin/ops-list";

export const Route = createFileRoute("/admin/transfers")({
  component: () => (
    <OpsList
      resource="transfers"
      title="Transfers"
      description="ACH and other transfers. MONEYLEAD does not mark these complete without a partner update."
      search
      customerLink="user_id"
      columns={[
        { key: "counterparty_name", label: "Counterparty" },
        { key: "direction", label: "Direction" },
        { key: "method", label: "Method" },
        { key: "amount_cents", label: "Amount", kind: "money" },
        { key: "status", label: "Status", kind: "status" },
        { key: "provider_status", label: "Partner" },
        { key: "created_at", label: "When", kind: "date" },
      ]}
    />
  ),
});
