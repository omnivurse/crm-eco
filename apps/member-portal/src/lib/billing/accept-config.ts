/**
 * Public Authorize.Net Accept.js configuration for client-side tokenization.
 * Only non-secret values belong here — never put the transaction key in the browser.
 */
export interface AcceptJsConfig {
  apiLoginId: string;
  clientKey: string;
  environment: 'sandbox' | 'production';
  scriptUrl: string;
}

export function getAcceptJsConfig(): AcceptJsConfig | null {
  const apiLoginId = process.env.NEXT_PUBLIC_AUTHORIZE_NET_API_LOGIN_ID?.trim();
  const clientKey = process.env.NEXT_PUBLIC_AUTHORIZE_NET_CLIENT_KEY?.trim();
  const environment =
    process.env.NEXT_PUBLIC_AUTHORIZE_NET_ENVIRONMENT === 'production'
      ? 'production'
      : 'sandbox';

  if (!apiLoginId || !clientKey) return null;

  const scriptUrl =
    environment === 'production'
      ? 'https://js.authorize.net/v1/Accept.js'
      : 'https://jstest.authorize.net/v1/Accept.js';

  return { apiLoginId, clientKey, environment, scriptUrl };
}

export function isAcceptJsConfigured(): boolean {
  return getAcceptJsConfig() !== null;
}
