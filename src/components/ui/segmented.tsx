import { cn } from "@/lib/utils";

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { id: T; label: string }[];
  className?: string;
}) {
  return (
    <div className={cn("flex gap-1 overflow-x-auto rounded-full bg-paper p-1 shadow-card", className)} role="tablist">
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={cn(
              "h-10 min-w-16 flex-1 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-[background-color,color,transform] duration-150 active:scale-[0.96]",
              active ? "bg-ink text-paper" : "text-muted",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
