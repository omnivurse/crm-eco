'use client';

import { useState, useEffect } from 'react';
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
  Textarea,
} from '@crm-eco/ui';
import { Plus, User, MapPin, Target, FileText } from 'lucide-react';
import type { Database } from '@crm-eco/lib/types';
import { logActivityForLead, ActivityTypes } from '@crm-eco/lib';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

const LEAD_SOURCES = [
  { value: 'website', label: 'Website' },
  { value: 'referral', label: 'Referral' },
  { value: 'call_center', label: 'Call Center' },
  { value: 'social', label: 'Social Media' },
  { value: 'event', label: 'Event' },
  { value: 'partner', label: 'Partner' },
  { value: 'other', label: 'Other' },
];

const CURRENT_COVERAGE_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'group', label: 'Group/Employer' },
  { value: 'individual', label: 'Individual' },
  { value: 'marketplace', label: 'Marketplace/ACA' },
  { value: 'medicare', label: 'Medicare' },
  { value: 'medicaid', label: 'Medicaid' },
  { value: 'other', label: 'Other' },
];

const LEAD_STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'working', label: 'Working' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'unqualified', label: 'Unqualified' },
];

type LeadInsert = Database['public']['Tables']['leads']['Insert'];
type Advisor = Database['public']['Tables']['advisors']['Row'];

export function CreateLeadDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    state: '',
    source: '',
    campaign: '',
    householdSize: '',
    desiredStartDate: '',
    currentCoverage: '',
    status: 'new' as 'new' | 'contacted' | 'working' | 'qualified' | 'unqualified' | 'converted' | 'lost',
    advisorId: '',
    notes: '',
  });

  // Fetch advisors when dialog opens
  useEffect(() => {
    if (open) {
      const fetchAdvisors = async () => {
        const supabase = createClient();
        const { data } = await supabase
          .from('advisors')
          .select('id, first_name, last_name')
          .eq('status', 'active')
          .order('last_name');
        
        if (data) {
          setAdvisors(data as Advisor[]);
        }
      };
      fetchAdvisors();
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      
      // Get current user's profile to get organization_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, organization_id')
        .eq('user_id', user.id)
        .single();

      const profile = profileData as { id: string; organization_id: string } | null;
      if (!profile) throw new Error('Profile not found');

      const insertData: LeadInsert = {
        organization_id: profile.organization_id,
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        phone: formData.phone || null,
        state: formData.state || null,
        source: formData.source || null,
        campaign: formData.campaign || null,
        household_size: formData.householdSize ? parseInt(formData.householdSize) : null,
        desired_start_date: formData.desiredStartDate || null,
        current_coverage: formData.currentCoverage || null,
        status: formData.status,
        advisor_id: formData.advisorId || null,
        notes: formData.notes || null,
      };

      const { data: insertedLead, error: insertError } = await supabase
        .from('leads')
        .insert(insertData as any)
        .select('id')
        .single();

      if (insertError) throw insertError;

      // Log activity
      if (insertedLead) {
        await logActivityForLead({
          organizationId: profile.organization_id,
          createdByProfileId: profile.id,
          leadId: (insertedLead as { id: string }).id,
          type: ActivityTypes.LEAD_CREATED,
          subject: `New lead: ${formData.firstName} ${formData.lastName}`,
          description: formData.source 
            ? `Lead from ${formData.source} source`
            : `Created new lead with email ${formData.email}`,
        });
      }

      setOpen(false);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        state: '',
        source: '',
        campaign: '',
        householdSize: '',
        desiredStartDate: '',
        currentCoverage: '',
        status: 'new',
        advisorId: '',
        notes: '',
      });
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create lead';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Lead
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Lead</DialogTitle>
          <DialogDescription>
            Create a new lead to track potential members
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
                      placeholder="john@example.com"
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
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Select
                    value={formData.state}
                    onValueChange={(value) => setFormData({ ...formData, state: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Lead Source Section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-medium text-slate-700">Lead Source & Tracking</h3>
              </div>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="source">Source</Label>
                    <Select
                      value={formData.source}
                      onValueChange={(value) => setFormData({ ...formData, source: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select source" />
                      </SelectTrigger>
                      <SelectContent>
                        {LEAD_SOURCES.map((source) => (
                          <SelectItem key={source.value} value={source.value}>
                            {source.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="campaign">Campaign</Label>
                    <Input
                      id="campaign"
                      value={formData.campaign}
                      onChange={(e) => setFormData({ ...formData, campaign: e.target.value })}
                      placeholder="e.g., Q1 2024 Promo"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="status">Status *</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value: 'new' | 'contacted' | 'working' | 'qualified' | 'unqualified' | 'converted' | 'lost') => 
                        setFormData({ ...formData, status: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {LEAD_STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="advisor">Assign to Advisor</Label>
                    <Select
                      value={formData.advisorId}
                      onValueChange={(value) => setFormData({ ...formData, advisorId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select advisor" />
                      </SelectTrigger>
                      <SelectContent>
                        {advisors.map((advisor) => (
                          <SelectItem key={advisor.id} value={advisor.id}>
                            {advisor.first_name} {advisor.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Coverage Interest Section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-medium text-slate-700">Coverage Interest</h3>
              </div>
              <div className="grid gap-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="householdSize">Household Size</Label>
                    <Input
                      id="householdSize"
                      type="number"
                      min="1"
                      max="20"
                      value={formData.householdSize}
                      onChange={(e) => setFormData({ ...formData, householdSize: e.target.value })}
                      placeholder="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="desiredStartDate">Desired Start Date</Label>
                    <Input
                      id="desiredStartDate"
                      type="date"
                      value={formData.desiredStartDate}
                      onChange={(e) => setFormData({ ...formData, desiredStartDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currentCoverage">Current Coverage</Label>
                    <Select
                      value={formData.currentCoverage}
                      onValueChange={(value) => setFormData({ ...formData, currentCoverage: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENT_COVERAGE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Notes Section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-medium text-slate-700">Notes</h3>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any additional information about this lead..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Lead'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

