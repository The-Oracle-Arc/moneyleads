import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader, Panel, Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { addSupportMessageFn, listSupportMessagesFn } from "@/lib/banking/api";

export const Route = createFileRoute("/_app/support/$id")({ component: CaseView });

function CaseView() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const msgs = useQuery({
    queryKey: ["case", id],
    queryFn: () => listSupportMessagesFn({ data: { caseId: id } }),
  });
  const [body, setBody] = useState("");
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Support" title="Secure thread" description="Only you and MONEYLEAD operations can see this conversation." />
      <Panel className="space-y-4">
        {msgs.isPending ? <p className="text-sm text-muted">Loading messages…</p> : null}
        {!msgs.isPending && !msgs.data?.length ? <p className="text-sm text-muted">No messages yet.</p> : null}
        {msgs.data?.map((m) => (
          <div key={m.id} className={m.author === "customer" ? "text-ink" : "text-lead"}>
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted">{m.author === "customer" ? "You" : "MONEYLEAD"}</p>
            <p className="mt-1 text-sm leading-relaxed">{m.body}</p>
            <p className="mt-1 text-xs text-subtle">{m.createdAt ? new Date(m.createdAt).toLocaleString() : ""}</p>
          </div>
        ))}
        <Field label="Reply" htmlFor="reply">
          <Textarea id="reply" value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <Button
          onClick={async () => {
            if (!body.trim()) return;
            await addSupportMessageFn({ data: { caseId: id, body } });
            setBody("");
            await qc.invalidateQueries({ queryKey: ["case", id] });
          }}
        >
          Reply
        </Button>
        <Link to="/support" className="block text-sm font-medium text-lead">
          All cases
        </Link>
      </Panel>
    </div>
  );
}
