import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Panel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { PROGRAM_DISCLAIMER, PROGRAM_SUMMARY } from "@/lib/banking/program";
import { setPrivacyModeFn } from "@/lib/banking/api";
import { useWorkspace } from "@/hooks/use-workspace";
import { usePrivacyMode } from "@/hooks/use-privacy";
import { ReauthDialog } from "@/components/security/reauth-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/profile/privacy")({ component: Privacy });

function Privacy() {
  const { data, refetch } = useWorkspace();
  const setLocal = usePrivacyMode((s) => s.setEnabled);
  const enabled = Boolean(data?.profile?.privacyMode);
  const [reauth, setReauth] = useState(false);

  async function apply(next: boolean) {
    const r = await setPrivacyModeFn({ data: { enabled: next } });
    if (!r.ok) toast.error("Could not update privacy mode");
    else {
      setLocal(next);
      toast.success(next ? "Privacy mode on" : "Privacy mode off");
      await refetch();
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Profile" title="Privacy" description="How MONEYLEAD handles your banking data." />
      <Panel className="space-y-4">
        <label className="flex min-h-12 items-center justify-between gap-3 text-sm">
          Privacy mode
          <Switch
            checked={enabled}
            onCheckedChange={(next) => {
              if (!next && enabled) setReauth(true);
              else void apply(next);
            }}
          />
        </label>
        <p className="text-sm leading-relaxed text-muted">
          When on, balances, amounts, and account numbers stay masked until you choose to reveal them.
        </p>
      </Panel>
      <Panel className="space-y-4 text-sm leading-relaxed text-muted">
        <p>{PROGRAM_SUMMARY}</p>
        <p>{PROGRAM_DISCLAIMER}</p>
        <p>
          MONEYLEAD is the customer experience. Checking accounts, routing numbers, balances, and ACH are provided by
          the banking partner when a credential is configured. Debit and credit cards require separate issuers.
        </p>
        <p>Full Social Security numbers are tokenized. Only the last four digits are stored for display.</p>
        <p>We do not sell personal information. Marketing messages are off unless you opt in.</p>
      </Panel>
      <ReauthDialog
        open={reauth}
        title="Turn off privacy mode"
        description="Revealing balances needs a security check."
        onClose={() => setReauth(false)}
        onSuccess={() => {
          setReauth(false);
          void apply(false);
        }}
      />
    </div>
  );
}
