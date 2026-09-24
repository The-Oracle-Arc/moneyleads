import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader, Panel } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ackFraudFn,
  issueWebauthnChallengeFn,
  listDevicesFn,
  listFraudFn,
  listSessionsFn,
  registerWebauthnFn,
  revokeOtherSessionsFn,
  revokeSessionFn,
  saveSecurityFn,
  updateDeviceFn,
} from "@/lib/banking/api";
import { useWorkspace } from "@/hooks/use-workspace";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ReauthDialog } from "@/components/security/reauth-dialog";
import { createPlatformCredential, webauthnAvailable } from "@/lib/banking/webauthn-client";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/profile/security")({ component: Security });

function Security() {
  const { data, refetch } = useWorkspace();
  const devices = useQuery({ queryKey: ["devices"], queryFn: () => listDevicesFn() });
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: () => listSessionsFn() });
  const fraud = useQuery({ queryKey: ["fraud"], queryFn: () => listFraudFn() });
  const qc = useQueryClient();
  const [passcode, setPasscode] = useState("");
  const [reauth, setReauth] = useState<"passcode" | "revoke" | null>(null);
  const bio = webauthnAvailable();
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Profile"
        title="Security"
        description="Passcode, device trust, and alerts. Sign-in with Google, X, or email is separate from this app passcode."
      />
      <Panel className="max-w-md space-y-3">
        <p className="text-sm">Passcode {data?.profile?.passcodeSet ? "is set" : "is not set"}</p>
        <Input placeholder="New 6-digit passcode" value={passcode} onChange={(e) => setPasscode(e.target.value)} />
        <Button
          variant="secondary"
          onClick={() => setReauth("passcode")}
        >
          Update passcode
        </Button>
        <label className="flex h-11 items-center justify-between text-sm">
          Prefer biometrics on supported devices
          <Switch
            checked={Boolean(data?.profile?.biometricsEnabled)}
            onCheckedChange={async (checked) => {
              await saveSecurityFn({ data: { biometrics: checked } });
              await refetch();
            }}
          />
        </label>
        <label className="flex h-11 items-center justify-between text-sm">
          Require passcode for app access
          <Switch
            checked={Boolean(data?.profile?.twoFactorEnabled)}
            onCheckedChange={async (checked) => {
              await saveSecurityFn({ data: { twoFactor: checked } });
              await refetch();
            }}
          />
        </label>
        <label className="flex h-11 items-center justify-between text-sm">
          Login alerts
          <Switch
            checked={Boolean(data?.profile?.loginAlerts)}
            onCheckedChange={async (checked) => {
              await saveSecurityFn({ data: { loginAlerts: checked } });
              await refetch();
            }}
          />
        </label>
        {bio ? (
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                const ch = await issueWebauthnChallengeFn({ data: { purpose: "unlock" } });
                const id = await createPlatformCredential(
                  ch.challenge,
                  data?.profile?.id ?? "customer",
                  data?.profile?.username ?? "MONEYLEAD",
                );
                const r = await registerWebauthnFn({
                  data: { credentialId: id, deviceName: navigator.userAgent.slice(0, 48) },
                });
                if (!r.ok) toast.error(r.error);
                else toast.success("Face ID registered for quick unlock");
                await refetch();
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "This device does not support Face ID here.");
              }
            }}
          >
            Register Face ID / device biometric
          </Button>
        ) : (
          <p className="text-xs text-muted">This browser does not expose a platform authenticator. Use your passcode to unlock.</p>
        )}
      </Panel>
      <Panel>
        <h2 className="font-medium">Trusted devices</h2>
        <ul className="mt-3 divide-y divide-line">
          {devices.data?.map((d) => (
            <li key={d.id} className="flex items-center justify-between py-3 text-sm">
              <div>
                <p className="font-medium">
                  {d.name} {d.current ? "(this browser)" : ""}
                </p>
                <p className="text-xs text-muted">
                  {d.ipCity} · {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : ""}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await updateDeviceFn({ data: { id: d.id, trusted: !d.trusted } });
                  await qc.invalidateQueries({ queryKey: ["devices"] });
                }}
              >
                {d.trusted ? "Remove trust" : "Trust"}
              </Button>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel>
        <h2 className="font-medium">Sessions</h2>
        <Button
          className="mt-3 w-full"
          variant="secondary"
          onClick={() => setReauth("revoke")}
        >
          Sign out of all other devices
        </Button>
        <ul className="mt-3 divide-y divide-line">
          {sessions.data?.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-3 text-sm">
              <div>
                <p className="font-medium">{s.revoked ? "Revoked" : "Active"}</p>
                <p className="text-xs text-muted">
                  {s.ipCity ?? "Unknown"} · Last seen {s.lastSeenAt ? new Date(s.lastSeenAt).toLocaleString() : ""}
                </p>
              </div>
              {!s.revoked ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await revokeSessionFn({ data: { id: s.id } });
                    await qc.invalidateQueries({ queryKey: ["sessions"] });
                  }}
                >
                  Revoke
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </Panel>
      <Panel>
        <h2 className="font-medium">Fraud alerts</h2>
        <ul className="mt-3 space-y-3">
          {fraud.data?.map((f) => (
            <li key={f.id} className="rounded-md border border-line p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{f.title}</p>
                <Badge tone={f.status === "open" ? "warn" : "ok"}>{f.status}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted">{f.body}</p>
              {f.status === "open" ? (
                <Button
                  size="sm"
                  className="mt-2"
                  variant="secondary"
                  onClick={async () => {
                    await ackFraudFn({ data: { id: f.id } });
                    await qc.invalidateQueries({ queryKey: ["fraud"] });
                  }}
                >
                  This was me
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </Panel>
      <ReauthDialog
        open={Boolean(reauth)}
        title={reauth === "revoke" ? "Sign out other devices" : "Change passcode"}
        description="This is a high-risk security change."
        onClose={() => setReauth(null)}
        onSuccess={async () => {
          const kind = reauth;
          setReauth(null);
          if (kind === "revoke") {
            const r = await revokeOtherSessionsFn();
            if (!r.ok) toast.error("Could not sign out other devices");
            else toast.success("Other devices signed out");
            await qc.invalidateQueries({ queryKey: ["sessions"] });
            return;
          }
          const r = await saveSecurityFn({ data: { passcode } });
          if (!r.ok) toast.error(r.error);
          else toast.success("Passcode updated");
          setPasscode("");
          await refetch();
        }}
      />
    </div>
  );
}
