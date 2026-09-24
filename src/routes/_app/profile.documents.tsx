import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, Panel, EmptyState } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { downloadAllDocumentsFn, listDocumentsFn, noticePdfFn, receiptPdfFn, statementPdfFn } from "@/lib/banking/api";
import { downloadBase64 } from "@/lib/banking/download";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/profile/documents")({ component: Documents });

function Documents() {
  const q = useQuery({ queryKey: ["documents"], queryFn: () => listDocumentsFn() });
  const [busy, setBusy] = useState(false);
  const data = q.data;
  const statementIds = useMemo(() => (data?.statements ?? []).map((s) => s.id), [data]);
  const receiptIds = useMemo(() => (data?.receipts ?? []).map((s) => s.id), [data]);
  const noticeIds = useMemo(() => (data?.notices ?? []).map((s) => s.id), [data]);

  async function downloadPdf(
    kind: "statement" | "receipt" | "notice",
    id: string,
  ) {
    setBusy(true);
    try {
      const file =
        kind === "statement"
          ? await statementPdfFn({ data: { id } })
          : kind === "receipt"
            ? await receiptPdfFn({ data: { id } })
            : await noticePdfFn({ data: { id } });
      if (!file) toast.error("That document is not available.");
      else downloadBase64(file.filename, file.base64, "application/pdf");
    } finally {
      setBusy(false);
    }
  }

  async function downloadAll() {
    setBusy(true);
    const r = await downloadAllDocumentsFn({
      data: { statements: statementIds, receipts: receiptIds, notices: noticeIds },
    });
    setBusy(false);
    downloadBase64(r.filename, r.base64, "application/zip");
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Profile"
        title="Documents"
        description="Your statements, receipts, and notices. Identity documents stay with the verification provider."
      />
      <Button className="w-full" variant="secondary" disabled={busy} onClick={() => void downloadAll()}>
        {busy ? "Preparing…" : "Download all"}
      </Button>
      <Section
        title="Statements"
        empty="No statements yet. Generate one from Account → Statements."
        extra={
          <Link to="/bank/statements" className="text-sm font-medium text-lead">
            Open statements
          </Link>
        }
      >
        {data?.statements.map((item) => (
          <Row key={item.id} title={item.title} meta={item.createdAt} onDownload={() => void downloadPdf("statement", item.id)} busy={busy} />
        ))}
      </Section>
      <Section title="Receipts" empty="Receipts appear after posted activity.">
        {data?.receipts.map((item) => (
          <Row key={item.id} title={item.title} meta={item.createdAt} onDownload={() => void downloadPdf("receipt", item.id)} busy={busy} />
        ))}
      </Section>
      <Section title="Notices" empty="No notices yet.">
        {data?.notices.map((item) => (
          <Row key={item.id} title={item.title} meta={item.createdAt} onDownload={() => void downloadPdf("notice", item.id)} busy={busy} />
        ))}
      </Section>
      <Section title="KYC documents" empty="">
        <p className="px-1 py-2 text-sm leading-relaxed text-muted">
          Identity documents are held by the verification provider. MONEYLEAD does not store identity images in this
          application or put them in public URLs.
        </p>
      </Section>
      <Section title="Other documents" empty="No additional documents are stored for this account.">
        {null}
      </Section>
    </div>
  );
}

function Section({
  title,
  empty,
  extra,
  children,
}: {
  title: string;
  empty: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children : [children];
  const has = items.filter(Boolean).length > 0 && !(items.length === 1 && items[0] == null);
  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">{title}</p>
        {extra}
      </div>
      <Panel>
        {has ? children : empty ? <EmptyState title={empty} body="" /> : children}
      </Panel>
    </section>
  );
}

function Row({
  title,
  meta,
  onDownload,
  busy,
}: {
  title: string;
  meta: string;
  onDownload: () => void;
  busy: boolean;
}) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink">{title}</p>
        {meta ? <p className="text-xs text-muted">{meta.slice(0, 10)}</p> : null}
      </div>
      <Button size="sm" variant="ghost" disabled={busy} onClick={onDownload}>
        Download
      </Button>
    </div>
  );
}
