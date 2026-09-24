import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader, Panel, Field, EmptyState } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { createSupportCaseFn, listSupportCasesFn } from "@/lib/banking/api";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/support")({ component: Support });

const FAQ = [
  {
    q: "Where do my account numbers come from?",
    a: "Account and routing numbers are issued by our banking partner after identity verification. MONEYLEAD never generates them locally.",
  },
  {
    q: "What does Banking Program Setup mean?",
    a: "MONEYLEAD is preparing for its production banking program and regulated banking-partner onboarding. Production banking access is enabled only after the required program, compliance, underwriting, and partner approvals are completed.",
  },
  {
    q: "Why don’t I have a debit card?",
    a: "Debit cards are part of the product, but they aren’t issued in this environment yet. Checking still works without a card.",
  },
  {
    q: "When will a transfer show as completed?",
    a: "After it actually settles. MONEYLEAD does not mark transfers complete on its own.",
  },
];

function Support() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/support") return <Outlet />;
  return <SupportHome />;
}

function SupportHome() {
  const cases = useQuery({ queryKey: ["cases"], queryFn: () => listSupportCasesFn() });
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Support"
        title="Help"
        description="Secure messaging with operations. The MONEYLEAD Assistant can explain the product and escalate a case — it cannot change balances."
      />
      <p className="text-sm text-muted">
        Prefer a guided answer first? Open the assistant from the corner button, or go to{" "}
        <Link to="/assistant" className="font-medium text-lead">
          Assistant
        </Link>
        .
      </p>
      <Panel className="space-y-4">
        <h2 className="font-medium">Common questions</h2>
        {FAQ.map((item) => (
          <div key={item.q}>
            <p className="text-sm font-medium text-ink">{item.q}</p>
            <p className="mt-1 text-sm text-muted">{item.a}</p>
          </div>
        ))}
      </Panel>
      <Panel className="space-y-3">
        <h2 className="font-medium">New message</h2>
        <Field label="Subject" htmlFor="sub">
          <Input id="sub" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </Field>
        <Field label="Message" htmlFor="body">
          <Textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <Button
          onClick={async () => {
            if (!subject.trim() || !body.trim()) return;
            const r = await createSupportCaseFn({ data: { subject, body } });
            if (r.ok) {
              toast.success("Message sent");
              setSubject("");
              setBody("");
              await qc.invalidateQueries({ queryKey: ["cases"] });
            }
          }}
        >
          Send
        </Button>
      </Panel>
      <Panel>
        <h2 className="font-medium">Your cases</h2>
        {!cases.data?.length ? (
          <EmptyState title="No messages yet" body="Send a note if something looks wrong on your account." />
        ) : (
          <ul className="divide-y divide-line">
            {cases.data.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-3">
                <Link to="/support/$id" params={{ id: c.id }} className="text-sm font-medium text-ink">
                  {c.subject}
                </Link>
                <Badge>{c.status.replaceAll("_", " ")}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
