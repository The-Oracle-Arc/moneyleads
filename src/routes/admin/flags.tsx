import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader, Panel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { adminActFn, adminFlagsFn } from "@/lib/banking/admin-api";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/flags")({ component: Flags });

function Flags() {
  const q = useQuery({ queryKey: ["admin-flags"], queryFn: () => adminFlagsFn() });
  const qc = useQueryClient();
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Control Center"
        title="Feature flags"
        description="Product switches. These do not invent banking data. Banking-partner credentials cannot be stored here."
      />
      <Panel className="space-y-1">
        {(q.data ?? []).map((flag) => (
          <div key={flag.key} className="flex items-start justify-between gap-4 border-b border-line py-4 last:border-0">
            <div>
              <p className="text-sm font-medium">{flag.key.replaceAll("_", " ")}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{flag.description}</p>
            </div>
            <Switch
              checked={flag.enabled}
              onCheckedChange={async (enabled) => {
                const r = await adminActFn({
                  data: { action: "flag.set", entityId: flag.key, note: enabled ? "true" : "false" },
                });
                if (!r.ok) toast.error(r.error);
                else toast.success(enabled ? "Enabled" : "Disabled");
                await qc.invalidateQueries({ queryKey: ["admin-flags"] });
                await qc.invalidateQueries({ queryKey: ["workspace"] });
              }}
            />
          </div>
        ))}
      </Panel>
    </div>
  );
}
