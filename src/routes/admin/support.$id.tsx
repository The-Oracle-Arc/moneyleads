import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { adminActFn, adminSupportThreadFn } from "@/lib/banking/admin-api";
import { PageHeader, Panel, Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Badge, txTone } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/support/$id")({ component: SupportThread });

function SupportThread() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-support", id],
    queryFn: () => adminSupportThreadFn({ data: { id } }),
  });
  const [body, setBody] = useState("");
  const thread = q.data;
  if (q.isPending) return <p className="text-sm text-muted">Loading case…</p>;
  if (!thread) return <p className="text-sm text-danger">Case not found.</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Support"
        title={thread.case.subject}
        description="Secure operations thread. Replies notify the customer in-app."
        action={<Badge tone={txTone(thread.case.status)}>{thread.case.status.replaceAll("_", " ")}</Badge>}
      />
      {thread.customer ? (
        <p className="text-sm text-muted">
          Customer{" "}
          <Link to="/admin/customers/$id" params={{ id: thread.customer.id }} className="text-lead">
            {thread.customer.name}
          </Link>
          {thread.customer.email ? ` · ${thread.customer.email}` : ""}
        </p>
      ) : null}
      <Panel className="space-y-4">
        {thread.messages.map((m) => (
          <div key={m.id} className={m.author === "agent" ? "text-lead" : "text-ink"}>
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted">{m.author}</p>
            <p className="mt-1 text-sm leading-relaxed">{m.body}</p>
            <p className="mt-1 text-xs text-subtle">{m.created_at ? new Date(m.created_at).toLocaleString() : ""}</p>
          </div>
        ))}
        <Field label="Reply" htmlFor="reply">
          <Textarea id="reply" value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={async () => {
              if (!body.trim()) return;
              const r = await adminActFn({ data: { action: "support.reply", entityId: id, note: body } });
              if (!r.ok) toast.error(r.error);
              else {
                toast.success("Reply sent");
                setBody("");
                await qc.invalidateQueries({ queryKey: ["admin-support", id] });
              }
            }}
          >
            Send reply
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              const r = await adminActFn({ data: { action: "support.close", entityId: id } });
              if (!r.ok) toast.error(r.error);
              else toast.success("Case closed");
              await qc.invalidateQueries({ queryKey: ["admin-support", id] });
            }}
          >
            Close case
          </Button>
        </div>
      </Panel>
    </div>
  );
}
