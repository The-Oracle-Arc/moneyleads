import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { OpsList } from "@/components/admin/ops-list";

export const Route = createFileRoute("/admin/support")({ component: Support });

function Support() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/admin/support") return <Outlet />;
  return (
    <OpsList
      resource="support"
      title="Support"
      description="Customer cases. Open a thread to reply. Closing is audited."
      search
      supportLink
      actions={[{ label: "Close", action: "support.close" }]}
      columns={[
        { key: "subject", label: "Subject" },
        { key: "status", label: "Status", kind: "status" },
        { key: "user_id", label: "Customer" },
        { key: "updated_at", label: "Updated", kind: "date" },
      ]}
    />
  );
}
