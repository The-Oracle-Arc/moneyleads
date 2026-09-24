/** Date-preserving parse. Never substitutes today. */

export function parseSourceOccurredAt(raw: string): { ok: true; iso: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "Source occurred-at is required. MONEYLEAD will not assign today’s date." };
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s](\d{2}:\d{2}(?::\d{2})?)?)?/);
  if (!match) return { ok: false, error: "Source occurred-at must be YYYY-MM-DD (optional time). Original dates are preserved." };
  const day = match[1];
  const time = match[2] ? (match[2].length === 5 ? `${match[2]}:00` : match[2]) : "00:00:00";
  const d = new Date(`${day}T${time}Z`);
  if (Number.isNaN(d.getTime())) return { ok: false, error: "Source occurred-at is not a valid date." };
  if (d.getUTCFullYear() < 1970 || d.getUTCFullYear() > 2100) {
    return { ok: false, error: "Source occurred-at is outside the accepted range." };
  }
  return { ok: true, iso: d.toISOString() };
}
