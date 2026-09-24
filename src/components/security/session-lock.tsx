import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { CodeInput } from "@/components/ui/input";
import { signOut } from "@/lib/auth/client";
import { assertWebauthnFn, issueWebauthnChallengeFn, verifyPasscodeFn } from "@/lib/banking/api";
import { SESSION_LOCK_MS } from "@/lib/banking/types";
import { assertPlatformCredential, webauthnAvailable } from "@/lib/banking/webauthn-client";
import { Fingerprint } from "lucide-react";

export function SessionLock({ enabled }: { enabled: boolean }) {
  const [locked, setLocked] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const bio = webauthnAvailable();

  useEffect(() => {
    if (!enabled) return;
    let last = Date.now();
    const mark = () => {
      last = Date.now();
    };
    const events: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "touchstart", "mousemove", "scroll"];
    for (const ev of events) window.addEventListener(ev, mark, { passive: true });
    const tick = window.setInterval(() => {
      if (!locked && Date.now() - last >= SESSION_LOCK_MS) setLocked(true);
    }, 1000);
    return () => {
      for (const ev of events) window.removeEventListener(ev, mark);
      window.clearInterval(tick);
    };
  }, [enabled, locked]);

  if (!enabled || !locked) return null;

  async function unlockPin() {
    setBusy(true);
    setError(null);
    const r = await verifyPasscodeFn({ data: { passcode } });
    setBusy(false);
    if (!r.ok) setError(r.error);
    else {
      setPasscode("");
      setLocked(false);
    }
  }

  async function unlockBio() {
    setBusy(true);
    setError(null);
    try {
      const ch = await issueWebauthnChallengeFn({ data: { purpose: "unlock" } });
      if (!ch.allowCredentials.length) {
        setError("Register Face ID in Security, or use your passcode.");
        setBusy(false);
        return;
      }
      const credentialId = await assertPlatformCredential(ch.challenge, ch.allowCredentials);
      const r = await assertWebauthnFn({ data: { challenge: ch.challenge, credentialId } });
      setBusy(false);
      if (!r.ok) setError(r.error);
      else setLocked(false);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Device authentication is not available.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-paper px-6">
      <div className="w-full max-w-sm space-y-6">
        <Logo />
        <div>
          <h1 className="display text-3xl font-semibold tracking-tight text-ink">Locked</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">Use Face ID or your passcode to continue.</p>
        </div>
        {bio ? (
          <Button className="w-full" size="lg" onClick={() => void unlockBio()} disabled={busy}>
            <Fingerprint className="size-4" aria-hidden />
            Unlock with Face ID
          </Button>
        ) : null}
        <Field label="Passcode" htmlFor="lock-pass">
          <CodeInput
            id="lock-pass"
            autoComplete="off"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
        </Field>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button className="w-full" variant={bio ? "secondary" : "primary"} size="lg" disabled={busy || passcode.length !== 6} onClick={() => void unlockPin()}>
          {busy ? "Unlocking…" : "Unlock with passcode"}
        </Button>
        <Button className="w-full" variant="ghost" onClick={() => void signOut("/login")}>
          Sign in again
        </Button>
      </div>
    </div>
  );
}
