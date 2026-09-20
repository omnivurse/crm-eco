'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { CircleNotch, Lock, CreditCard } from '@phosphor-icons/react';
import { Button, Input, Label, Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui';
import type { PaymentEvent } from '@nmipayments/nmi-pay';
import type { NmiPublicConfig } from '@/lib/billing/nmi-config';

const NmiPaymentFields = dynamic(
  () => import('./NmiPaymentFields').then((mod) => mod.NmiPaymentFields),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <CircleNotch weight="light" className="h-4 w-4 animate-spin" aria-hidden />
        Loading secure card form…
      </div>
    ),
  },
);

interface NmiAddPaymentMethodFormProps {
  config: NmiPublicConfig;
}

function nmiTokenFromPayEvent(event: PaymentEvent): string | null {
  return event.token?.trim() || null;
}

function expirationFromLookup(event: PaymentEvent): string | undefined {
  const exp = event.lookupData?.card?.exp?.replace(/\D/g, '');
  if (!exp) return undefined;
  if (exp.length === 4) {
    return `20${exp.slice(2, 4)}-${exp.slice(0, 2)}`;
  }
  if (exp.length === 6) {
    return `${exp.slice(0, 4)}-${exp.slice(4, 6)}`;
  }
  return undefined;
}

export function NmiAddPaymentMethodForm({ config }: NmiAddPaymentMethodFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [setAsDefault, setSetAsDefault] = useState(true);

  const persistToken = async (event: PaymentEvent): Promise<true | string> => {
    setError(null);
    if (!firstName.trim() || !lastName.trim()) {
      const message = 'Billing first and last name are required.';
      setError(message);
      return message;
    }

    const token = nmiTokenFromPayEvent(event);
    if (!token) {
      const message = 'Card tokenization failed. Check your card details and try again.';
      setError(message);
      return message;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/member/payment-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'opaque',
          opaqueData: {
            dataDescriptor: 'nmi_payment_token',
            dataValue: token,
          },
          expirationDate: expirationFromLookup(event),
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
      };

      if (!res.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to save payment method');
      }

      router.push('/billing?added=1');
      router.refresh();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save payment method';
      setError(message);
      setSubmitting(false);
      return message;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard weight="light" className="h-4 w-4 text-[var(--mp-teal)]" aria-hidden />
          Card details
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex items-start gap-2 rounded-lg border border-[rgba(11,109,133,0.12)] bg-[rgba(11,109,133,0.06)] p-3 text-sm text-[var(--mp-ink)]">
            <Lock weight="light" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--mp-teal)]" aria-hidden />
            <p>
              Your card number is tokenized by NMI in your browser. We never receive or store your
              full card number.
            </p>
          </div>

          <div className="space-y-4">
            <p className="text-sm font-medium text-slate-900">Billing address</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="nmiFirstName">First name</Label>
                <Input
                  id="nmiFirstName"
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nmiLastName">Last name</Label>
                <Input
                  id="nmiLastName"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  disabled={submitting}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nmiAddress">Street address</Label>
              <Input
                id="nmiAddress"
                autoComplete="street-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="nmiCity">City</Label>
                <Input
                  id="nmiCity"
                  autoComplete="address-level2"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nmiState">State</Label>
                <Input
                  id="nmiState"
                  autoComplete="address-level1"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nmiZip">ZIP</Label>
                <Input
                  id="nmiZip"
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

          <div className={submitting ? 'pointer-events-none opacity-70' : undefined}>
            <NmiPaymentFields tokenizationKey={config.tokenizationKey} onPay={persistToken} />
          </div>

          {submitting && (
            <Button type="button" className="w-full" disabled>
              <CircleNotch weight="light" className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Saving…
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
