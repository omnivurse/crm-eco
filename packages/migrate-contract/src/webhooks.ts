import { z } from "zod";

/** Target apps can POST webhooks to Olyron for post-ingest events (optional) */
export const targetWebhookPayloadSchema = z.object({
  event: z.enum(["ingest.completed", "ingest.failed", "rollback.completed"]),
  orgId: z.string().uuid(),
  migrationRunId: z.string().uuid(),
  appKey: z.string(),
  summary: z.object({
    created: z.number().int().optional(),
    updated: z.number().int().optional(),
    failed: z.number().int().optional(),
  }),
});

export type TargetWebhookPayload = z.infer<typeof targetWebhookPayloadSchema>;

/** Source connector webhook envelope (HubSpot, Pipedrive, etc.) */
export const sourceWebhookEnvelopeSchema = z.object({
  connector: z.string().min(1),
  connectionId: z.string().uuid(),
  raw: z.unknown(),
});
