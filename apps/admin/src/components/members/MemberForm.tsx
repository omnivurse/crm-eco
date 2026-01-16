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

interface Agent {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface MemberFormProps {
  agents: Agent[];
  initialData?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    date_of_birth: string | null;
    gender: string | null;
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    state: string | null;
    zip_code: string | null;
    advisor_id: string | null;
    status: string;
    existing_condition: boolean;
    existing_condition_description: string | null;
    is_smoker: boolean;
    receive_emails: boolean;
  };
}

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

export function MemberForm({ agents, initialData }: MemberFormProps) {
  const router = useRouter();
  const isEditing = !!initialData;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    first_name: initialData?.first_name ?? '',
    last_name: initialData?.last_name ?? '',
    email: initialData?.email ?? '',
    phone: initialData?.phone ?? '',
    date_of_birth: initialData?.date_of_birth ?? '',
    gender: initialData?.gender ?? '',
    address_line1: initialData?.address_line1 ?? '',
    address_line2: initialData?.address_line2 ?? '',
    city: initialData?.city ?? '',
    state: initialData?.state ?? '',
    zip_code: initialData?.zip_code ?? '',
    advisor_id: initialData?.advisor_id ?? '',
    status: initialData?.status ?? 'pending',
    existing_condition: initialData?.existing_condition ?? false,
    existing_condition_description: initialData?.existing_condition_description ?? '',
    is_smoker: initialData?.is_smoker ?? false,
    receive_emails: initialData?.receive_emails ?? true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Get organization_id from current user's profile
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

    const memberData = {
      ...formData,
      organization_id: profile.organization_id,
      advisor_id: formData.advisor_id || null,
      date_of_birth: formData.date_of_birth || null,
      phone: formData.phone || null,
      gender: formData.gender || null,
      address_line1: formData.address_line1 || null,
      address_line2: formData.address_line2 || null,
      city: formData.city || null,
      state: formData.state || null,
      zip_code: formData.zip_code || null,
      existing_condition_description: formData.existing_condition
        ? formData.existing_condition_description || null
        : null,
    };

    if (isEditing) {
      const { error: updateError } = await supabase
        .from('members')
        .update(memberData)
        .eq('id', initialData.id);

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      router.push(`/members/${initialData.id}`);
    } else {
      const { data: newMember, error: insertError } = await supabase
        .from('members')
        .insert(memberData)
        .select('id')
        .single();

      if (insertError) {
        setError(insertError.message);
        setLoading(false);
        return;
      }

      router.push(`/members/${newMember.id}`);
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
            <Label htmlFor="date_of_birth">Date of Birth</Label>
            <Input
              id="date_of_birth"
              type="date"
              value={formData.date_of_birth}
              onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gender">Gender</Label>
            <Select
              value={formData.gender}
              onValueChange={(value) => setFormData({ ...formData, gender: value })}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="space-y-4">
        <h3 className="font-medium text-slate-900">Contact Information</h3>
        
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

        <div className="space-y-2">
          <Label htmlFor="address_line1">Street Address</Label>
          <Input
            id="address_line1"
            value={formData.address_line1}
            onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address_line2">Apartment, suite, etc.</Label>
          <Input
            id="address_line2"
            value={formData.address_line2}
            onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
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
            <Label htmlFor="state">State</Label>
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

      {/* Health Information */}
      <div className="space-y-4">
        <h3 className="font-medium text-slate-900">Health Information</h3>
        
        <div className="flex items-center space-x-2">
          <Checkbox
            id="is_smoker"
            checked={formData.is_smoker}
            onCheckedChange={(checked) =>
              setFormData({ ...formData, is_smoker: checked === true })
            }
            disabled={loading}
          />
          <Label htmlFor="is_smoker">Tobacco/Nicotine user</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="existing_condition"
            checked={formData.existing_condition}
            onCheckedChange={(checked) =>
              setFormData({ ...formData, existing_condition: checked === true })
            }
            disabled={loading}
          />
          <Label htmlFor="existing_condition">Has pre-existing conditions</Label>
        </div>

        {formData.existing_condition && (
          <div className="space-y-2 ml-6">
            <Label htmlFor="existing_condition_description">Condition Description</Label>
            <Input
              id="existing_condition_description"
              value={formData.existing_condition_description}
              onChange={(e) =>
                setFormData({ ...formData, existing_condition_description: e.target.value })
              }
              placeholder="Describe the pre-existing condition(s)"
              disabled={loading}
            />
          </div>
        )}
      </div>

      {/* Assignment & Status */}
      <div className="space-y-4">
        <h3 className="font-medium text-slate-900">Assignment & Status</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="advisor_id">Assigned Agent</Label>
            <Select
              value={formData.advisor_id}
              onValueChange={(value) => setFormData({ ...formData, advisor_id: value })}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
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
                <SelectItem value="terminated">Terminated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="receive_emails"
            checked={formData.receive_emails}
            onCheckedChange={(checked) =>
              setFormData({ ...formData, receive_emails: checked === true })
            }
            disabled={loading}
          />
          <Label htmlFor="receive_emails">Receive email communications</Label>
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
            'Create Member'
          )}
        </Button>
      </div>
    </form>
  );
}
