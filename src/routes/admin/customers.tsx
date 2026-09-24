import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { OpsList } from "@/components/admin/ops-list";

export const Route = createFileRoute("/admin/customers")({ component: Customers });

function Customers() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/admin/customers") return <Outlet />;
  return (
    <OpsList
      resource="customers"
      title="Customers"
      description="MONEYLEAD profiles. Identity status is owned by the banking partner."
      search
      customerLink="id"
      columns={[
        { key: "legal_first_name", label: "First" },
        { key: "legal_last_name", label: "Last" },
        { key: "email", label: "Email" },
        { key: "username", label: "Username" },
        { key: "moneylead_user_id", label: "User ID" },
        { key: "kyc_status", label: "KYC", kind: "status" },
        { key: "checking_status", label: "Checking", kind: "status" },
        { key: "credit_status", label: "Credit", kind: "status" },
        { key: "created_at", label: "Created", kind: "date" },
      ]}
    />
  );
}
