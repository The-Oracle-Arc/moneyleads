import { createHmac, timingSafeEqual } from "node:crypto";

export function computeColumnSignature(secret: string, rawBody: string): { hex: string; base64: string } {
  const hmac = createHmac("sha256", secret);
  hmac.update(rawBody);
  const digest = hmac.digest();
  return { hex: digest.toString("hex"), base64: digest.toString("base64") };
}

function equal(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function verifyColumnSignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const provided = header.trim();
  const { hex, base64 } = computeColumnSignature(secret, rawBody);
  return equal(provided, hex) || equal(provided.toLowerCase(), hex) || equal(provided, base64);
}
