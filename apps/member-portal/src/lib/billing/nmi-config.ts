/**
 * Public NMI Payment Component configuration.
 * Only the tokenization key belongs in the browser — never NMI_PRIVATE_API_KEY.
 */

export interface NmiPublicConfig {
  tokenizationKey: string;
  environment: 'sandbox' | 'production';
}

export function getNmiPublicConfig(): NmiPublicConfig | null {
  const tokenizationKey = process.env.NEXT_PUBLIC_NMI_TOKENIZATION_KEY?.trim();
  if (!tokenizationKey) return null;
  return {
    tokenizationKey,
    environment: process.env.NEXT_PUBLIC_NMI_ENVIRONMENT === 'production' ? 'production' : 'sandbox',
  };
}

export function isNmiCollectConfigured(): boolean {
  return getNmiPublicConfig() !== null;
}

export function isNmiIntendedProvider(): boolean {
  return (process.env.PAYMENT_PROVIDER ?? '').trim().toLowerCase() === 'nmi';
}
