import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Panel, Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { closeAccountFn } from "@/lib/banking/api";
import { ReauthDialog } from "@/components/security/reauth-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/bank/close")({ component: Close });

function Close() {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const navigate = useNavigate();
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Bank"
        title="Close account"
        description="The checking balance must be $0.00. This closes the MONEYLEAD profile and asks the banking partner to close the account."
      />
      <Panel className="max-w-lg space-y-4">
        <Field label="Reason" htmlFor="reason">
          <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button
          variant="danger"
          onClick={() => setConfirm(true)}
        >
          Close checking account
        </Button>
      </Panel>
      <ReauthDialog
        open={confirm}
        title="Close this account"
        description="Closing an account is irreversible from this screen. Confirm it's you, then we will ask the banking partner to close it."
        onClose={() => setConfirm(false)}
        onSuccess={async () => {
          setConfirm(false);
          const r = await closeAccountFn({ data: { reason } });
          if (!r.ok) setError(r.error);
          else {
            toast.success("Account closed");
            navigate({ to: "/profile" });
          }
        }}
      />
    </div>
  );
}
