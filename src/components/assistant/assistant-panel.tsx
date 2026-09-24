import { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { AssistantChat } from "@/components/assistant/assistant-chat";

export function AssistantLauncher() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="fixed right-4 bottom-[5.75rem] z-30 flex size-12 items-center justify-center rounded-full bg-ink text-paper shadow-float transition-transform duration-150 active:scale-[0.96] md:bottom-6"
        aria-label={open ? "Close assistant" : "Open MONEYLEAD Assistant"}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X className="size-5" aria-hidden /> : <MessageCircle className="size-5" aria-hidden />}
      </button>
      {open ? <AssistantPanel onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function AssistantPanel({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 flex max-h-[min(82dvh,680px)] flex-col overflow-hidden rounded-t-2xl bg-surface shadow-sheet animate-sheet md:inset-x-auto md:right-4 md:bottom-6 md:w-[380px] md:rounded-2xl"
      role="dialog"
      aria-label="MONEYLEAD Assistant"
    >
      <header className="flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-sm font-medium text-ink">MONEYLEAD Assistant</p>
          <p className="text-xs text-muted">Guide only. Cannot change balances.</p>
        </div>
        <button type="button" className="flex size-11 items-center justify-center rounded-full text-muted hover:text-ink" onClick={onClose} aria-label="Close">
          <X className="size-4" />
        </button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <AssistantChat onNavigate={onClose} />
      </div>
    </div>
  );
}
