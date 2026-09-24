import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { adminActFn, adminCustomerFn } from "@/lib/banking/admin-api";
import { PageHeader, Panel, Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge, txTone } from "@/components/ui/badge";
import { formatUsd } from "@/lib/banking/money";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/customers/$id")({ component: Customer });

function Customer() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-customer", id],
    queryFn: () => adminCustomerFn({ data: { id } }),
  });
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const p = q.data?.profile;

  async function act(action: string, entityId: string, extra?: string) {
    const r = await adminActFn({ data: { action, entityId, note: extra } });
    if (!r.ok) toast.error(r.error);
    else toast.success("Recorded");
    await qc.invalidateQueries({ queryKey: ["admin-customer", id] });
  }

  if (q.isPending) return <p className="text-sm text-muted">Loading customer…</p>;
  if (!p) return <p className="text-sm text-danger">Customer not found.</p>;
  const name = [p.legal_first_name, p.legal_last_name].filter(Boolean).join(" ") || "Customer";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Customer"
        title={String(name)}
        description="Sensitive values are redacted. Full account numbers and hashes are not shown here."
      />
      <Panel className="space-y-2 text-sm">
        <Row k="Email" v={String(p.email ?? "—")} />
        <Row k="Username" v={String(p.username ?? "—")} />
        <Row k="MONEYLEAD User ID" v={String(p.moneylead_user_id ?? "—")} />
        <Row k="Phone" v={String(p.phone ?? "—")} />
        <Row k="Date of birth" v={String(p.dob ?? "—")} />
        <Row k="SSN" v={p.ssn_last4 ? `•••-••-${p.ssn_last4}` : "—"} />
        <Row k="KYC" v={String(p.kyc_status).replaceAll("_", " ")} />
        <Row k="Partner verification" v={String(p.provider_verification_status ?? "—")} />
        <Row k="Checking" v={String(p.checking_status).replaceAll("_", " ")} />
        <Row k="Credit" v={String(p.credit_status).replaceAll("_", " ")} />
        <Row k="Onboarding" v={String(p.onboarding_step).replaceAll("_", " ")} />
        <Row k="Partner entity" v={String(p.provider_entity_id ?? "—")} />
        <div className="flex flex-wrap gap-2 pt-3">
          <Button size="sm" variant="secondary" onClick={() => void act("kyc.refresh", String(p.id))}>
            Refresh KYC from Column
          </Button>
        </div>
      </Panel>

      <Panel className="space-y-3">
        <h2 className="font-medium">Accounts</h2>
        {!q.data?.accounts.length ? (
          <p className="text-sm text-muted">No checking account on file.</p>
        ) : (
          q.data.accounts.map((a) => (
            <div key={String(a.id)} className="border-t border-line pt-3 first:border-0 first:pt-0">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">Checking · •••• {a.account_last4 ?? "—"}</p>
                <Badge tone={txTone(String(a.status))}>{String(a.status)}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted">
                Available {formatUsd(Number(a.available_cents ?? 0))} · Current {formatUsd(Number(a.current_cents ?? 0))} ·
                Pending {formatUsd(Number(a.pending_cents ?? 0))}
              </p>
              <p className="mt-1 text-xs text-subtle">
                Routing last4 {a.routing_last4 || "—"} · Partner {a.provider_account_id || "—"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" onClick={() => void act("account.sync", String(a.id))}>
                  Sync from Column
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void act("account.freeze", String(a.id))}>
                  Freeze
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void act("account.unfreeze", String(a.id))}>
                  Unfreeze
                </Button>
              </div>
            </div>
          ))
        )}
      </Panel>

      <Panel className="space-y-2">
        <h2 className="font-medium">Addresses</h2>
        {!q.data?.addresses.length ? (
          <p className="text-sm text-muted">No address on file.</p>
        ) : (
          q.data.addresses.map((row) => (
            <p key={String(row.id)} className="border-t border-line py-2 text-sm first:border-0">
              <span className="capitalize text-muted">{String(row.kind ?? "home")}</span>
              <span className="mt-1 block">
                {[row.line1, row.line2, row.city, row.state, row.postal_code].filter(Boolean).join(", ")}
              </span>
            </p>
          ))
        )}
      </Panel>

      <Panel className="space-y-2">
        <h2 className="font-medium">Identity checks</h2>
        {!q.data?.kyc.length ? <p className="text-sm text-muted">None</p> : null}
        {q.data?.kyc.map((row) => (
          <div key={String(row.id)} className="flex justify-between gap-3 border-t border-line py-2 text-sm first:border-0">
            <span className="text-muted">{String(row.provider)}</span>
            <span className="tabular">
              {String(row.status)} {row.provider_verification_status ? `· ${row.provider_verification_status}` : ""}
            </span>
          </div>
        ))}
      </Panel>

      <TwoCol
        title="Transfers"
        empty="No transfers"
        rows={q.data?.transfers}
        render={(row) => (
          <>
            <span>
              {String(row.direction)} {String(row.method)} · {String(row.counterparty_name)}
            </span>
            <span className="tabular">
              {formatUsd(Number(row.amount_cents ?? 0))} · {String(row.status)}
            </span>
          </>
        )}
      />
      <TwoCol
        title="Transactions"
        empty="No transactions"
        rows={q.data?.transactions}
        render={(row) => (
          <>
            <span>{String(row.merchant)}</span>
            <span className="tabular">
              {formatUsd(Number(row.amount_cents ?? 0))} · {String(row.status)}
            </span>
          </>
        )}
      />
      <TwoCol
        title="Support"
        empty="No cases"
        rows={q.data?.support}
        render={(row) => (
          <>
            <Link to="/admin/support/$id" params={{ id: String(row.id) }} className="text-lead">
              {String(row.subject)}
            </Link>
            <Badge tone={txTone(String(row.status))}>{String(row.status)}</Badge>
          </>
        )}
      />
      <TwoCol
        title="Fraud / risk"
        empty="No flags"
        rows={q.data?.fraud}
        render={(row) => (
          <>
            <span>{String(row.title)}</span>
            <span>
              {String(row.severity)} · {String(row.status)}
            </span>
          </>
        )}
      />
      <TwoCol
        title="Credit applications"
        empty="None"
        rows={q.data?.creditApps}
        render={(row) => (
          <>
            <span>{String(row.status).replaceAll("_", " ")}</span>
            <span className="max-w-xs truncate text-muted">{String(row.decision_reason ?? "—")}</span>
          </>
        )}
      />

      <Panel className="space-y-3">
        <h2 className="font-medium">Staff notes</h2>
        {q.data?.notes.map((n) => (
          <p key={String(n.id)} className="border-t border-line py-2 text-sm first:border-0">
            {String(n.body)}
            <span className="mt-1 block text-xs text-muted">{n.created_at ? new Date(String(n.created_at)).toLocaleString() : ""}</span>
          </p>
        ))}
        <Field label="Add note" htmlFor="note">
          <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Button
          variant="secondary"
          onClick={async () => {
            if (!note.trim()) return;
            await act("note.add", String(p.id), note);
            setNote("");
          }}
        >
          Save note
        </Button>
      </Panel>

      <Panel className="space-y-3">
        <h2 className="font-medium">Message customer</h2>
        <p className="text-sm text-muted">Sends an in-app notification. Email/SMS is not connected.</p>
        <Field label="Message" htmlFor="msg">
          <Input id="msg" value={message} onChange={(e) => setMessage(e.target.value)} />
        </Field>
        <Button
          onClick={async () => {
            if (!message.trim()) return;
            await act("notify.customer", String(p.user_id), message);
            setMessage("");
          }}
        >
          Send notification
        </Button>
      </Panel>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line py-2 last:border-0">
      <span className="text-muted">{k}</span>
      <span className="max-w-xs truncate text-right tabular">{v}</span>
    </div>
  );
}

function TwoCol({
  title,
  empty,
  rows,
  render,
}: {
  title: string;
  empty: string;
  rows?: Record<string, string | number | boolean | null>[];
  render: (row: Record<string, string | number | boolean | null>) => React.ReactNode;
}) {
  return (
    <Panel className="space-y-2">
      <h2 className="font-medium">{title}</h2>
      {!rows?.length ? <p className="text-sm text-muted">{empty}</p> : null}
      {rows?.map((row, i) => (
        <div key={String(row.id ?? i)} className="flex items-center justify-between gap-3 border-t border-line py-2 text-sm first:border-0">
          {render(row)}
        </div>
      ))}
    </Panel>
  );
}
