import { cn } from "@/lib/utils";

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden="true">
      <rect width="32" height="32" rx="10" fill="currentColor" />
      <path d="M9 21.5V10.5h3.1l3.9 7.2 3.9-7.2H23V21.5h-2.6v-7.1l-3.4 6.1h-1.9l-3.4-6.1v7.1H9Z" fill="#f4f4f2" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 text-lead">
      <Mark />
      {compact ? (
        <span className="sr-only">MONEYLEAD</span>
      ) : (
        <span className="text-[13px] font-semibold tracking-[0.16em] text-ink">MONEYLEAD</span>
      )}
    </div>
  );
}
