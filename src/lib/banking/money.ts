/** Integer minor units (USD cents). Never use floats for money. */

const NARROW_SPACE = "\u202F";

export function formatUsd(cents: number): string {
  const sign = cents < 0 ? "−" : "";
  const abs = Math.abs(Math.trunc(cents));
  const dollars = Math.floor(abs / 100);
  const frac = abs % 100;
  return `${sign}$${dollars.toLocaleString("en-US")}.${frac.toString().padStart(2, "0")}`;
}

/** Large display amounts only (home hero, send confirm). Lists and statements keep commas. */
export function formatUsdPlain(cents: number): string {
  const abs = Math.abs(Math.trunc(cents));
  const dollars = Math.floor(abs / 100);
  const frac = abs % 100;
  const grouped = dollars.toString().replace(/\B(?=(\d{3})+(?!\d))/g, NARROW_SPACE);
  return `${grouped}.${frac.toString().padStart(2, "0")}`;
}

export function formatUsdSigned(cents: number): string {
  if (cents > 0) return `+${formatUsd(cents)}`;
  return formatUsd(cents);
}

export function parseUsdToCents(input: string): number | null {
  const cleaned = input.trim().replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const match = cleaned.match(/^(-)?(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  const neg = match[1] ? -1 : 1;
  const dollars = Number(match[2]);
  const frac = match[3] ? Number(match[3].padEnd(2, "0")) : 0;
  if (!Number.isSafeInteger(dollars) || dollars > 1_000_000_000) return null;
  return neg * (dollars * 100 + frac);
}

export function maskAccountNumber(accountNumber: string): string {
  const digits = accountNumber.replace(/\D/g, "");
  if (digits.length < 4) return "••••";
  return `••••${digits.slice(-4)}`;
}

export function visibleLast4(masked?: string | null): string | null {
  if (!masked) return null;
  const digits = masked.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : null;
}
