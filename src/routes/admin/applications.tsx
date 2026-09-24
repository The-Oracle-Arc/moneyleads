import { createFileRoute } from "@tanstack/react-router";
import { OpsList } from "@/components/admin/ops-list";

export const Route = createFileRoute("/admin/applications")({
  component: () => (
    <OpsList
      resource="applications"
      title="Applications"
      description="Checking applications stored by MONEYLEAD. Approval is issued by the banking partner, not this console."
      search
      customerLink="user_id"
      columns={[
        { key: "product", label: "Product" },
        { key: "status", label: "Status", kind: "status" },
        { key: "decision_reason", label: "Reason" },
        { key: "submitted_at", label: "Submitted", kind: "date" },
      ]}
    />
  ),
});
