import { createFileRoute } from "@tanstack/react-router";
import { handleColumnWebhook } from "@/lib/banking/column/webhooks";

export const Route = createFileRoute("/api/webhooks/column")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const result = await handleColumnWebhook({
          rawBody,
          signature: request.headers.get("column-signature") ?? request.headers.get("Column-Signature"),
          endpointId: request.headers.get("webhook-endpoint-id") ?? request.headers.get("Webhook-Endpoint-Id"),
        });
        if (!result.ok) {
          return new Response(JSON.stringify({ error: result.error }), {
            status: result.status,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ received: true, duplicate: Boolean(result.duplicate) }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
