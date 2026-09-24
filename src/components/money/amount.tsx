import { formatUsd, formatUsdPlain, formatUsdSigned } from "@/lib/banking/money";
import { usePrivacyMode } from "@/hooks/use-privacy";
import { cn } from "@/lib/utils";

export function Amount({
  cents,
  signed = false,
  className,
  size = "md",
  reveal,
}: {
  cents: number;
  signed?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl" | "hero";
  reveal?: boolean;
}) {
  const privacy = usePrivacyMode((s) => s.enabled);
  const text = privacy && !reveal ? "••••" : signed ? formatUsdSigned(cents) : formatUsd(cents);
  return (
    <span
      className={cn(
        "tabular text-ink",
        size === "sm" && "text-sm font-medium",
        size === "md" && "text-base font-medium",
        size === "lg" && "text-3xl font-semibold tracking-tight",
        size === "xl" && "display text-4xl font-semibold tracking-tight sm:text-5xl",
        size === "hero" && "display text-6xl font-semibold leading-none tracking-tight sm:text-7xl",
        signed && cents > 0 && !privacy && "text-credit",
        signed && cents < 0 && "text-ink",
        className,
      )}
    >
      {text}
    </span>
  );
}

export function HeroAmount({
  cents,
  masked,
  empty,
  align = "start",
  className,
}: {
  cents?: number;
  masked?: boolean;
  empty?: boolean;
  align?: "start" | "center";
  className?: string;
}) {
  return (
    <p className={cn("flex items-baseline gap-1.5 text-ink", align === "center" && "justify-center", className)}>
      {empty ? (
        <span className="display text-5xl font-semibold leading-none tracking-tight sm:text-6xl">—</span>
      ) : (
        <>
          <span className="text-2xl font-medium text-muted">$</span>
          <span className="display text-5xl font-semibold leading-none tracking-tight tabular sm:text-6xl">
            {masked ? "••••" : formatUsdPlain(cents ?? 0)}
          </span>
        </>
      )}
    </p>
  );
}
