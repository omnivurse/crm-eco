'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Checkbox,
} from '@crm-eco/ui';
import { Loader2 } from 'lucide-react';

interface ParentAgent {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface AgentFormProps {
  parentAgents: ParentAgent[];
  initialData?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    license_number: string | null;
    license_states: string[] | null;
    status: string;
    commission_tier: string | null;
    commission_eligible: boolean;
    parent_advisor_id: string | null;
    company_name: string | null;
    website_url: string | null;
    primary_color: string | null;
    secondary_color: string | null;
    header_bg_color: string | null;
    header_text_color: string | null;
    street_address: string | null;
    apartment: string | null;
    city: string | null;
    state: string | null;
    zip_code: string | null;
    country: string | null;
  };
}

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

const COMMISSION_TIERS = ['Advisor', 'Leader', 'Director', 'Agency'];

export function AgentForm({ parentAgents, initialData }: AgentFormProps) {
  const router = useRouter();
  const isEditing = !!initialData;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    first_name: initialData?.first_name ?? '',
    last_name: initialData?.last_name ?? '',
    email: initialData?.email ?? '',
    phone: initialData?.phone ?? '',
    license_number: initialData?.license_number ?? '',
    license_states: initialData?.license_states ?? [],
    status: initialData?.status ?? 'pending',
    commission_tier: initialData?.commission_tier ?? '',
    commission_eligible: initialData?.commission_eligible ?? true,
    parent_advisor_id: initialData?.parent_advisor_id ?? '',
    company_name: initialData?.company_name ?? '',
    website_url: initialData?.website_url ?? '',
    primary_color: initialData?.primary_color ?? '#1e40af',
    secondary_color: initialData?.secondary_color ?? '#3b82f6',
    header_bg_color: initialData?.header_bg_color ?? '#1e3a8a',
    header_text_color: initialData?.header_text_color ?? '#ffffff',
    street_address: initialData?.street_address ?? '',
    apartment: initialData?.apartment ?? '',
    city: initialData?.city ?? '',
    state: initialData?.state ?? '',
    zip_code: initialData?.zip_code ?? '',
    country: initialData?.country ?? 'USA',
  });

  const handleLicenseStateToggle = (state: string) => {
    setFormData((prev) => ({
      ...prev,
      license_states: prev.license_states.includes(state)
        ? prev.license_states.filter((s) => s !== state)
        : [...prev.license_states, state],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      setError('Profile not found');
      setLoading(false);
      return;
    }

    const agentData = {
      first_name: formData.first_name,
      last_name: formData.last_name,
      email: formData.email,
      phone: formData.phone || null,
      license_number: formData.license_number || null,
      license_states: formData.license_states.length > 0 ? formData.license_states : null,
      status: formData.status,
      commission_tier: formData.commission_tier || null,
      commission_eligible: formData.commission_eligible,
      parent_advisor_id: formData.parent_advisor_id || null,
      company_name: formData.company_name || null,
      website_url: formData.website_url || null,
      primary_color: formData.primary_color,
      secondary_color: formData.secondary_color,
      header_bg_color: formData.header_bg_color,
      header_text_color: formData.header_text_color,
      street_address: formData.street_address || null,
      apartment: formData.apartment || null,
      city: formData.city || null,
      state: formData.state || null,
      zip_code: formData.zip_code || null,
      country: formData.country || 'USA',
      organization_id: profile.organization_id,
    };

    if (isEditing) {
      const { error: updateError } = await supabase
        .from('advisors')
        .update(agentData)
        .eq('id', initialData.id);

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      router.push(`/agents/${initialData.id}`);
    } else {
      const { data: newAgent, error: insertError } = await supabase
        .from('advisors')
        .insert(agentData)
        .select('id')
        .single();

      if (insertError) {
        setError(insertError.message);
        setLoading(false);
        return;
      }

      router.push(`/agents/${newAgent.id}`);
    }

    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Personal Information */}
      <div className="space-y-4">
        <h3 className="font-medium text-slate-900">Personal Information</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="first_name">First Name *</Label>
            <Input
              id="first_name"
              value={formData.first_name}
              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              required
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last_name">Last Name *</Label>
            <Input
              id="last_name"
              value={formData.last_name}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              required
              disabled={loading}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              disabled={loading}
            />
          </div>
        </div>
      </div>

      {/* License Information */}
      <div className="space-y-4">
        <h3 className="font-medium text-slate-900">License Information</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="license_number">License Number</Label>
            <Input
              id="license_number"
              value={formData.license_number}
              onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="commission_tier">Commission Tier</Label>
            <Select
              value={formData.commission_tier}
              onValueChange={(value) => setFormData({ ...formData, commission_tier: value })}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select tier" />
              </SelectTrigger>
              <SelectContent>
                {COMMISSION_TIERS.map((tier) => (
                  <SelectItem key={tier} value={tier}>
                    {tier}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Licensed States</Label>
          <div className="flex flex-wrap gap-2 p-3 border rounded-lg max-h-32 overflow-y-auto">
            {US_STATES.map((state) => (
              <button
                key={state}
                type="button"
                onClick={() => handleLicenseStateToggle(state)}
                className={`px-2 py-1 text-xs rounded border transition-colors ${
                  formData.license_states.includes(state)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'
                }`}
                disabled={loading}
              >
                {state}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Commission & Hierarchy */}
      <div className="space-y-4">
        <h3 className="font-medium text-slate-900">Commission & Hierarchy</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="parent_advisor_id">Upline (Parent Agent)</Label>
            <Select
              value={formData.parent_advisor_id}
              onValueChange={(value) => setFormData({ ...formData, parent_advisor_id: value })}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select upline agent" />
              </SelectTrigger>
              <SelectContent>
                {parentAgents
                  .filter((a) => a.id !== initialData?.id)
                  .map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.first_name} {agent.last_name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="terminated">Terminated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="commission_eligible"
            checked={formData.commission_eligible}
            onCheckedChange={(checked) =>
              setFormData({ ...formData, commission_eligible: checked === true })
            }
            disabled={loading}
          />
          <Label htmlFor="commission_eligible">Eligible for commissions</Label>
        </div>
      </div>

      {/* Branding */}
      <div className="space-y-4">
        <h3 className="font-medium text-slate-900">Branding (Optional)</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="company_name">Company Name</Label>
            <Input
              id="company_name"
              value={formData.company_name}
              onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website_url">Website URL</Label>
            <Input
              id="website_url"
              type="url"
              value={formData.website_url}
              onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
              placeholder="https://"
              disabled={loading}
            />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="primary_color">Primary</Label>
            <Input
              id="primary_color"
              type="color"
              value={formData.primary_color}
              onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
              className="h-10 p-1"
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="secondary_color">Secondary</Label>
            <Input
              id="secondary_color"
              type="color"
              value={formData.secondary_color}
              onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
              className="h-10 p-1"
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="header_bg_color">Header BG</Label>
            <Input
              id="header_bg_color"
              type="color"
              value={formData.header_bg_color}
              onChange={(e) => setFormData({ ...formData, header_bg_color: e.target.value })}
              className="h-10 p-1"
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="header_text_color">Header Text</Label>
            <Input
              id="header_text_color"
              type="color"
              value={formData.header_text_color}
              onChange={(e) => setFormData({ ...formData, header_text_color: e.target.value })}
              className="h-10 p-1"
              disabled={loading}
            />
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="space-y-4">
        <h3 className="font-medium text-slate-900">Address (Optional)</h3>
        
        <div className="space-y-2">
          <Label htmlFor="street_address">Street Address</Label>
          <Input
            id="street_address"
            value={formData.street_address}
            onChange={(e) => setFormData({ ...formData, street_address: e.target.value })}
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="apartment">Apartment, suite, etc.</Label>
          <Input
            id="apartment"
            value={formData.apartment}
            onChange={(e) => setFormData({ ...formData, apartment: e.target.value })}
            disabled={loading}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent_state">State</Label>
            <Select
              value={formData.state}
              onValueChange={(value) => setFormData({ ...formData, state: value })}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map((st) => (
                  <SelectItem key={st} value={st}>
                    {st}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="zip_code">ZIP Code</Label>
            <Input
              id="zip_code"
              value={formData.zip_code}
              onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
              disabled={loading}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {isEditing ? 'Saving...' : 'Creating...'}
            </>
          ) : isEditing ? (
            'Save Changes'
          ) : (
            'Create Agent'
          )}
        </Button>
      </div>
    </form>
  );
}
