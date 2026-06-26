'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { Loader2, Lock, CreditCard } from 'lucide-react';
import { Button, Input, Label, Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui';
import type { AcceptJsConfig } from '@/lib/billing/accept-config';

interface OpaqueData {
  dataDescriptor: string;
  dataValue: string;
}

interface AcceptDispatchResponse {
  opaqueData?: OpaqueData;
  messages?: {
    resultCode: string;
    message: Array<{ code: string; text: string }>;
  };
}

interface AcceptGlobal {
  dispatchData: (
    secureData: {
      authData: { clientKey: string; apiLoginID: string };
      cardData: {
        cardNumber: string;
        month: string;
        year: string;
        cardCode: string;
      };
    },
    callback: (response: AcceptDispatchResponse) => void,
  ) => void;
}

declare global {
  interface Window {
    Accept?: AcceptGlobal;
  }
}

export interface BillingAddressInput {
  firstName: string;
  lastName: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
}

interface AddPaymentMethodFormProps {
  config: AcceptJsConfig;
}

export function AddPaymentMethodForm({ config }: AddPaymentMethodFormProps) {
  const router = useRouter();
  const formId = useId();
  const [scriptReady, setScriptReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cardNumber, setCardNumber] = useState('');
  const [expMonth, setExpMonth] = useState('');
  const [expYear, setExpYear] = useState('');
  const [cvv, setCvv] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [setAsDefault, setSetAsDefault] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Accept) {
      setScriptReady(true);
    }
  }, []);

  const tokenizeAndSubmit = useCallback(async () => {
    setError(null);

    if (!window.Accept) {
      setError('Payment library is still loading. Please wait a moment and try again.');
      return;
    }

    if (!firstName.trim() || !lastName.trim()) {
      setError('Billing first and last name are required.');
      return;
    }

    setSubmitting(true);

    const year =
      expYear.length === 2 ? `20${expYear}` : expYear;

    window.Accept.dispatchData(
      {
        authData: {
          clientKey: config.clientKey,
          apiLoginID: config.apiLoginId,
        },
        cardData: {
          cardNumber: cardNumber.replace(/\s/g, ''),
          month: expMonth.padStart(2, '0'),
          year,
          cardCode: cvv,
        },
      },
      async (response) => {
        if (response.messages?.resultCode === 'Error' || !response.opaqueData) {
          const msg =
            response.messages?.message?.[0]?.text ||
            'Card tokenization failed. Check your card details and try again.';
          setError(msg);
          setSubmitting(false);
          return;
        }

        try {
          const expirationDate = `${year}-${expMonth.padStart(2, '0')}`;
          const res = await fetch('/api/member/payment-profiles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              opaqueData: response.opaqueData,
              expirationDate,
              billingAddress: {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                address: address.trim() || undefined,
                city: city.trim() || undefined,
                state: state.trim() || undefined,
                zip: zip.trim() || undefined,
              },
              setAsDefault,
            }),
          });

          const payload = (await res.json()) as {
            success?: boolean;
            error?: string;
            paymentProfileId?: string;
          };

          if (!res.ok || !payload.success) {
            throw new Error(payload.error || 'Failed to save payment method');
          }

          router.push('/billing?added=1');
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to save payment method');
          setSubmitting(false);
        }
      },
    );
  }, [
    address,
    cardNumber,
    city,
    config.clientKey,
    config.apiLoginId,
    cvv,
    expMonth,
    expYear,
    firstName,
    lastName,
    router,
    setAsDefault,
    state,
    zip,
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void tokenizeAndSubmit();
  };

  return (
    <>
      <Script
        src={config.scriptUrl}
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onError={() => setError('Failed to load secure payment library. Please refresh and try again.')}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4 text-slate-600" />
            Card details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form id={formId} onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-900">
              <Lock className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Your card number is tokenized by Authorize.Net Accept.js in your browser.
                We never receive or store your full card number.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cardNumber">Card number</Label>
                <Input
                  id="cardNumber"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  placeholder="4111 1111 1111 1111"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  required
                  disabled={submitting}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="expMonth">Exp. month</Label>
                  <Input
                    id="expMonth"
                    inputMode="numeric"
                    autoComplete="cc-exp-month"
                    placeholder="MM"
                    maxLength={2}
                    value={expMonth}
                    onChange={(e) => setExpMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
                    required
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expYear">Exp. year</Label>
                  <Input
                    id="expYear"
                    inputMode="numeric"
                    autoComplete="cc-exp-year"
                    placeholder="YY"
                    maxLength={4}
                    value={expYear}
                    onChange={(e) => setExpYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    required
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cvv">CVV</Label>
                  <Input
                    id="cvv"
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    placeholder="123"
                    maxLength={4}
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    required
                    disabled={submitting}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 border-t pt-4">
              <p className="text-sm font-medium text-slate-900">Billing address</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Street address</Label>
                <Input
                  id="address"
                  autoComplete="street-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    autoComplete="address-level2"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    autoComplete="address-level1"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zip">ZIP</Label>
                  <Input
                    id="zip"
                    autoComplete="postal-code"
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                    disabled={submitting}
                  />
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={setAsDefault}
                onChange={(e) => setSetAsDefault(e.target.checked)}
                disabled={submitting}
                className="h-4 w-4 rounded border-slate-300"
              />
              Set as default payment method
            </label>

            <Button
              type="submit"
              className="w-full"
              disabled={submitting || !scriptReady}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : !scriptReady ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading secure form…
                </>
              ) : (
                'Save payment method'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
