import { createFileRoute } from "@tanstack/react-router";
import { OpsList } from "@/components/admin/ops-list";

export const Route = createFileRoute("/admin/reconciliation")({
  component: () => (
    <OpsList
      resource="reconciliation"
      title="Reconciliation"
      description="Mismatches between local ledgers and Column balances. Open items need operator attention."
      search
      columns={[
        { key: "kind", label: "Kind" },
        { key: "status", label: "Status", kind: "status" },
        { key: "detail", label: "Detail" },
        { key: "created_at", label: "When", kind: "date" },
      ]}
    />
  ),
});
