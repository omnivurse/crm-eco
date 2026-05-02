'use client';

import { useEffect, useState } from 'react';
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
import { AdvisorCombobox } from './AdvisorCombobox';
import { guaranteedUpdateWithVersion } from '@crm-eco/lib';
import { useFormAutosave } from '@/hooks/useFormAutosave';

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
    market_type: string | null;
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
    market_type: initialData?.market_type ?? '',
    status: initialData?.status ?? 'pending',
    existing_condition: initialData?.existing_condition ?? false,
    existing_condition_description: initialData?.existing_condition_description ?? '',
    is_smoker: initialData?.is_smoker ?? false,
    receive_emails: initialData?.receive_emails ?? true,
  });

  // Autosave only fires for edits — there's no row to PATCH on a fresh
  // create. Each form value change resets the 1.5s debounce; flush() runs
  // on tab hide / unmount so the rep's last edits don't drop on the floor.
  const memberId = initialData?.id;
  const autosave = useFormAutosave({
    initial: formData,
    delayMs: 1500,
    save: async (next) => {
      if (!isEditing || !memberId) return;
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const memberData = {
        ...next,
        advisor_id: next.advisor_id || null,
        market_type: next.market_type || null,
        date_of_birth: next.date_of_birth || null,
        phone: next.phone || null,
        gender: next.gender || null,
        address_line1: next.address_line1 || null,
        address_line2: next.address_line2 || null,
        city: next.city || null,
        state: next.state || null,
        zip_code: next.zip_code || null,
        existing_condition_description: next.existing_condition
          ? next.existing_condition_description || null
          : null,
      };
      const result = await guaranteedUpdateWithVersion(
        supabase,
        'members',
        memberId,
        memberData,
      );
      if (!result.ok) throw new Error(result.error);
    },
  });

  // Mirror local formData → autosave hook so every onChange triggers a save.
  useEffect(() => {
    if (isEditing) autosave.setValues(formData);
    // autosave is stable, formData is the dependency we actually care about
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, isEditing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Drain any pending autosave so the manual save doesn't double-fire.
    if (isEditing) await autosave.flush();
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
      market_type: formData.market_type || null,
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
      // Optimistic concurrency: two admins editing the same member
      // simultaneously would have silently overwritten each other.
      // Helper retries up to 3× on version drift, then surfaces a
      // CONFLICT so the UI can prompt the user to refresh.
      const result = await guaranteedUpdateWithVersion(
        supabase,
        'members',
        initialData.id,
        memberData,
      );

      if (!result.ok) {
        setError(result.error);
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
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="first_name">First Name *</Label>
            <Input
              id="first_name"
              value={formData.first_name}
              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              required
              disabled={loading}
              className="h-11 sm:h-10"
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
              className="h-11 sm:h-10"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="date_of_birth">Date of Birth</Label>
            <Input
              id="date_of_birth"
              type="date"
              value={formData.date_of_birth}
              onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
              disabled={loading}
              className="h-11 sm:h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gender">Gender</Label>
            <Select
              value={formData.gender}
              onValueChange={(value) => setFormData({ ...formData, gender: value })}
              disabled={loading}
            >
              <SelectTrigger className="h-11 sm:h-10">
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
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              disabled={loading}
              className="h-11 sm:h-10"
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
              className="h-11 sm:h-10"
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
            className="h-11 sm:h-10"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address_line2">Apartment, suite, etc.</Label>
          <Input
            id="address_line2"
            value={formData.address_line2}
            onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
            disabled={loading}
            className="h-11 sm:h-10"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2 sm:col-span-1">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              disabled={loading}
              className="h-11 sm:h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">State</Label>
            <Select
              value={formData.state}
              onValueChange={(value) => setFormData({ ...formData, state: value })}
              disabled={loading}
            >
              <SelectTrigger className="h-11 sm:h-10">
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
              className="h-11 sm:h-10"
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="market_type">Market Type</Label>
            <Select
              value={formData.market_type || 'unknown'}
              onValueChange={(value) => setFormData({ ...formData, market_type: value === 'unknown' ? '' : value })}
              disabled={loading}
            >
              <SelectTrigger className="h-11 sm:h-10">
                <SelectValue placeholder="Select market type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="healthshare">HealthShare</SelectItem>
                <SelectItem value="traditional_insurance">Traditional Insurance</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="advisor_id">Assigned advisor</Label>
            <AdvisorCombobox
              agents={agents}
              value={formData.advisor_id}
              onValueChange={(value) => setFormData({ ...formData, advisor_id: value })}
              disabled={loading}
              label="advisor"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
              disabled={loading}
            >
              <SelectTrigger className="h-11 sm:h-10">
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

      {/* Actions - stack on mobile */}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t">
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => router.back()} 
          disabled={loading}
          className="w-full sm:w-auto h-11 sm:h-10"
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={loading}
          className="w-full sm:w-auto h-11 sm:h-10"
        >
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
