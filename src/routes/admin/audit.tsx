import { createFileRoute } from "@tanstack/react-router";
import { OpsList } from "@/components/admin/ops-list";

export const Route = createFileRoute("/admin/audit")({
  component: () => (
    <OpsList
      resource="audit"
      title="Audit logs"
      description="Record of sensitive customer and operator actions. Secrets are never stored here."
      search
      columns={[
        { key: "action", label: "Action" },
        { key: "actor_role", label: "Role" },
        { key: "entity_type", label: "Entity" },
        { key: "entity_id", label: "ID", kind: "id" },
        { key: "created_at", label: "When", kind: "date" },
      ]}
    />
  ),
});
