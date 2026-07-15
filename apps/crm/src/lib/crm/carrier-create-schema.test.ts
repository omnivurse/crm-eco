import { describe, expect, it } from 'vitest';
import { createCarrierSchema, formatZodError } from './carrier-create-schema';

describe('createCarrierSchema', () => {
  it('accepts name-only create (empty optional fields from the form)', () => {
    const parsed = createCarrierSchema.safeParse({
      carrier_name: 'LifeX',
      naic_code: '',
      website: '',
      phone: '',
      email: '',
      carrier_type: 'insurance',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.carrier_name).toBe('LifeX');
      expect(parsed.data.website).toBeUndefined();
      expect(parsed.data.email).toBeUndefined();
      expect(parsed.data.naic_code).toBeUndefined();
    }
  });

  it('rejects invalid website URLs with a readable message', () => {
    const parsed = createCarrierSchema.safeParse({
      carrier_name: 'LifeX',
      website: 'not-a-url',
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(formatZodError(parsed.error)).toMatch(/website/i);
      expect(formatZodError(parsed.error)).not.toMatch(/\[object Object\]/);
    }
  });

  it('accepts a valid website when provided', () => {
    const parsed = createCarrierSchema.safeParse({
      carrier_name: 'LifeX',
      website: 'https://lifex.example',
    });
    expect(parsed.success).toBe(true);
  });
});
