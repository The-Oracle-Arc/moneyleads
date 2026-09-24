import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader, Panel, EmptyState, Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NativeSelect, Textarea } from "@/components/ui/input";
import { adminActFn, adminKycQueueFn } from "@/lib/banking/admin-api";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/kyc")({ component: KycQueue });

const FILTERS = [
  { id: "all", label: "All" },
  { id: "SUBMITTED", label: "New" },
  { id: "UNDER_REVIEW", label: "Under Review" },
  { id: "NEEDS_INFORMATION", label: "Needs Information" },
  { id: "ESCALATED", label: "Escalated" },
  { id: "expiring", label: "Expiring Soon" },
  { id: "EXPIRED", label: "Expired" },
  { id: "APPROVED", label: "Approved" },
  { id: "REJECTED", label: "Rejected" },
  { id: "REVIEW_REQUIRED", label: "Review Required" },
] as const;

function KycQueue() {
  const q = useQuery({ queryKey: ["admin-kyc-queue"], queryFn: () => adminKycQueueFn() });
  const qc = useQueryClient();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [sort, setSort] = useState<"deadline" | "priority" | "submitted">("deadline");
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    const list = [...(q.data ?? [])];
    const filtered = list.filter((row) => {
      if (filter === "all") return true;
      if (filter === "expiring") return (row.timeRemainingMs ?? Infinity) > 0 && (row.timeRemainingMs ?? Infinity) < 4 * 60 * 60 * 1000;
      return row.workflowStatus === filter;
    });
    filtered.sort((a, b) => {
      if (sort === "priority") return String(b.priority).localeCompare(String(a.priority));
      if (sort === "submitted") return String(b.submittedAt ?? "").localeCompare(String(a.submittedAt ?? ""));
      return (a.timeRemainingMs ?? 9e15) - (b.timeRemainingMs ?? 9e15);
    });
    return filtered;
  }, [q.data, filter, sort]);

  const current = rows.find((r) => r.id === selected) ?? null;

  async function act(action: string) {
    if (!current) return;
    if (action === "kyc.review.reject" && !note.trim()) {
      toast.error("A structured reason is required to reject.");
      return;
    }
    setBusy(true);
    const r = await adminActFn({ data: { action, entityId: current.id, note: note || undefined } });
    setBusy(false);
    if (!r.ok) toast.error(r.error);
    else {
      toast.success("notice" in r && r.notice ? r.notice : "Recorded");
      setNote("");
      await qc.invalidateQueries({ queryKey: ["admin-kyc-queue"] });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Control Center"
        title="KYC"
        description="MONEYLEAD review queue with SLA. Column remains the banking-partner source of truth. Staff review does not fabricate partner verification."
      />
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`h-10 rounded-full px-3 text-sm ${filter === f.id ? "bg-ink text-paper" : "bg-surface text-muted shadow-card"}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Sort</p>
        <NativeSelect value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="h-10 w-40">
          <option value="deadline">Deadline</option>
          <option value="priority">Priority</option>
          <option value="submitted">Submitted</option>
        </NativeSelect>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Panel>
          {rows.length ? (
            <ul className="divide-y divide-line">
              {rows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(row.id)}
                    className={`flex w-full flex-col items-start gap-1 px-1 py-3 text-left ${selected === row.id ? "bg-lead-soft" : ""}`}
                  >
                    <div className="flex w-full items-center justify-between gap-3">
                      <p className="text-sm font-medium text-ink">{row.name}</p>
                      <Badge tone={toneFor(row.workflowStatus)}>{row.workflowStatus.replaceAll("_", " ")}</Badge>
                    </div>
                    <p className="text-xs text-muted">
                      {row.moneyleadUserId ?? "—"} · Partner {row.partnerStatus.replaceAll("_", " ")} ·{" "}
                      {remaining(row.timeRemainingMs)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No applications in this filter" body="Submitted KYC appears here with a review deadline." />
          )}
        </Panel>
        <Panel className="space-y-4">
          {current ? (
            <>
              <div>
                <p className="text-sm font-medium text-ink">{current.name}</p>
                <p className="text-xs text-muted">{current.moneyleadUserId ?? current.userId}</p>
              </div>
              <dl className="space-y-2 text-sm">
                <Row k="Workflow" v={current.workflowStatus.replaceAll("_", " ")} />
                <Row k="Partner status" v={current.partnerStatus.replaceAll("_", " ")} />
                <Row k="Submitted" v={current.submittedAt ? new Date(current.submittedAt).toLocaleString() : "—"} />
                <Row k="Deadline" v={current.reviewDeadline ? new Date(current.reviewDeadline).toLocaleString() : "—"} />
                <Row k="Remaining" v={remaining(current.timeRemainingMs)} />
                <Row k="Priority" v={current.priority} />
                <Row k="Agent" v={current.recommendation ?? "Pending"} />
              </dl>
              <Field label="Decision note" htmlFor="kyc-note">
                <Textarea id="kyc-note" value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              <div className="grid gap-2">
                <Button disabled={busy} onClick={() => void act("kyc.review.approve")}>
                  Record MONEYLEAD review
                </Button>
                <Button variant="secondary" disabled={busy} onClick={() => void act("kyc.review.request_info")}>
                  Request information
                </Button>
                <Button variant="secondary" disabled={busy} onClick={() => void act("kyc.review.escalate")}>
                  Escalate
                </Button>
                <Button variant="danger" disabled={busy} onClick={() => void act("kyc.review.reject")}>
                  Reject
                </Button>
                <Button variant="ghost" disabled={busy} onClick={() => void act("kyc.refresh")}>
                  Refresh Column status
                </Button>
              </div>
              <p className="text-xs leading-relaxed text-muted">
                Recording a MONEYLEAD review does not open a checking account and does not fabricate Column verification.
              </p>
              <Link to="/admin/customers/$id" params={{ id: current.userId }} className="text-sm font-medium text-lead">
                Open customer
              </Link>
            </>
          ) : (
            <p className="text-sm text-muted">Select an application to review.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right text-ink">{v}</dd>
    </div>
  );
}

function remaining(ms: number | null) {
  if (ms == null) return "No deadline";
  if (ms <= 0) return "Past deadline";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m remaining`;
}

function toneFor(status: string) {
  if (status === "APPROVED") return "ok" as const;
  if (status === "REJECTED" || status === "EXPIRED") return "danger" as const;
  if (status === "ESCALATED" || status === "NEEDS_INFORMATION" || status === "REVIEW_REQUIRED") return "warn" as const;
  return "pending" as const;
}
