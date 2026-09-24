import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { assertWebauthnFn, issueWebauthnChallengeFn, verifyPasscodeFn } from "@/lib/banking/api";
import { assertPlatformCredential, webauthnAvailable } from "@/lib/banking/webauthn-client";
import { Fingerprint } from "lucide-react";

export function ReauthDialog({
  open,
  title = "Confirm it's you",
  description = "This action needs a quick security check.",
  onSuccess,
  onClose,
}: {
  open: boolean;
  title?: string;
  description?: string;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const bio = webauthnAvailable();

  async function withPin() {
    setBusy(true);
    setError(null);
    const r = await verifyPasscodeFn({ data: { passcode } });
    setBusy(false);
    if (!r.ok) setError(r.error);
    else {
      setPasscode("");
      onSuccess();
    }
  }

  async function withBio() {
    setBusy(true);
    setError(null);
    try {
      const ch = await issueWebauthnChallengeFn({ data: { purpose: "reauth" } });
      if (!ch.allowCredentials.length) {
        setError("Register Face ID in Security first, or use your passcode.");
        setBusy(false);
        return;
      }
      const credentialId = await assertPlatformCredential(ch.challenge, ch.allowCredentials);
      const r = await assertWebauthnFn({ data: { challenge: ch.challenge, credentialId } });
      setBusy(false);
      if (!r.ok) setError(r.error);
      else onSuccess();
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Device authentication is not available.");
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-muted">{description}</p>
        {bio ? (
          <Button className="w-full" onClick={() => void withBio()} disabled={busy}>
            <Fingerprint className="size-4" aria-hidden />
            Face ID or device biometric
          </Button>
        ) : null}
        <Field label="6-digit passcode" htmlFor="reauth-pass">
          <Input
            id="reauth-pass"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={passcode}
            onChange={(e) => setPasscode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
        </Field>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button className="w-full" variant={bio ? "secondary" : "primary"} disabled={busy || passcode.length !== 6} onClick={() => void withPin()}>
          {busy ? "Checking…" : "Confirm with passcode"}
        </Button>
        <Button className="w-full" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Sheet>
  );
}
