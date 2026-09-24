import { createFileRoute } from "@tanstack/react-router";
import { OpsList } from "@/components/admin/ops-list";

export const Route = createFileRoute("/admin/transactions")({
  component: () => (
    <OpsList
      resource="transactions"
      title="Transactions"
      description="Ledger activity. Status comes from the banking partner when a transfer is involved."
      search
      customerLink="user_id"
      columns={[
        { key: "merchant", label: "Merchant" },
        { key: "amount_cents", label: "Amount", kind: "money" },
        { key: "status", label: "Status", kind: "status" },
        { key: "category", label: "Category" },
        { key: "provider_status", label: "Partner" },
        { key: "created_at", label: "When", kind: "date" },
      ]}
    />
  ),
});
