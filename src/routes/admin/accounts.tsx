import { createFileRoute } from "@tanstack/react-router";
import { OpsList } from "@/components/admin/ops-list";

export const Route = createFileRoute("/admin/accounts")({
  component: () => (
    <OpsList
      resource="accounts"
      title="Bank accounts"
      description="Checking accounts opened at Column. Full account numbers are not listed. Freeze is partner-owned."
      search
      customerLink="user_id"
      actions={[
        { label: "Sync Column", action: "account.sync" },
        { label: "Freeze", action: "account.freeze" },
        { label: "Unfreeze", action: "account.unfreeze" },
      ]}
      columns={[
        { key: "account_last4", label: "Account" },
        { key: "routing_last4", label: "Routing" },
        { key: "status", label: "Status", kind: "status" },
        { key: "available_cents", label: "Available", kind: "money" },
        { key: "current_cents", label: "Current", kind: "money" },
        { key: "pending_cents", label: "Pending", kind: "money" },
        { key: "last_synced", label: "Last sync", kind: "date" },
      ]}
    />
  ),
});
