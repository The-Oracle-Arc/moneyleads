/**
 * Username and MONEYLEAD User ID. Server-authoritative.
 * Usernames are not emails, auth IDs, Column entity IDs, or account numbers.
 */

const RESERVED = new Set([
  "admin",
  "administrator",
  "ultimate",
  "ultimateadmin",
  "ultimate_admin",
  "staff",
  "moneylead",
  "support",
  "system",
  "root",
  "security",
  "bank",
  "column",
  "fdic",
  "official",
  "compliance",
  "operations",
  "kyc",
  "fraud",
  "risk",
  "finance",
  "help",
  "null",
  "undefined",
]);

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, "");
}

export function validateUsername(input: string): { ok: true; username: string } | { ok: false; error: string } {
  const username = normalizeUsername(input);
  if (username.length < 3 || username.length > 20) {
    return { ok: false, error: "Usernames must be 3–20 characters." };
  }
  if (!/^[a-z][a-z0-9._]*$/.test(username)) {
    return { ok: false, error: "Use letters, numbers, periods, or underscores. Start with a letter." };
  }
  if (username.includes("..") || username.endsWith(".") || username.endsWith("_")) {
    return { ok: false, error: "Choose a simpler username." };
  }
  if (RESERVED.has(username) || username.startsWith("admin") || username.startsWith("staff")) {
    return { ok: false, error: "That username is reserved." };
  }
  return { ok: true, username };
}

export function formatMoneyleadUserId(n: number): string {
  const digits = Math.max(0, Math.trunc(n)).toString().padStart(8, "0").slice(-8);
  return `ML-${digits}`;
}

export function parseMoneyleadUserId(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.trim().toUpperCase().match(/^ML-(\d{8})$/);
  return match ? `ML-${match[1]}` : null;
}

export function greetingFor(firstName: string | null | undefined, now = new Date()): string {
  const hour = now.getHours();
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const name = conversationalFirstName(firstName);
  return name ? `${hello}, ${name}.` : `${hello}.`;
}

export function helloFor(firstName: string | null | undefined): string {
  const name = conversationalFirstName(firstName);
  return name ? `Hello, ${name}` : "Hello";
}

export function conversationalFirstName(firstName: string | null | undefined): string | null {
  if (!firstName) return null;
  const cleaned = firstName.trim();
  if (!/^[A-Za-z][A-Za-z'\- ]{0,39}$/.test(cleaned)) return null;
  if (cleaned.includes("@")) return null;
  return cleaned.split(/\s+/)[0] ?? null;
}

export const DEMO_WATERMARK = "SANDBOX / DEMONSTRATION — NO REAL FUNDS MOVED";
