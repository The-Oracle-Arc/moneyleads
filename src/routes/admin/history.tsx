import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader, Panel, Field, EmptyState } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { adminHistoryAnalyzeFn, adminHistoryCorrectFn, adminHistoryIngestFn, adminHistoryListFn } from "@/lib/banking/admin-api";
import { formatUsd, parseUsdToCents } from "@/lib/banking/money";
import type { HistoricalKind } from "@/lib/banking/historical";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/history")({ component: HistoricalData });

function HistoricalData() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["admin-history"], queryFn: () => adminHistoryListFn({ data: {} }) });
  const [form, setForm] = useState({
    moneyleadUserId: "",
    sourceName: "",
    kind: "transaction" as HistoricalKind,
    sourceOccurredAt: "",
    amount: "",
    description: "",
    counterparty: "",
    reference: "",
  });
  const [analysisUser, setAnalysisUser] = useState("");
  const [busy, setBusy] = useState(false);
  const [analysis, setAnalysis] = useState<Awaited<ReturnType<typeof adminHistoryAnalyzeFn>> | null>(null);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Control Center"
        title="Historical data"
        description="Ingest source records with their original dates. MONEYLEAD never rewrites 2019-04-12 to today and never invents missing activity."
      />
      <Panel className="space-y-4">
        <h2 className="font-medium">Ingest a source record</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="MONEYLEAD User ID" htmlFor="ml">
            <Input id="ml" value={form.moneyleadUserId} onChange={(e) => setForm({ ...form, moneyleadUserId: e.target.value })} placeholder="ML-00018427" />
          </Field>
          <Field label="Source" htmlFor="src">
            <Input id="src" value={form.sourceName} onChange={(e) => setForm({ ...form, sourceName: e.target.value })} placeholder="Prior institution export" />
          </Field>
          <Field label="Kind" htmlFor="kind">
            <NativeSelect id="kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as HistoricalKind })}>
              <option value="transaction">Transaction</option>
              <option value="transfer">Transfer</option>
              <option value="account_event">Account event</option>
              <option value="kyc_event">KYC event</option>
              <option value="support_event">Support event</option>
              <option value="statement">Statement</option>
              <option value="other">Other</option>
            </NativeSelect>
          </Field>
          <Field label="Source occurred at" htmlFor="occ" hint="Original date from the source. Required.">
            <Input id="occ" type="date" value={form.sourceOccurredAt} onChange={(e) => setForm({ ...form, sourceOccurredAt: e.target.value })} />
          </Field>
          <Field label="Amount (optional)" htmlFor="amt">
            <Input id="amt" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="125.00" />
          </Field>
          <Field label="Counterparty" htmlFor="cp">
            <Input id="cp" value={form.counterparty} onChange={(e) => setForm({ ...form, counterparty: e.target.value })} />
          </Field>
        </div>
        <Field label="Description from the source" htmlFor="desc">
          <Textarea id="desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <Field label="Reference" htmlFor="ref">
          <Input id="ref" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
        </Field>
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const amount = form.amount.trim() ? parseUsdToCents(form.amount) : null;
            const r = await adminHistoryIngestFn({
              data: {
                moneyleadUserId: form.moneyleadUserId || undefined,
                sourceName: form.sourceName,
                kind: form.kind,
                sourceOccurredAt: form.sourceOccurredAt,
                amountCents: Number.isFinite(amount) ? amount : null,
                description: form.description,
                counterparty: form.counterparty || undefined,
                reference: form.reference || undefined,
              },
            });
            setBusy(false);
            if (!r.ok) toast.error(r.error);
            else {
              toast.success("Record ingested with original source date");
              await qc.invalidateQueries({ queryKey: ["admin-history"] });
            }
          }}
        >
          Ingest
        </Button>
      </Panel>
      <Panel className="space-y-3">
        <h2 className="font-medium">Historical analysis</h2>
        <Field label="Customer user ID" htmlFor="an">
          <Input id="an" value={analysisUser} onChange={(e) => setAnalysisUser(e.target.value)} placeholder="Authenticated user id" />
        </Field>
        <Button
          variant="secondary"
          disabled={busy || !analysisUser.trim()}
          onClick={async () => {
            setBusy(true);
            const r = await adminHistoryAnalyzeFn({ data: { userId: analysisUser.trim() } });
            setBusy(false);
            setAnalysis(r);
          }}
        >
          Run historical agent
        </Button>
        {analysis ? (
          <div className="space-y-2 text-sm">
            <p className="font-medium text-ink">{analysis.summary}</p>
            {analysis.notes.map((n) => (
              <p key={n} className="text-muted">
                {n}
              </p>
            ))}
            {analysis.yearly.map((y) => (
              <p key={y.year} className="tabular">
                {y.year} · {y.count} · credits {formatUsd(y.creditsCents)} · debits {formatUsd(y.debitsCents)}
              </p>
            ))}
          </div>
        ) : null}
      </Panel>
      <Panel>
        <h2 className="font-medium">Stored records</h2>
        {list.data?.length ? (
          <ul className="mt-3 divide-y divide-line text-sm">
            {list.data.map((row) => (
              <li key={row.id} className="py-3">
                <p className="font-medium">
                  {row.sourceOccurredAt.slice(0, 10)} · {row.kind}
                </p>
                <p className="text-muted">{row.description}</p>
                <p className="text-xs text-subtle">
                  Source {row.sourceName}
                  {row.amountCents != null ? ` · ${formatUsd(row.amountCents)}` : ""} · ingested {row.ingestedAt.slice(0, 10)} · {row.status}
                </p>
                {row.status !== "superseded" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-1"
                    onClick={async () => {
                      const reason = window.prompt("Correction reason (original record is retained)");
                      if (!reason) return;
                      const r = await adminHistoryCorrectFn({ data: { originalId: row.id, reason } });
                      if (!r.ok) toast.error(r.error);
                      else {
                        toast.success("Correction stored. Original date preserved.");
                        await qc.invalidateQueries({ queryKey: ["admin-history"] });
                      }
                    }}
                  >
                    Correct
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No historical records" body="Nothing is invented to fill this list." />
        )}
      </Panel>
    </div>
  );
}
