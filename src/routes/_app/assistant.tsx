import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/ui/field";
import { AssistantChat } from "@/components/assistant/assistant-chat";
import { useWorkspace } from "@/hooks/use-workspace";

export const Route = createFileRoute("/_app/assistant")({ component: AssistantPage });

function AssistantPage() {
  const { data } = useWorkspace();
  const enabled = data?.flags?.assistantEnabled !== false;
  return (
    <div className="flex min-h-[70dvh] flex-col space-y-6">
      <PageHeader
        eyebrow="Help"
        title="MONEYLEAD Assistant"
        description="A guide inside the app. It can explain MONEYLEAD and retrieve your account status. It cannot change balances, approve credit, or bypass verification."
      />
      {!enabled ? (
        <Panel>
          <p className="text-sm leading-relaxed text-muted">
            The assistant is turned off. Banking still works. Use{" "}
            <Link to="/support" className="font-medium text-lead">
              Support
            </Link>{" "}
            to reach a person.
          </p>
        </Panel>
      ) : (
        <Panel className="flex min-h-[28rem] flex-1 flex-col overflow-hidden px-4 pb-4 pt-2">
          <AssistantChat />
        </Panel>
      )}
    </div>
  );
}
