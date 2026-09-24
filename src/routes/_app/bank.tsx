import { createFileRoute, Navigate, Outlet, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/bank")({ component: Bank });

function Bank() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname === "/bank") return <Navigate to="/payments" />;
  return <Outlet />;
}
