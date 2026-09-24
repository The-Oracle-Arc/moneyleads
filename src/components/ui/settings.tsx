import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function SettingsGroup({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      {title ? <p className="mb-2 px-1 text-xs font-medium uppercase tracking-[0.14em] text-muted">{title}</p> : null}
      <div className="overflow-hidden rounded-xl bg-surface shadow-card">{children}</div>
    </section>
  );
}

export function SettingsItem({
  label,
  value,
  to,
  onClick,
  danger,
  trailing,
}: {
  label: string;
  value?: string;
  to?: string;
  onClick?: () => void;
  danger?: boolean;
  trailing?: React.ReactNode;
}) {
  const inner = (
    <>
      <span className={cn("text-sm font-medium", danger ? "text-danger" : "text-ink")}>{label}</span>
      <span className="flex min-w-0 items-center gap-2">
        {value ? <span className="truncate text-sm capitalize text-muted">{value}</span> : null}
        {trailing ?? <ChevronRight className="size-4 shrink-0 text-subtle" aria-hidden />}
      </span>
    </>
  );
  const cls = "flex min-h-12 w-full items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-0";
  if (to) {
    return (
      <Link to={to} className={cls}>
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls}>
        {inner}
      </button>
    );
  }
  return <div className={cls}>{inner}</div>;
}

export function SettingsToggle({
  label,
  description,
  control,
}: {
  label: string;
  description?: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 border-b border-line px-4 py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
      </div>
      {control}
    </div>
  );
}
