import { z } from "zod";

/** Field types target apps expose for mapping & validation */
export const migrateFieldTypeSchema = z.enum([
  "string",
  "text",
  "number",
  "boolean",
  "date",
  "datetime",
  "email",
  "phone",
  "url",
  "json",
  "enum",
  "relation",
]);

export type MigrateFieldType = z.infer<typeof migrateFieldTypeSchema>;

export const migrateFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().optional(),
  type: migrateFieldTypeSchema,
  required: z.boolean().optional(),
  unique: z.boolean().optional(),
  /** When type is enum */
  enumValues: z.array(z.string()).optional(),
  /** When type is relation: target entity key */
  relationEntity: z.string().optional(),
  description: z.string().optional(),
});

export type MigrateField = z.infer<typeof migrateFieldSchema>;

export const migrateEntitySchema = z.object({
  key: z.string().min(1),
  label: z.string().optional(),
  description: z.string().optional(),
  fields: z.array(migrateFieldSchema),
  /** Ordered dependency hints for ingest (e.g. company before contact) */
  dependsOn: z.array(z.string()).optional(),
});

export type MigrateEntity = z.infer<typeof migrateEntitySchema>;

export const migrateManifestSchema = z.object({
  contractVersion: z.literal("1"),
  appKey: z.string().min(1),
  manifestVersion: z.string().min(1),
  generatedAt: z.string().datetime({ offset: true }),
  entities: z.array(migrateEntitySchema),
  /** Whether target allows creating custom fields via API */
  allowCustomFields: z.boolean().default(false),
  /** Hours after ingest that rollback is allowed (0 = no rollback) */
  rollbackWindowHours: z.number().int().min(0).max(720).default(72),
});

export type MigrateManifest = z.infer<typeof migrateManifestSchema>;
