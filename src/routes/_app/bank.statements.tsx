import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader, Panel, EmptyState, Field } from "@/components/ui/field";
import { Amount } from "@/components/money/amount";
import { TxRow } from "@/components/tx/tx-row";
import { Button } from "@/components/ui/button";
import { DemoMark } from "@/components/money/demo-mark";
import { generateCurrentStatementFn, generateStatementFn, getStatementFn, listStatementsFn, statementPdfFn } from "@/lib/banking/api";
import { downloadBase64 } from "@/lib/banking/download";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_app/bank/statements")({ component: Statements });

function Statements() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["statements"], queryFn: () => listStatementsFn() });
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const detail = useQuery({
    queryKey: ["statement", openId],
    queryFn: () => getStatementFn({ data: { id: openId! } }),
    enabled: Boolean(openId),
  });
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Bank"
        title="Statements"
        description="Statements of account from your activity. Original dates are preserved."
      />
      <DemoMark />
      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          className="w-full"
          variant="secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const r = await generateCurrentStatementFn();
            setBusy(false);
            if (!r.ok) toast.error("Could not generate this period");
            else {
              toast.success("Statement ready");
              await qc.invalidateQueries({ queryKey: ["statements"] });
              setOpenId(r.id);
            }
          }}
        >
          {busy ? "Generating statement…" : "Generate current month"}
        </Button>
        <Button
          className="w-full"
          variant="secondary"
          disabled={busy}
          onClick={async () => {
            const year = new Date().getUTCFullYear();
            setBusy(true);
            const r = await generateStatementFn({
              data: { periodStart: `${year}-01-01`, periodEnd: `${year}-12-31`, kind: "yearly" },
            });
            setBusy(false);
            if (!r.ok) toast.error("error" in r ? r.error : "Could not generate yearly statement");
            else {
              toast.success("Yearly statement ready");
              await qc.invalidateQueries({ queryKey: ["statements"] });
              setOpenId(r.id);
            }
          }}
        >
          {busy ? "Generating statement…" : "Generate this year"}
        </Button>
      </div>
      <Panel className="space-y-3">
        <p className="text-sm font-medium">Custom range</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="From" htmlFor="from">
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To" htmlFor="to">
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <Button
          disabled={busy || !from || !to}
          onClick={async () => {
            setBusy(true);
            const r = await generateStatementFn({ data: { periodStart: from, periodEnd: to, kind: "custom" } });
            setBusy(false);
            if (!r.ok) toast.error("error" in r ? r.error : "Could not generate that range");
            else {
              toast.success("Statement ready");
              await qc.invalidateQueries({ queryKey: ["statements"] });
              setOpenId(r.id);
            }
          }}
        >
          {busy ? "Generating statement…" : "Generate custom statement"}
        </Button>
      </Panel>
      <Panel>
        {q.data?.length ? (
          <ul className="divide-y divide-line">
            {q.data.map((s) => (
              <li key={s.id} className="py-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium capitalize">{s.product}</p>
                    <p className="text-muted">
                      {s.periodStart} – {s.periodEnd}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Amount cents={s.closingCents} size="sm" />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setOpenId(openId === s.id ? null : s.id)}
                    >
                      {openId === s.id ? "Hide" : "View"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        const file = await statementPdfFn({ data: { id: s.id } });
                        setBusy(false);
                        if (!file) toast.error("Could not download that statement");
                        else downloadBase64(file.filename, file.base64, "application/pdf");
                      }}
                    >
                      PDF
                    </Button>
                  </div>
                </div>
                {openId === s.id ? (
                  <div className="mt-3 rounded-md border border-line bg-paper p-3">
                    <p className="text-xs text-muted">
                      Opening <Amount cents={s.openingCents} size="sm" /> · Closing{" "}
                      <Amount cents={s.closingCents} size="sm" />
                    </p>
                    {detail.isPending ? (
                      <p className="mt-3 text-sm text-muted">Loading activity…</p>
                    ) : detail.data?.transactions.length ? (
                      <div className="mt-2 divide-y divide-line">
                        {detail.data.transactions.map((tx) => (
                          <TxRow key={tx.id} tx={tx} />
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-muted">No activity in this period.</p>
                    )}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No statements yet" body="Generate the current period to create your first statement." />
        )}
      </Panel>
    </div>
  );
}
