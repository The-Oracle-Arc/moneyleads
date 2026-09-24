import { createFileRoute } from "@tanstack/react-router";
import { OpsList } from "@/components/admin/ops-list";

export const Route = createFileRoute("/admin/cards")({
  component: () => (
    <OpsList
      resource="cards"
      title="Debit cards"
      description="Column’s public API does not issue consumer debit cards. This list stays empty until an issuer is connected."
      columns={[
        { key: "last4", label: "Last 4" },
        { key: "status", label: "Status", kind: "status" },
        { key: "holder_name", label: "Holder" },
        { key: "frozen", label: "Frozen" },
        { key: "created_at", label: "Created", kind: "date" },
      ]}
    />
  ),
});
