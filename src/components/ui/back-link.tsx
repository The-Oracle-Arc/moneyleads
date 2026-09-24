import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

type BackTo =
  | "/home"
  | "/bank"
  | "/cards"
  | "/profile"
  | "/support"
  | "/onboarding"
  | "/bank/transfers"
  | "/bank/details"
  | "/payments"
  | "/activity";

export function BackLink({ to, label = "Back" }: { to: BackTo; label?: string }) {
  return (
    <Link
      to={to}
      className="-ml-2 inline-flex h-11 items-center gap-0.5 pr-3 text-sm font-medium text-ink"
    >
      <ChevronLeft className="size-5" aria-hidden />
      {label}
    </Link>
  );
}
