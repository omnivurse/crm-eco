'use client';

import { useState } from 'react';
import { Input, Label, Button, Checkbox } from '@crm-eco/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@crm-eco/ui';
import { Loader2, ArrowRight } from 'lucide-react';
import type { AdultIntake, PrefillData, PreferredContactChannel } from '../../types';

const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
];

const RELATIONSHIP_STATUSES = [
  'Single',
  'Married',
  'Divorced',
  'Separated',
  'Widowed',
  'Remarried',
  'Long-term relationship',
  'Cohabitating',
];

interface SelfServeIntakeStepProps {
  data?: Partial<AdultIntake>;
  prefillData?: PrefillData;
  onComplete: (data: AdultIntake) => void;
  loading: boolean;
}

function primaryPhone(data: Partial<AdultIntake>): string {
  return (data.phone_cell || data.phone_home || data.phone_work || data.phone || '').trim();
}

export function SelfServeIntakeStep({
  data,
  prefillData,
  onComplete,
  loading,
}: SelfServeIntakeStepProps) {
  const [formData, setFormData] = useState<Partial<AdultIntake>>({
    first_name: data?.first_name || prefillData?.first_name || '',
    last_name: data?.last_name || prefillData?.last_name || '',
    email: data?.email || prefillData?.email || '',
    date_of_birth: data?.date_of_birth || prefillData?.date_of_birth || '',
    phone_cell: data?.phone_cell || data?.phone || prefillData?.phone || '',
    phone_home: data?.phone_home || '',
    phone_work: data?.phone_work || '',
    leave_message_cell: data?.leave_message_cell ?? true,
    leave_message_home: data?.leave_message_home ?? false,
    leave_message_work: data?.leave_message_work ?? false,
    preferred_contact: data?.preferred_contact || 'cell',
    may_contact_email: data?.may_contact_email ?? true,
    address_line1: data?.address_line1 || prefillData?.address_line1 || '',
    address_line2: data?.address_line2 || prefillData?.address_line2 || '',
    city: data?.city || prefillData?.city || '',
    state: data?.state || prefillData?.state || '',
    zip_code: data?.zip_code || prefillData?.zip_code || '',
    relationship_status: data?.relationship_status || '',
    referral_source: data?.referral_source || '',
    emergency_contact: data?.emergency_contact || {
      name: '',
      relationship: '',
      phone: '',
      address: '',
    },
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.first_name?.trim()) newErrors.first_name = 'First name is required';
    if (!formData.last_name?.trim()) newErrors.last_name = 'Last name is required';

    if (!formData.email?.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.date_of_birth?.trim()) {
      newErrors.date_of_birth = 'Date of birth is required';
    }

    if (!primaryPhone(formData)) {
      newErrors.phone_cell = 'At least one phone number is required';
    }

    if (!formData.address_line1?.trim()) newErrors.address_line1 = 'Street address is required';
    if (!formData.city?.trim()) newErrors.city = 'City is required';
    if (!formData.state?.trim()) newErrors.state = 'State is required';

    if (!formData.zip_code?.trim()) {
      newErrors.zip_code = 'ZIP code is required';
    } else if (!/^\d{5}(-\d{4})?$/.test(formData.zip_code)) {
      newErrors.zip_code = 'Please enter a valid ZIP code';
    }

    const ec = formData.emergency_contact;
    if (ec?.name?.trim() || ec?.phone?.trim() || ec?.relationship?.trim()) {
      if (!ec?.name?.trim()) newErrors.ec_name = 'Emergency contact name is required';
      if (!ec?.relationship?.trim()) newErrors.ec_relationship = 'Relationship is required';
      if (!ec?.phone?.trim()) newErrors.ec_phone = 'Emergency contact phone is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const phone = primaryPhone(formData);
    const payload: AdultIntake = {
      first_name: formData.first_name!.trim(),
      last_name: formData.last_name!.trim(),
      email: formData.email!.trim(),
      date_of_birth: formData.date_of_birth!.trim(),
      phone,
      phone_cell: formData.phone_cell?.trim() || undefined,
      phone_home: formData.phone_home?.trim() || undefined,
      phone_work: formData.phone_work?.trim() || undefined,
      leave_message_cell: formData.leave_message_cell,
      leave_message_home: formData.leave_message_home,
      leave_message_work: formData.leave_message_work,
      preferred_contact: formData.preferred_contact as PreferredContactChannel | undefined,
      may_contact_email: formData.may_contact_email,
      address_line1: formData.address_line1!.trim(),
      address_line2: formData.address_line2?.trim() || undefined,
      city: formData.city!.trim(),
      state: formData.state!.trim(),
      zip_code: formData.zip_code!.trim(),
      relationship_status: formData.relationship_status || undefined,
      referral_source: formData.referral_source?.trim() || undefined,
      emergency_contact:
        formData.emergency_contact?.name?.trim()
          ? {
              name: formData.emergency_contact.name.trim(),
              relationship: formData.emergency_contact.relationship.trim(),
              phone: formData.emergency_contact.phone.trim(),
              address: formData.emergency_contact.address?.trim() || undefined,
            }
          : undefined,
    };
    onComplete(payload);
  };

  const handleChange = (field: keyof AdultIntake, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as string]) {
      setErrors((prev) => ({ ...prev, [field as string]: '' }));
    }
  };

  const handleEcChange = (field: keyof NonNullable<AdultIntake['emergency_contact']>, value: string) => {
    setFormData((prev) => ({
      ...prev,
      emergency_contact: {
        name: prev.emergency_contact?.name || '',
        relationship: prev.emergency_contact?.relationship || '',
        phone: prev.emergency_contact?.phone || '',
        address: prev.emergency_contact?.address || '',
        [field]: value,
      },
    }));
    const key = `ec_${field}`;
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-4">
        <p className="text-sm text-cyan-900">
          <strong>About you.</strong> Identity and contact details for your membership.
          Medical and eligibility questions come later if your plan requires them.
        </p>
      </div>

      <section className="space-y-4">
        <h3 className="font-medium text-slate-900">Identity</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="first_name">First name *</Label>
            <Input
              id="first_name"
              value={formData.first_name || ''}
              onChange={(e) => handleChange('first_name', e.target.value)}
              className={errors.first_name ? 'border-red-500' : ''}
            />
            {errors.first_name && <p className="text-sm text-red-600">{errors.first_name}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="last_name">Last name *</Label>
            <Input
              id="last_name"
              value={formData.last_name || ''}
              onChange={(e) => handleChange('last_name', e.target.value)}
              className={errors.last_name ? 'border-red-500' : ''}
            />
            {errors.last_name && <p className="text-sm text-red-600">{errors.last_name}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="date_of_birth">Date of birth *</Label>
            <Input
              id="date_of_birth"
              type="date"
              value={formData.date_of_birth || ''}
              onChange={(e) => handleChange('date_of_birth', e.target.value)}
              className={errors.date_of_birth ? 'border-red-500' : ''}
            />
            {errors.date_of_birth && (
              <p className="text-sm text-red-600">{errors.date_of_birth}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="relationship_status">Relationship status</Label>
            <Select
              value={formData.relationship_status || ''}
              onValueChange={(v) => handleChange('relationship_status', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIP_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-medium text-slate-900">Contact</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email || ''}
              onChange={(e) => handleChange('email', e.target.value)}
              className={errors.email ? 'border-red-500' : ''}
            />
            {errors.email && <p className="text-sm text-red-600">{errors.email}</p>}
            <label className="flex items-center gap-2 text-sm text-slate-600 pt-1">
              <Checkbox
                checked={!!formData.may_contact_email}
                onCheckedChange={(c) => handleChange('may_contact_email', c === true)}
              />
              You may contact me by email
            </label>
          </div>

          {(
            [
              ['phone_cell', 'Cell', 'leave_message_cell'],
              ['phone_home', 'Home', 'leave_message_home'],
              ['phone_work', 'Work', 'leave_message_work'],
            ] as const
          ).map(([field, label, leaveField]) => (
            <div key={field} className="space-y-2">
              <Label htmlFor={field}>{label} phone{field === 'phone_cell' ? ' *' : ''}</Label>
              <Input
                id={field}
                type="tel"
                placeholder="(555) 123-4567"
                value={(formData[field] as string) || ''}
                onChange={(e) => handleChange(field, e.target.value)}
                className={errors[field] ? 'border-red-500' : ''}
              />
              {errors[field] && <p className="text-sm text-red-600">{errors[field]}</p>}
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <Checkbox
                  checked={!!formData[leaveField]}
                  onCheckedChange={(c) => handleChange(leaveField, c === true)}
                />
                OK to leave a message
              </label>
            </div>
          ))}

          <div className="space-y-2">
            <Label>Preferred contact</Label>
            <Select
              value={formData.preferred_contact || 'cell'}
              onValueChange={(v) => handleChange('preferred_contact', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cell">Cell</SelectItem>
                <SelectItem value="home">Home</SelectItem>
                <SelectItem value="work">Work</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-medium text-slate-900">Mailing address</h3>
        <div className="space-y-2">
          <Label htmlFor="address_line1">Street address *</Label>
          <Input
            id="address_line1"
            value={formData.address_line1 || ''}
            onChange={(e) => handleChange('address_line1', e.target.value)}
            className={errors.address_line1 ? 'border-red-500' : ''}
          />
          {errors.address_line1 && (
            <p className="text-sm text-red-600">{errors.address_line1}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="address_line2">Apartment, suite, etc.</Label>
          <Input
            id="address_line2"
            value={formData.address_line2 || ''}
            onChange={(e) => handleChange('address_line2', e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="col-span-2 space-y-2">
            <Label htmlFor="city">City *</Label>
            <Input
              id="city"
              value={formData.city || ''}
              onChange={(e) => handleChange('city', e.target.value)}
              className={errors.city ? 'border-red-500' : ''}
            />
            {errors.city && <p className="text-sm text-red-600">{errors.city}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">State *</Label>
            <Select
              value={formData.state || ''}
              onValueChange={(value) => handleChange('state', value)}
            >
              <SelectTrigger className={errors.state ? 'border-red-500' : ''}>
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map((state) => (
                  <SelectItem key={state.value} value={state.value}>
                    {state.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.state && <p className="text-sm text-red-600">{errors.state}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="zip_code">ZIP *</Label>
            <Input
              id="zip_code"
              value={formData.zip_code || ''}
              onChange={(e) => handleChange('zip_code', e.target.value)}
              className={errors.zip_code ? 'border-red-500' : ''}
            />
            {errors.zip_code && <p className="text-sm text-red-600">{errors.zip_code}</p>}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-medium text-slate-900">Emergency contact</h3>
        <p className="text-xs text-slate-500">Optional — recommended for membership records.</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ec_name">Name</Label>
            <Input
              id="ec_name"
              value={formData.emergency_contact?.name || ''}
              onChange={(e) => handleEcChange('name', e.target.value)}
              className={errors.ec_name ? 'border-red-500' : ''}
            />
            {errors.ec_name && <p className="text-sm text-red-600">{errors.ec_name}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="ec_relationship">Relationship</Label>
            <Input
              id="ec_relationship"
              value={formData.emergency_contact?.relationship || ''}
              onChange={(e) => handleEcChange('relationship', e.target.value)}
              className={errors.ec_relationship ? 'border-red-500' : ''}
            />
            {errors.ec_relationship && (
              <p className="text-sm text-red-600">{errors.ec_relationship}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="ec_phone">Phone</Label>
            <Input
              id="ec_phone"
              type="tel"
              value={formData.emergency_contact?.phone || ''}
              onChange={(e) => handleEcChange('phone', e.target.value)}
              className={errors.ec_phone ? 'border-red-500' : ''}
            />
            {errors.ec_phone && <p className="text-sm text-red-600">{errors.ec_phone}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="ec_address">Address</Label>
            <Input
              id="ec_address"
              value={formData.emergency_contact?.address || ''}
              onChange={(e) => handleEcChange('address', e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <Label htmlFor="referral_source">How were you referred? (optional)</Label>
        <Input
          id="referral_source"
          value={formData.referral_source || ''}
          onChange={(e) => handleChange('referral_source', e.target.value)}
          placeholder="Advisor, friend, web…"
        />
      </section>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={loading} className="gap-2">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
