import { createFileRoute } from "@tanstack/react-router";
import { OpsList } from "@/components/admin/ops-list";

export const Route = createFileRoute("/admin/webhooks")({
  component: () => (
    <OpsList
      resource="webhooks"
      title="Webhooks"
      description="Column webhook deliveries. Duplicate event IDs are stored once. Payloads are not shown here."
      search
      columns={[
        { key: "event_type", label: "Type" },
        { key: "signature_valid", label: "Signature" },
        { key: "processing_status", label: "Status", kind: "status" },
        { key: "processing_error", label: "Error" },
        { key: "received_at", label: "Received", kind: "date" },
      ]}
    />
  ),
});
