import { z } from 'zod';

/** Blank form fields → undefined so optional URL/email checks don't fire. */
function emptyToUndefined(v: unknown): unknown {
  if (v == null) return undefined;
  if (typeof v !== 'string') return v;
  const t = v.trim();
  return t.length === 0 ? undefined : t;
}

const optionalText = (max: number) =>
  z.preprocess(emptyToUndefined, z.string().max(max).optional());

const optionalUrl = z.preprocess(
  emptyToUndefined,
  z.string().url('Enter a full URL (https://…) or leave blank').max(2048).optional(),
);

const optionalEmail = z.preprocess(
  emptyToUndefined,
  z.string().email('Enter a valid email or leave blank').max(255).optional(),
);

export const CARRIER_TYPE_VALUES = [
  'insurance',
  'healthshare',
  'medicaid',
  'short_term',
  'dental',
  'vision',
  'life',
  'other',
] as const;

export const createCarrierSchema = z.object({
  carrier_name: z.preprocess(
    emptyToUndefined,
    z.string().min(1, 'Carrier name is required').max(255),
  ),
  naic_code: optionalText(20),
  website: optionalUrl,
  logo_url: optionalUrl,
  carrier_type: z.enum(CARRIER_TYPE_VALUES).default('insurance'),
  phone: optionalText(40),
  email: optionalEmail,
});

export type CreateCarrierInput = z.infer<typeof createCarrierSchema>;

/** Flatten Zod issues into a single toast-friendly string. */
export function formatZodError(error: z.ZodError): string {
  const parts = error.issues.map((issue) => {
    const field = issue.path.length > 0 ? issue.path.join('.') : 'input';
    return `${field}: ${issue.message}`;
  });
  return parts.join('; ') || 'Invalid carrier data';
}
