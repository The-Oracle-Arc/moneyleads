import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader, Panel, Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { NativeSelect, Textarea } from "@/components/ui/input";
import { Amount } from "@/components/money/amount";
import { Badge, txTone } from "@/components/ui/badge";
import { disputeTransactionFn, getTransactionFn } from "@/lib/banking/api";
import { DemoMark } from "@/components/money/demo-mark";
import { DEMO_WATERMARK } from "@/lib/banking/identity";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/transactions/$id")({ component: TxDetail });

function TxDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["tx", id],
    queryFn: () => getTransactionFn({ data: { id } }),
  });
  const [reason, setReason] = useState("not_recognized");
  const [details, setDetails] = useState("");
  const tx = q.data;
  if (q.isPending) return <p className="text-sm text-muted">Retrieving transaction…</p>;
  if (!tx) return <p className="text-sm text-danger">Transaction not found.</p>;
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Activity" title={tx.merchant} description={tx.description} />
      {tx.isDemonstration ? <DemoMark /> : null}
      <Panel className="space-y-4">
        <Amount cents={tx.amountCents} signed size="xl" />
        <Badge tone={txTone(tx.status)}>{tx.status}</Badge>
        <dl className="divide-y divide-line">
          <Detail k="Date" v={new Date(tx.createdAt).toLocaleString()} />
          <Detail k="Posted" v={tx.postedAt ? new Date(tx.postedAt).toLocaleString() : "—"} />
          <Detail k="Category" v={tx.category.replaceAll("_", " ")} />
          <Detail k="Description" v={tx.description} />
          <Detail k="Account" v={tx.accountLabel} />
          <Detail k="Card" v={tx.last4 ? `•••• ${tx.last4}` : "—"} />
          <Detail k="Counterparty" v={tx.counterparty ?? "—"} />
          <Detail k="Reference" v={tx.id} />
          {tx.isDemonstration ? <Detail k="Type" v={DEMO_WATERMARK} /> : null}
        </dl>
      </Panel>
      <Panel className="space-y-3">
        <h2 className="font-medium">About this activity</h2>
        <p className="text-sm text-muted">
          {tx.isDemonstration
            ? `${DEMO_WATERMARK} This demonstration never changes a real balance.`
            : "Status updates when the transfer settles. If something looks wrong, report a problem below."}
        </p>
      </Panel>
      <Panel className="space-y-3">
        <h2 className="font-medium">Report a problem</h2>
        {tx.disputeId ? (
          <p className="text-sm text-muted">A dispute is already open for this charge.</p>
        ) : (
          <>
            <Field label="Reason" htmlFor="reason">
              <NativeSelect id="reason" value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="not_recognized">I don’t recognize this</option>
                <option value="duplicate">Duplicate</option>
                <option value="incorrect_amount">Incorrect amount</option>
                <option value="goods_not_received">Goods not received</option>
              </NativeSelect>
            </Field>
            <Field label="Details" htmlFor="d">
              <Textarea id="d" value={details} onChange={(e) => setDetails(e.target.value)} />
            </Field>
            <Button
              variant="danger"
              onClick={async () => {
                const r = await disputeTransactionFn({ data: { id: tx.id, reason, details } });
                if (!r.ok) toast.error(r.error);
                else toast.success("Dispute opened");
                await qc.invalidateQueries({ queryKey: ["tx", id] });
              }}
            >
              Dispute transaction
            </Button>
          </>
        )}
      </Panel>
      <Panel>
        <p className="text-sm text-muted">Need help with this transaction?</p>
        <Link to="/support" className="mt-2 inline-flex h-11 items-center text-sm font-medium text-lead">
          Contact support
        </Link>
      </Panel>
    </div>
  );
}

function Detail({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 text-sm">
      <dt className="text-muted">{k}</dt>
      <dd className="max-w-[60%] break-all text-right tabular text-ink">{v}</dd>
    </div>
  );
}
