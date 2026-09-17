import { describe, expect, it } from 'vitest';
import { detectEnrollmentLocale, enrollmentCopy, localizedEnrollmentSteps } from './i18n';
import { parseLandingEnrollmentMeta, resolveEnrollmentDocumentIds } from './documents';

describe('detectEnrollmentLocale', () => {
  it('prefers a stored landing locale', () => {
    expect(
      detectEnrollmentLocale({ stored: 'es', acceptLanguage: 'en-US', navigatorLanguage: 'en' }),
    ).toBe('es');
  });

  it('uses Accept-Language when nothing is stored', () => {
    expect(detectEnrollmentLocale({ acceptLanguage: 'es-MX,es;q=0.9' })).toBe('es');
    expect(detectEnrollmentLocale({ navigatorLanguage: 'en-US' })).toBe('en');
  });
});

describe('enrollmentCopy', () => {
  it('returns Spanish wizard labels without changing rating keys', () => {
    expect(enrollmentCopy('es', 'sponsorPaid')).toMatch(/empleador/);
    expect(enrollmentCopy('es', 'spousePartner')).toMatch(/pareja/);
    expect(localizedEnrollmentSteps('es').find((step) => step.key === 'payment')?.title).toBe('Pago');
  });
});

describe('resolveEnrollmentDocumentIds', () => {
  it('uses the landing pack when the sponsor match is clean', () => {
    expect(
      resolveEnrollmentDocumentIds({
        landingDocumentIds: ['s1'],
        planDocumentIds: ['p1'],
        sponsorMatched: true,
      }),
    ).toEqual(['s1']);
  });

  it('uses the plan pack for retail', () => {
    expect(
      resolveEnrollmentDocumentIds({
        landingDocumentIds: ['s1'],
        planDocumentIds: ['p1', 'p1'],
        sponsorMatched: false,
      }),
    ).toEqual(['p1']);
  });

  it('parses landing meta', () => {
    expect(parseLandingEnrollmentMeta({ locale: 'es', document_ids: ['a', 'b'] })).toEqual({
      localeStored: 'es',
      documentIds: ['a', 'b'],
    });
  });
});
