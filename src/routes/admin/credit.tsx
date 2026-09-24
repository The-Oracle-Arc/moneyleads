import { createFileRoute } from "@tanstack/react-router";
import { OpsList } from "@/components/admin/ops-list";

export const Route = createFileRoute("/admin/credit")({
  component: () => (
    <OpsList
      resource="credit"
      title="Credit applications"
      description="Applications are stored. No licensed issuer is connected, so this console cannot approve credit."
      search
      customerLink="user_id"
      actions={[
        { label: "Approve", action: "credit.approve" },
        { label: "Decline", action: "credit.decline" },
      ]}
      columns={[
        { key: "status", label: "Status", kind: "status" },
        { key: "employment_status", label: "Employment" },
        { key: "annual_income_cents", label: "Income", kind: "money" },
        { key: "decision_reason", label: "Reason" },
        { key: "submitted_at", label: "Submitted", kind: "date" },
      ]}
    />
  ),
});
