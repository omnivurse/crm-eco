import { z } from "zod";

/** Step 1: Olyron asks target for signed upload URL */
export const attachmentPrepareRequestSchema = z.object({
  orgId: z.string().uuid(),
  entity: z.string().min(1),
  /** Parent record in target (after ingest) */
  parentTargetId: z.string().uuid(),
  filename: z.string().min(1).max(512),
  contentType: z.string().min(1).max(128),
  byteSize: z.number().int().positive().max(100 * 1024 * 1024),
  /** SHA-256 hex for dedup */
  contentHashSha256: z.string().length(64).optional(),
});

export type AttachmentPrepareRequest = z.infer<typeof attachmentPrepareRequestSchema>;

export const attachmentPrepareResponseSchema = z.object({
  uploadUrl: z.string().url(),
  uploadMethod: z.enum(["PUT", "POST"]).default("PUT"),
  headers: z.record(z.string(), z.string()).optional(),
  /** Target-specific token to finalize */
  finalizeToken: z.string().min(8),
  expiresAt: z.string().datetime({ offset: true }),
});

export type AttachmentPrepareResponse = z.infer<typeof attachmentPrepareResponseSchema>;

export const attachmentFinalizeRequestSchema = z.object({
  orgId: z.string().uuid(),
  entity: z.string().min(1),
  parentTargetId: z.string().uuid(),
  finalizeToken: z.string().min(8),
  filename: z.string().min(1),
  contentType: z.string().min(1),
  contentHashSha256: z.string().length(64).optional(),
});

export type AttachmentFinalizeRequest = z.infer<typeof attachmentFinalizeRequestSchema>;

export const attachmentFinalizeResponseSchema = z.object({
  attachmentId: z.string().uuid().optional(),
  ok: z.boolean(),
  error: z.string().optional(),
});

export type AttachmentFinalizeResponse = z.infer<typeof attachmentFinalizeResponseSchema>;
