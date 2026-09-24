import { createFileRoute } from "@tanstack/react-router";
import { OpsList } from "@/components/admin/ops-list";

export const Route = createFileRoute("/admin/fraud")({
  component: () => (
    <OpsList
      resource="fraud"
      title="Fraud / risk"
      description="Flags raised on customer activity. Clearing records the operator action in the audit log."
      search
      customerLink="user_id"
      actions={[{ label: "Clear", action: "fraud.clear" }]}
      columns={[
        { key: "title", label: "Alert" },
        { key: "severity", label: "Severity" },
        { key: "status", label: "Status", kind: "status" },
        { key: "created_at", label: "When", kind: "date" },
      ]}
    />
  ),
});
