import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader, Panel } from "@/components/ui/field";
import { getNotificationPrefsFn, listNotificationsFn, markNotificationsReadFn, updateNotificationPrefsFn } from "@/lib/banking/api";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_app/profile/notifications")({ component: Notes });

function Notes() {
  const notes = useQuery({ queryKey: ["notes"], queryFn: () => listNotificationsFn() });
  const prefs = useQuery({ queryKey: ["prefs"], queryFn: () => getNotificationPrefsFn() });
  const qc = useQueryClient();
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Profile" title="Notifications" description="Alerts for security, transfers, cards, and statements." />
      <Panel className="space-y-3">
        {prefs.data
          ? (
              [
                ["emailEnabled", "Email"],
                ["pushEnabled", "Push"],
                ["smsEnabled", "SMS"],
                ["loginAlerts", "Login alerts"],
                ["transactionAlerts", "Transaction alerts"],
                ["marketing", "Product updates"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex h-11 items-center justify-between text-sm">
                {label}
                <Switch
                  checked={prefs.data[key]}
                  onCheckedChange={async (checked) => {
                    await updateNotificationPrefsFn({ data: { ...prefs.data, [key]: checked } });
                    await qc.invalidateQueries({ queryKey: ["prefs"] });
                  }}
                />
              </label>
            ))
          : null}
      </Panel>
      <Panel>
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Inbox</h2>
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              await markNotificationsReadFn();
              await qc.invalidateQueries({ queryKey: ["notes"] });
            }}
          >
            Mark all read
          </Button>
        </div>
        <ul className="mt-3 divide-y divide-line">
          {notes.data?.length ? (
            notes.data.map((n) => (
              <li key={n.id} className="py-3">
                <p className="text-sm font-medium">{n.title}</p>
                <p className="text-sm text-muted">{n.body}</p>
              </li>
            ))
          ) : (
            <li className="py-6 text-sm text-muted">No notifications yet.</li>
          )}
        </ul>
      </Panel>
    </div>
  );
}
