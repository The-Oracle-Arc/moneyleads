import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader, Panel, Field, EmptyState } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { adminAgentsFn, adminRunAgentFn } from "@/lib/banking/admin-api";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/agents")({ component: Agents });

function Agents() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-agents"], queryFn: () => adminAgentsFn() });
  const [agent, setAgent] = useState("system");
  const [subject, setSubject] = useState("");
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Control Center"
        title="Agents"
        description="Independent tools over stored records. An LLM is optional phrasing only. Agents cannot invent balances, approve KYC, or move money."
      />
      <Panel>
        <ul className="divide-y divide-line text-sm">
          {(q.data?.catalog ?? []).map((a) => (
            <li key={a.id} className="py-3">
              <p className="font-medium text-ink">{a.name}</p>
              <p className="text-muted">{a.role}</p>
              <p className="text-xs text-subtle">{a.audience}</p>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel className="space-y-3">
        <h2 className="font-medium">Run an agent</h2>
        <Field label="Agent" htmlFor="ag">
          <NativeSelect id="ag" value={agent} onChange={(e) => setAgent(e.target.value)}>
            {(q.data?.catalog ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Subject user ID (when required)" htmlFor="sub">
          <Input id="sub" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </Field>
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const r = await adminRunAgentFn({ data: { agent, subjectUserId: subject || undefined } });
            setBusy(false);
            if (!r.ok) toast.error(r.error);
            else {
              setLast([r.result.summary, ...r.result.details].join("\n"));
              await qc.invalidateQueries({ queryKey: ["admin-agents"] });
            }
          }}
        >
          Run
        </Button>
        {last ? <pre className="whitespace-pre-wrap rounded-xl bg-paper p-4 text-sm text-ink">{last}</pre> : null}
      </Panel>
      <Panel>
        <h2 className="font-medium">Recent runs</h2>
        {q.data?.runs.length ? (
          <ul className="mt-3 divide-y divide-line text-sm">
            {q.data.runs.map((run) => (
              <li key={run.id} className="py-3">
                <p className="font-medium capitalize">{run.agent}</p>
                <p className="text-muted">{run.summary}</p>
                <p className="text-xs text-subtle">{run.createdAt}</p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No runs yet" body="Run an agent against stored records. Nothing is invented." />
        )}
      </Panel>
    </div>
  );
}
