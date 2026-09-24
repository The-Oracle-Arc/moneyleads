function bufToB64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBuf(id: string): ArrayBuffer {
  const pad = "=".repeat((4 - (id.length % 4)) % 4);
  const b64 = (id + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

export function webauthnAvailable(): boolean {
  return typeof window !== "undefined" && Boolean(window.PublicKeyCredential);
}

export async function createPlatformCredential(challenge: string, userId: string, displayName: string): Promise<string> {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: Uint8Array.from(challenge, (c) => c.charCodeAt(0)),
      rp: { name: "MONEYLEAD", id: location.hostname },
      user: {
        id: Uint8Array.from(userId.slice(0, 32), (c) => c.charCodeAt(0)),
        name: displayName,
        displayName,
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Device authentication was canceled.");
  return cred.id || bufToB64url(cred.rawId);
}

export async function assertPlatformCredential(challenge: string, allowCredentials: string[]): Promise<string> {
  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge: Uint8Array.from(challenge, (c) => c.charCodeAt(0)),
      allowCredentials: allowCredentials.map((id) => ({
        type: "public-key" as const,
        id: b64urlToBuf(id),
      })),
      userVerification: "required",
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Device authentication was canceled.");
  return cred.id || bufToB64url(cred.rawId);
}
