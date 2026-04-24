import { z } from "zod";

export const ingestModeSchema = z.enum(["upsert", "insert"]);
export type IngestMode = z.infer<typeof ingestModeSchema>;

export const ingestRelationSchema = z.object({
  entity: z.string().min(1),
  /** External id from source to resolve relation */
  externalId: z.string().optional(),
  /** Target id if already known */
  targetId: z.string().optional(),
});

export const ingestRecordSchema = z.object({
  externalId: z.string().min(1),
  source: z.string().min(1),
  data: z.record(z.string(), z.unknown()),
  relations: z.array(ingestRelationSchema).optional(),
});

export type IngestRecord = z.infer<typeof ingestRecordSchema>;

export const ingestRequestSchema = z.object({
  orgId: z.string().uuid(),
  entity: z.string().min(1),
  mode: ingestModeSchema,
  /** Idempotency for whole batch */
  idempotencyKey: z.string().min(8).max(256),
  records: z.array(ingestRecordSchema).min(1).max(500),
});

export type IngestRequest = z.infer<typeof ingestRequestSchema>;

export const ingestRecordResultSchema = z.object({
  externalId: z.string(),
  status: z.enum(["created", "updated", "skipped", "failed"]),
  targetId: z.string().uuid().optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      retriable: z.boolean().optional(),
    })
    .optional(),
});

export const ingestResponseSchema = z.object({
  results: z.array(ingestRecordResultSchema),
});

export type IngestResponse = z.infer<typeof ingestResponseSchema>;

export const customFieldRequestSchema = z.object({
  orgId: z.string().uuid(),
  entity: z.string().min(1),
  key: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9_]*$/, "key must be snake_case"),
  label: z.string().min(1),
  type: z.enum(["string", "text", "number", "boolean", "date", "datetime", "email", "phone", "url", "enum"]),
  enumValues: z.array(z.string()).optional(),
});

export type CustomFieldRequest = z.infer<typeof customFieldRequestSchema>;

export const customFieldResponseSchema = z.object({
  fieldKey: z.string(),
  created: z.boolean(),
});

export type CustomFieldResponse = z.infer<typeof customFieldResponseSchema>;

export const rollbackRequestSchema = z.object({
  orgId: z.string().uuid(),
  entity: z.string().min(1),
  targetIds: z.array(z.string().uuid()).min(1).max(1000),
  /** Must match original job idempotency / migration run id when applicable */
  migrationRunId: z.string().uuid().optional(),
});

export type RollbackRequest = z.infer<typeof rollbackRequestSchema>;

export const rollbackResponseSchema = z.object({
  deleted: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  errors: z
    .array(
      z.object({
        targetId: z.string().uuid(),
        message: z.string(),
      })
    )
    .optional(),
});

export type RollbackResponse = z.infer<typeof rollbackResponseSchema>;
