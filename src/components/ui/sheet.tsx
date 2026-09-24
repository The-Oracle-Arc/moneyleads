import { Drawer } from "vaul";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Sheet({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-ink/40 animate-fade" />
        <Drawer.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-2xl bg-surface shadow-sheet outline-none animate-sheet md:bottom-8 md:rounded-2xl",
            className,
          )}
          aria-label={title}
        >
          <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-line-strong md:hidden" />
          <div className="overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 md:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              {title ? (
                <Drawer.Title className="text-xl font-semibold tracking-tight">{title}</Drawer.Title>
              ) : (
                <Drawer.Title className="sr-only">Sheet</Drawer.Title>
              )}
              <button
                type="button"
                onClick={onClose}
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-paper text-muted hover:text-ink"
                aria-label="Close"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
