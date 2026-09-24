import { cn } from "@/lib/utils";

export function PlasticCard({
  variant,
  last4,
  holder,
  expMonth,
  expYear,
  frozen,
}: {
  variant: "debit" | "credit";
  last4: string;
  holder: string;
  expMonth: number;
  expYear: number;
  frozen?: boolean;
}) {
  const debit = variant === "debit";
  return (
    <div
      className={cn(
        "relative aspect-[1.586/1] w-full max-w-md overflow-hidden rounded-2xl p-6 text-left shadow-float",
        debit ? "bg-ink text-paper" : "bg-lead text-lead-fg",
        frozen && "opacity-70",
      )}
    >
      <div className="pointer-events-none absolute -right-10 -top-16 size-48 rounded-full bg-paper/8" />
      <div className="pointer-events-none absolute -bottom-12 -left-8 size-40 rounded-full bg-paper/6" />
      <div className="relative flex items-start justify-between">
        <p className="text-[11px] font-semibold tracking-[0.22em]">MONEYLEAD</p>
        <p className="text-[11px] uppercase tracking-[0.16em] opacity-70">{debit ? "Debit" : "Credit"}</p>
      </div>
      <div className="relative mt-12">
        <p className="text-[11px] uppercase tracking-[0.14em] opacity-60">Card number</p>
        <p className="mt-1 text-lg font-medium tabular tracking-[0.22em]">•••• {last4}</p>
      </div>
      <div className="relative mt-8 flex items-end justify-between">
        <p className="text-sm tracking-wide">{holder}</p>
        <p className="tabular text-sm opacity-80">
          {String(expMonth).padStart(2, "0")}/{String(expYear).slice(-2)}
        </p>
      </div>
      {frozen ? (
        <p className="absolute right-6 top-14 text-[11px] uppercase tracking-[0.16em]">Frozen</p>
      ) : null}
    </div>
  );
}
