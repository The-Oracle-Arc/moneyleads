import { createFileRoute } from "@tanstack/react-router";
import { OpsList } from "@/components/admin/ops-list";

export const Route = createFileRoute("/admin/ach")({
  component: () => (
    <OpsList
      resource="transfers"
      title="ACH"
      description="ACH submitted to Column. Settlement is reported by the banking partner. MONEYLEAD does not mark a transfer complete locally. Sandbox demonstration transfers never change balances."
      search
      columns={[
        { key: "id", label: "Transfer" },
        { key: "direction", label: "Direction" },
        { key: "amount_cents", label: "Amount", kind: "money" },
        { key: "status", label: "Status", kind: "status" },
        { key: "counterparty_name", label: "Counterparty" },
        { key: "provider_status", label: "Partner" },
        { key: "created_at", label: "Created", kind: "date" },
      ]}
    />
  ),
});
