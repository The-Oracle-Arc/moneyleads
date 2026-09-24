import { HeroAmount } from "@/components/money/amount";
import { Delete } from "lucide-react";
import { cn } from "@/lib/utils";

export function AmountDisplay({ cents, prefix = "" }: { cents: number; prefix?: string }) {
  return (
    <div className="flex items-baseline justify-center gap-1.5 text-ink">
      {prefix ? <span className="text-xl font-medium text-muted">{prefix}</span> : null}
      <HeroAmount cents={cents} align="center" />
    </div>
  );
}

export function AmountKeypad({
  cents,
  onChange,
  disabled,
}: {
  cents: number;
  onChange: (cents: number) => void;
  disabled?: boolean;
}) {
  function press(digit: string) {
    if (disabled) return;
    if (digit === "del") {
      onChange(Math.floor(cents / 10));
      return;
    }
    const next = cents * 10 + Number(digit);
    if (next > 25_000_00) return;
    onChange(next);
  }

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"] as const;

  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((key, i) => {
        if (!key) return <span key={`empty-${i}`} />;
        return (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => press(key)}
            className={cn(
              "flex h-16 items-center justify-center rounded-xl text-2xl font-medium text-ink transition-[transform,background-color] duration-150 active:scale-[0.96] active:bg-surface disabled:opacity-40",
            )}
            aria-label={key === "del" ? "Delete" : key}
          >
            {key === "del" ? <Delete className="size-6" /> : key}
          </button>
        );
      })}
    </div>
  );
}
