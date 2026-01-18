'use client';

import * as React from 'react';
import { cn } from '../lib/utils';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

// Types
export interface CreditCardData {
  cardNumber: string;
  expirationMonth: string;
  expirationYear: string;
  cvv: string;
  cardholderName: string;
}

export interface BankAccountData {
  accountType: 'checking' | 'savings';
  routingNumber: string;
  accountNumber: string;
  accountNumberConfirm: string;
  accountHolderName: string;
  bankName?: string;
}

export interface BillingAddressData {
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export type PaymentMethodData =
  | { type: 'credit_card'; card: CreditCardData; billing: BillingAddressData }
  | { type: 'bank_account'; bank: BankAccountData; billing: BillingAddressData };

export interface PaymentFormProps {
  onSubmit: (data: PaymentMethodData) => void;
  onCancel?: () => void;
  loading?: boolean;
  error?: string;
  defaultTab?: 'credit_card' | 'bank_account';
  showBillingAddress?: boolean;
  submitLabel?: string;
  className?: string;
}

/**
 * Payment Form Component
 * Handles both Credit Card and Bank Account (ACH) payment methods
 */
export function PaymentForm({
  onSubmit,
  onCancel,
  loading = false,
  error,
  defaultTab = 'credit_card',
  showBillingAddress = true,
  submitLabel = 'Save Payment Method',
  className,
}: PaymentFormProps) {
  const [paymentType, setPaymentType] = React.useState<'credit_card' | 'bank_account'>(defaultTab);

  // Credit card state
  const [cardNumber, setCardNumber] = React.useState('');
  const [expirationMonth, setExpirationMonth] = React.useState('');
  const [expirationYear, setExpirationYear] = React.useState('');
  const [cvv, setCvv] = React.useState('');
  const [cardholderName, setCardholderName] = React.useState('');

  // Bank account state
  const [accountType, setAccountType] = React.useState<'checking' | 'savings'>('checking');
  const [routingNumber, setRoutingNumber] = React.useState('');
  const [accountNumber, setAccountNumber] = React.useState('');
  const [accountNumberConfirm, setAccountNumberConfirm] = React.useState('');
  const [accountHolderName, setAccountHolderName] = React.useState('');
  const [bankName, setBankName] = React.useState('');

  // Billing address state
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [city, setCity] = React.useState('');
  const [state, setState] = React.useState('');
  const [zipCode, setZipCode] = React.useState('');
  const [country, setCountry] = React.useState('US');

  // Validation state
  const [validationErrors, setValidationErrors] = React.useState<Record<string, string>>({});

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 16);
    const groups = digits.match(/.{1,4}/g);
    return groups ? groups.join(' ') : digits;
  };

  const detectCardType = (number: string): string => {
    const cleaned = number.replace(/\s/g, '');
    if (cleaned.startsWith('4')) return 'visa';
    if (/^5[1-5]/.test(cleaned) || /^2[2-7]/.test(cleaned)) return 'mastercard';
    if (/^3[47]/.test(cleaned)) return 'amex';
    if (/^6(?:011|5)/.test(cleaned)) return 'discover';
    return '';
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    setCardNumber(formatted);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (paymentType === 'credit_card') {
      const cleanCardNumber = cardNumber.replace(/\s/g, '');
      if (!cleanCardNumber || cleanCardNumber.length < 15) {
        errors.cardNumber = 'Valid card number required';
      }
      if (!expirationMonth) {
        errors.expirationMonth = 'Required';
      }
      if (!expirationYear) {
        errors.expirationYear = 'Required';
      }
      if (!cvv || cvv.length < 3) {
        errors.cvv = 'Valid CVV required';
      }
      if (!cardholderName.trim()) {
        errors.cardholderName = 'Name required';
      }
    } else {
      if (!routingNumber || routingNumber.length !== 9) {
        errors.routingNumber = 'Valid 9-digit routing number required';
      }
      if (!accountNumber || accountNumber.length < 4) {
        errors.accountNumber = 'Valid account number required';
      }
      if (accountNumber !== accountNumberConfirm) {
        errors.accountNumberConfirm = 'Account numbers must match';
      }
      if (!accountHolderName.trim()) {
        errors.accountHolderName = 'Name required';
      }
    }

    if (showBillingAddress) {
      if (!firstName.trim()) errors.firstName = 'Required';
      if (!lastName.trim()) errors.lastName = 'Required';
      if (!address.trim()) errors.address = 'Required';
      if (!city.trim()) errors.city = 'Required';
      if (!state.trim()) errors.state = 'Required';
      if (!zipCode.trim()) errors.zipCode = 'Required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const billing: BillingAddressData = {
      firstName,
      lastName,
      address,
      city,
      state,
      zipCode,
      country,
    };

    if (paymentType === 'credit_card') {
      onSubmit({
        type: 'credit_card',
        card: {
          cardNumber: cardNumber.replace(/\s/g, ''),
          expirationMonth,
          expirationYear,
          cvv,
          cardholderName,
        },
        billing,
      });
    } else {
      onSubmit({
        type: 'bank_account',
        bank: {
          accountType,
          routingNumber,
          accountNumber,
          accountNumberConfirm,
          accountHolderName,
          bankName: bankName || undefined,
        },
        billing,
      });
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 15 }, (_, i) => currentYear + i);
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1).padStart(2, '0'),
    label: String(i + 1).padStart(2, '0'),
  }));

  const cardType = detectCardType(cardNumber);

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-6', className)}>
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <Tabs value={paymentType} onValueChange={(v) => setPaymentType(v as 'credit_card' | 'bank_account')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="credit_card">Credit Card</TabsTrigger>
          <TabsTrigger value="bank_account">Bank Account (ACH)</TabsTrigger>
        </TabsList>

        <TabsContent value="credit_card" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="cardNumber">Card Number</Label>
            <div className="relative">
              <Input
                id="cardNumber"
                type="text"
                inputMode="numeric"
                placeholder="1234 5678 9012 3456"
                value={cardNumber}
                onChange={handleCardNumberChange}
                maxLength={19}
                className={cn(validationErrors.cardNumber && 'border-red-500')}
              />
              {cardType && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs uppercase font-medium text-gray-500">
                  {cardType}
                </span>
              )}
            </div>
            {validationErrors.cardNumber && (
              <p className="text-xs text-red-500">{validationErrors.cardNumber}</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expirationMonth">Month</Label>
              <Select value={expirationMonth} onValueChange={setExpirationMonth}>
                <SelectTrigger className={cn(validationErrors.expirationMonth && 'border-red-500')}>
                  <SelectValue placeholder="MM" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expirationYear">Year</Label>
              <Select value={expirationYear} onValueChange={setExpirationYear}>
                <SelectTrigger className={cn(validationErrors.expirationYear && 'border-red-500')}>
                  <SelectValue placeholder="YYYY" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cvv">CVV</Label>
              <Input
                id="cvv"
                type="text"
                inputMode="numeric"
                placeholder="123"
                value={cvv}
                onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                maxLength={4}
                className={cn(validationErrors.cvv && 'border-red-500')}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cardholderName">Cardholder Name</Label>
            <Input
              id="cardholderName"
              type="text"
              placeholder="Name as it appears on card"
              value={cardholderName}
              onChange={(e) => setCardholderName(e.target.value)}
              className={cn(validationErrors.cardholderName && 'border-red-500')}
            />
            {validationErrors.cardholderName && (
              <p className="text-xs text-red-500">{validationErrors.cardholderName}</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="bank_account" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="accountType">Account Type</Label>
            <Select value={accountType} onValueChange={(v) => setAccountType(v as 'checking' | 'savings')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="checking">Checking</SelectItem>
                <SelectItem value="savings">Savings</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="routingNumber">Routing Number</Label>
            <Input
              id="routingNumber"
              type="text"
              inputMode="numeric"
              placeholder="9 digits"
              value={routingNumber}
              onChange={(e) => setRoutingNumber(e.target.value.replace(/\D/g, '').slice(0, 9))}
              maxLength={9}
              className={cn(validationErrors.routingNumber && 'border-red-500')}
            />
            {validationErrors.routingNumber && (
              <p className="text-xs text-red-500">{validationErrors.routingNumber}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="accountNumber">Account Number</Label>
            <Input
              id="accountNumber"
              type="text"
              inputMode="numeric"
              placeholder="Enter account number"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
              className={cn(validationErrors.accountNumber && 'border-red-500')}
            />
            {validationErrors.accountNumber && (
              <p className="text-xs text-red-500">{validationErrors.accountNumber}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="accountNumberConfirm">Confirm Account Number</Label>
            <Input
              id="accountNumberConfirm"
              type="text"
              inputMode="numeric"
              placeholder="Re-enter account number"
              value={accountNumberConfirm}
              onChange={(e) => setAccountNumberConfirm(e.target.value.replace(/\D/g, ''))}
              className={cn(validationErrors.accountNumberConfirm && 'border-red-500')}
            />
            {validationErrors.accountNumberConfirm && (
              <p className="text-xs text-red-500">{validationErrors.accountNumberConfirm}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="accountHolderName">Account Holder Name</Label>
            <Input
              id="accountHolderName"
              type="text"
              placeholder="Name on the account"
              value={accountHolderName}
              onChange={(e) => setAccountHolderName(e.target.value)}
              className={cn(validationErrors.accountHolderName && 'border-red-500')}
            />
            {validationErrors.accountHolderName && (
              <p className="text-xs text-red-500">{validationErrors.accountHolderName}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bankName">Bank Name (Optional)</Label>
            <Input
              id="bankName"
              type="text"
              placeholder="e.g., Chase, Wells Fargo"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
            />
          </div>
        </TabsContent>
      </Tabs>

      {showBillingAddress && (
        <div className="space-y-4 pt-4 border-t">
          <h3 className="font-medium">Billing Address</h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={cn(validationErrors.firstName && 'border-red-500')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={cn(validationErrors.lastName && 'border-red-500')}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Street Address</Label>
            <Input
              id="address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={cn(validationErrors.address && 'border-red-500')}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={cn(validationErrors.city && 'border-red-500')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                type="text"
                placeholder="TX"
                maxLength={2}
                value={state}
                onChange={(e) => setState(e.target.value.toUpperCase())}
                className={cn(validationErrors.state && 'border-red-500')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zipCode">ZIP Code</Label>
              <Input
                id="zipCode"
                type="text"
                inputMode="numeric"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                maxLength={5}
                className={cn(validationErrors.zipCode && 'border-red-500')}
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? 'Processing...' : submitLabel}
        </Button>
      </div>
    </form>
  );
}

/**
 * Saved Payment Method Display
 */
export interface PaymentMethodDisplayProps {
  type: 'credit_card' | 'bank_account';
  lastFour: string;
  cardType?: string;
  expirationDate?: string;
  accountType?: string;
  bankName?: string;
  isDefault?: boolean;
  onSetDefault?: () => void;
  onDelete?: () => void;
  className?: string;
}

export function PaymentMethodDisplay({
  type,
  lastFour,
  cardType,
  expirationDate,
  accountType,
  bankName,
  isDefault,
  onSetDefault,
  onDelete,
  className,
}: PaymentMethodDisplayProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between p-4 border rounded-lg',
        isDefault && 'border-blue-500 bg-blue-50',
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
          {type === 'credit_card' ? (
            <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          )}
        </div>
        <div>
          <p className="font-medium">
            {type === 'credit_card'
              ? `${cardType || 'Card'} ending in ${lastFour}`
              : `${accountType || 'Account'} ending in ${lastFour}`}
          </p>
          <p className="text-sm text-gray-500">
            {type === 'credit_card' && expirationDate && `Expires ${expirationDate}`}
            {type === 'bank_account' && bankName && bankName}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isDefault && (
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Default</span>
        )}
        {!isDefault && onSetDefault && (
          <Button variant="ghost" size="sm" onClick={onSetDefault}>
            Set Default
          </Button>
        )}
        {onDelete && (
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-600 hover:text-red-700">
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}
