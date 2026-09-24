import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  assistantAskFn,
  assistantConfirmationsFn,
  assistantHistoryFn,
  assistantResolveFn,
} from "@/lib/banking/assistant-api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useWorkspace } from "@/hooks/use-workspace";

const STARTERS = [
  "How do I receive money?",
  "Where is my routing number?",
  "Why is my transfer pending?",
  "How do I verify my identity?",
  "What's my account status?",
];

export function AssistantChat({ onNavigate }: { onNavigate?: () => void }) {
  const { data } = useWorkspace();
  const qc = useQueryClient();
  const history = useQuery({ queryKey: ["assistant-history"], queryFn: () => assistantHistoryFn() });
  const confirms = useQuery({ queryKey: ["assistant-confirm"], queryFn: () => assistantConfirmationsFn() });
  const [draft, setDraft] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const ask = useMutation({
    mutationFn: (message: string) => assistantAskFn({ data: { message } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["assistant-history"] });
      await qc.invalidateQueries({ queryKey: ["assistant-confirm"] });
    },
  });

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [history.data, ask.data]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || ask.isPending) return;
    setDraft("");
    await ask.mutateAsync(message);
  }

  const messages = history.data?.messages ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scroller} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-1 py-3">
        {messages.length === 0 ? (
          <p className="px-2 text-sm leading-relaxed text-muted">
            {data?.greeting ? `${data.greeting} ` : ""}
            I can explain MONEYLEAD, onboarding, accounts, ACH, cards, and verification. I cannot approve
            credit, invent account numbers, or change balances.
          </p>
        ) : null}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "max-w-[92%] rounded-lg px-3 py-2 text-sm leading-relaxed",
              m.role === "user" ? "ml-auto bg-ink text-paper" : "bg-paper text-ink",
            )}
          >
            {m.body}
          </div>
        ))}
        {ask.isPending ? <p className="text-xs text-muted">Looking that up…</p> : null}
        {ask.data?.href ? (
          <a href={ask.data.href} className="inline-block text-sm font-medium text-lead" onClick={onNavigate}>
            Open {ask.data.href}
          </a>
        ) : null}
        {confirms.data?.length ? (
          <div className="rounded-lg bg-paper p-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Needs your confirmation</p>
            {confirms.data.map((c) => (
              <div key={c.id} className="mt-2 flex items-center justify-between gap-2">
                <p className="text-sm">{c.action.replaceAll(".", " ")}</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      const r = await assistantResolveFn({ data: { id: c.id, decision: "deny" } });
                      if (!r.ok) toast.error("Could not cancel");
                      await qc.invalidateQueries({ queryKey: ["assistant-confirm"] });
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={async () => {
                      const r = await assistantResolveFn({ data: { id: c.id, decision: "confirm" } });
                      if (!r.ok) toast.error("error" in r ? r.error : "Could not confirm");
                      else toast.success("Request submitted");
                      await qc.invalidateQueries({ queryKey: ["assistant-confirm"] });
                    }}
                  >
                    Confirm
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <div className="border-t border-line pt-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {STARTERS.map((s) => (
            <button
              key={s}
              type="button"
              className="rounded-full bg-paper px-2.5 py-1.5 text-xs text-muted shadow-card hover:text-ink"
              onClick={() => void send(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send(draft);
          }}
        >
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask about your account"
            aria-label="Message the assistant"
            className="flex-1"
          />
          <Button type="submit" size="sm" disabled={ask.isPending || !draft.trim()}>
            Send
          </Button>
        </form>
      </div>
    </div>
  );
}
