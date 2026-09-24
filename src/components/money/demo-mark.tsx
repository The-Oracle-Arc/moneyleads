import { DEMO_WATERMARK } from "@/lib/banking/identity";
import { cn } from "@/lib/utils";

export function DemoMark({ className }: { className?: string }) {
  return (
    <p className={cn("rounded-xl bg-warn-soft px-4 py-3 text-sm leading-relaxed text-warn", className)}>
      {DEMO_WATERMARK}
    </p>
  );
}
