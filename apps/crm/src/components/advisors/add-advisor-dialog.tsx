'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from '@crm-eco/ui';
import { Plus, User, Building2, FileText } from 'lucide-react';
import type { Database } from '@crm-eco/lib/types';
import { logActivityForAdvisor, ActivityTypes } from '@crm-eco/lib';
import { CustomFieldsForm } from '@/components/shared/custom-fields-form';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

type AdvisorInsert = Database['public']['Tables']['advisors']['Insert'];

export function AddAdvisorDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    agencyName: string;
    licenseNumber: string;
    licenseStates: string[];
    npn: string;
    status: 'pending' | 'active' | 'paused' | 'inactive' | 'terminated';
    primaryChannel: string;
    compLevel: string;
  }>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    agencyName: '',
    licenseNumber: '',
    licenseStates: [],
    npn: '',
    status: 'pending',
    primaryChannel: '',
    compLevel: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, organization_id')
        .eq('user_id', user.id)
        .single();

      const profile = profileData as { id: string; organization_id: string } | null;
      if (!profile) throw new Error('Profile not found');

      const insertData: AdvisorInsert = {
        organization_id: profile.organization_id,
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        phone: formData.phone || null,
        agency_name: formData.agencyName || null,
        license_number: formData.licenseNumber || null,
        license_states: formData.licenseStates,
        npn: formData.npn || null,
        status: formData.status,
        primary_channel: formData.primaryChannel || null,
        comp_level: formData.compLevel || null,
      };

      const { data: insertedAdvisor, error: insertError } = await supabase
        .from('advisors')
        .insert(insertData as any)
        .select('id')
        .single();

      if (insertError) throw insertError;

      // Log activity
      if (insertedAdvisor) {
        await logActivityForAdvisor({
          organizationId: profile.organization_id,
          createdByProfileId: profile.id,
          advisorId: (insertedAdvisor as { id: string }).id,
          type: ActivityTypes.ADVISOR_CREATED,
          subject: `New advisor: ${formData.firstName} ${formData.lastName}`,
          description: formData.agencyName 
            ? `Created new advisor from ${formData.agencyName}`
            : `Created new advisor with email ${formData.email}`,
        });
      }

      setOpen(false);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        agencyName: '',
        licenseNumber: '',
        licenseStates: [],
        npn: '',
        status: 'pending',
        primaryChannel: '',
        compLevel: '',
      });
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create advisor';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const toggleState = (state: string) => {
    setFormData((prev) => ({
      ...prev,
      licenseStates: prev.licenseStates.includes(state)
        ? prev.licenseStates.filter((s) => s !== state)
        : [...prev.licenseStates, state],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Advisor
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Advisor</DialogTitle>
          <DialogDescription>
            Create a new advisor in your organization
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          )}
          
          <div className="space-y-6 py-4">
            {/* Contact Info Section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <User className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-medium text-slate-700">Contact Information</h3>
              </div>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      placeholder="John"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      placeholder="Doe"
                      required
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
                      placeholder="john@agency.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Agency Section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-medium text-slate-700">Agency Information</h3>
              </div>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="agencyName">Agency Name</Label>
                    <Input
                      id="agencyName"
                      value={formData.agencyName}
                      onChange={(e) => setFormData({ ...formData, agencyName: e.target.value })}
                      placeholder="ABC Insurance Agency"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="primaryChannel">Primary Channel</Label>
                    <Select
                      value={formData.primaryChannel}
                      onValueChange={(value) => setFormData({ ...formData, primaryChannel: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="b2c">B2C (Direct)</SelectItem>
                        <SelectItem value="affiliate">Affiliate</SelectItem>
                        <SelectItem value="agency">Agency</SelectItem>
                        <SelectItem value="broker">Broker</SelectItem>
                        <SelectItem value="call_center">Call Center</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="status">Status *</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value: 'pending' | 'active' | 'paused' | 'inactive' | 'terminated') => 
                        setFormData({ ...formData, status: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="paused">Paused</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="compLevel">Compensation Level</Label>
                    <Select
                      value={formData.compLevel}
                      onValueChange={(value) => setFormData({ ...formData, compLevel: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="preferred">Preferred</SelectItem>
                        <SelectItem value="elite">Elite</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Licensing Section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-medium text-slate-700">Licensing</h3>
              </div>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="licenseNumber">License Number</Label>
                    <Input
                      id="licenseNumber"
                      value={formData.licenseNumber}
                      onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                      placeholder="ABC123456"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="npn">NPN (National Producer Number)</Label>
                    <Input
                      id="npn"
                      value={formData.npn}
                      onChange={(e) => setFormData({ ...formData, npn: e.target.value })}
                      placeholder="12345678"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>License States</Label>
                  <div className="flex flex-wrap gap-1.5 p-3 border rounded-lg max-h-28 overflow-y-auto bg-slate-50">
                    {US_STATES.map((state) => (
                      <button
                        key={state}
                        type="button"
                        onClick={() => toggleState(state)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                          formData.licenseStates.includes(state)
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-slate-600 hover:bg-slate-100 border'
                        }`}
                      >
                        {state}
                      </button>
                    ))}
                  </div>
                  {formData.licenseStates.length > 0 && (
                    <p className="text-xs text-slate-500">
                      Selected: {formData.licenseStates.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Advisor'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
