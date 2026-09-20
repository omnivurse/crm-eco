'use client';

import { NmiPayments } from '@nmipayments/nmi-pay-react';
import type { PaymentEvent } from '@nmipayments/nmi-pay';

interface NmiPaymentFieldsProps {
  tokenizationKey: string;
  onPay: (event: PaymentEvent) => Promise<true | string>;
}

/**
 * Isolated so Next can load the NMI widget only on the client.
 */
export function NmiPaymentFields({ tokenizationKey, onPay }: NmiPaymentFieldsProps) {
  return (
    <NmiPayments
      tokenizationKey={tokenizationKey}
      paymentMethods={['card']}
      payButtonText="Save payment method"
      onPay={onPay}
    />
  );
}
