import { createFileRoute } from "@tanstack/react-router";
import { OpsList } from "@/components/admin/ops-list";

export const Route = createFileRoute("/admin/notifications")({
  component: () => (
    <OpsList
      resource="notifications"
      title="Notifications"
      description="In-app notifications sent to customers. Email and SMS are not connected."
      search
      customerLink="user_id"
      columns={[
        { key: "title", label: "Title" },
        { key: "kind", label: "Kind" },
        { key: "created_at", label: "Sent", kind: "date" },
        { key: "read_at", label: "Read", kind: "date" },
      ]}
    />
  ),
});
