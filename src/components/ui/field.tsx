import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Panel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-2xl bg-surface p-6 shadow-card", className)}>
      {children}
    </section>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        {eyebrow ? <p className="text-xs font-medium tracking-[0.14em] text-muted uppercase">{eyebrow}</p> : null}
        <h1 className="display text-[2rem] font-semibold tracking-tight text-ink sm:text-4xl">{title}</h1>
        {description ? <p className="max-w-xl text-sm leading-relaxed text-muted">{description}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function EmptyState({
  title,
  body,
  icon: Icon,
  action,
}: {
  title: string;
  body: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-4 py-12 text-center">
      {Icon ? (
        <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-surface text-muted shadow-card">
          <Icon className="size-5" aria-hidden />
        </span>
      ) : null}
      <p className="font-medium text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-muted">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title,
  body,
  onRetry,
}: {
  title: string;
  body: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-xl bg-danger-soft px-6 py-8 text-center">
      <p className="font-medium text-danger">{title}</p>
      <p className="mt-1 text-sm text-ink/80">{body}</p>
      {onRetry ? (
        <button type="button" className="mt-4 text-sm font-medium text-lead underline" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function DetailRow({
  label,
  value,
  action,
}: {
  label: string;
  value: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-sm text-muted">{label}</span>
      <span className="flex min-w-0 items-center gap-3">
        <span className="truncate text-sm font-medium tabular text-ink">{value}</span>
        {action}
      </span>
    </div>
  );
}
