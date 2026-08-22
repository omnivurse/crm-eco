'use client';

import { useState, useEffect } from 'react';
import { CRM_PIPELINE_STATUSES } from '@/lib/crm/status-allowlist';
import { useRouter } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import { useClientAuth } from '@/hooks/useClientAuth';
import { postCrmRecord } from '@/lib/crm/create-record-client';
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
import { Plus, User, MapPin, Target, FileText, AlertTriangle, ExternalLink, Building2 } from 'lucide-react';
import { logActivityForLead, ActivityTypes } from '@crm-eco/lib';
import type { Advisor as CanonicalAdvisor } from '@crm-eco/lib/types';

type Advisor = Pick<CanonicalAdvisor, 'id' | 'first_name' | 'last_name'>;

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
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

// The leads pipeline vocabulary (status-allowlist.ts / crm_status_vocabulary).
const LEAD_STATUS_OPTIONS = CRM_PIPELINE_STATUSES.map((value) => ({ value, label: value }));

// Roles for the point-of-contact on a small-group lead (often not the
// decision-maker — e.g. the person who takes your call is the Office Manager).
const CONTACT_ROLE_OPTIONS = [
  'Owner',
  'Decision Maker',
  'Office Manager',
  'HR Manager',
  'Office Admin',
  'Benefits Coordinator',
  'Accountant / Bookkeeper',
  'Other',
];

function mapLegacyStatus(status: string): string {
  const legacy: Record<string, string> = {
    new: 'New',
    'not contacted': 'New',
    contacted: 'Contacted',
    working: 'Contacted',
    'attempted to contact': 'Attempted',
    qualified: 'Qualified',
    'hot prospect - ready to move': 'Qualified',
    unqualified: 'Unqualified',
    'not qualified': 'Unqualified',
    converted: 'Converted',
    lost: 'Lost',
    'lost opportunity': 'Lost',
  };
  return legacy[status.trim().toLowerCase()] ?? status;
}

const INITIAL_FORM_DATA = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  groupName: '',
  contactRole: '',
  isDecisionMaker: '',
  contactPhone: '',
  contactEmail: '',
  state: '',
  source: '',
  campaign: '',
  householdSize: '',
  desiredStartDate: '',
  currentCoverage: '',
  status: 'New',
  advisorId: '',
  notes: '',
};

export function CreateLeadDialog() {
  const router = useRouter();
  const { profile: authProfile } = useClientAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [leadsModuleId, setLeadsModuleId] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<{
    id: string;
    title: string | null;
    email: string | null;
  } | null>(null);
  const [forceCreate, setForceCreate] = useState(false);

  const [formData, setFormData] = useState(INITIAL_FORM_DATA);

  useEffect(() => {
    if (open && authProfile?.organization_id) {
      const fetchMeta = async () => {
        const supabase = createClient();
        const [{ data: advisorsData }, { data: moduleData }] = await Promise.all([
          supabase
            .from('advisors')
            .select('id, first_name, last_name')
            .eq('organization_id', authProfile.organization_id)
            .eq('status', 'active')
            .order('last_name'),
          supabase
            .from('crm_modules')
            .select('id')
            .eq('org_id', authProfile.organization_id)
            .eq('key', 'leads')
            .eq('is_enabled', true)
            .maybeSingle(),
        ]);

        if (advisorsData) setAdvisors(advisorsData as Advisor[]);
        setLeadsModuleId(moduleData?.id ?? null);
      };
      void fetchMeta();
    }
  }, [open, authProfile?.organization_id]);

  // Reset all form + dedup state whenever the dialog closes, so a reopened
  // dialog never keeps stale banners/errors or silently bypasses dedup via a
  // lingering forceCreate. Covers the X, ESC, overlay click, Cancel, and success.
  useEffect(() => {
    if (!open) {
      setError(null);
      setDuplicateWarning(null);
      setForceCreate(false);
      setFormData(INITIAL_FORM_DATA);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authProfile) return;
    if (!leadsModuleId) {
      setError('Leads module is not enabled for your organization');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const leadStatus = mapLegacyStatus(formData.status);

      if (!forceCreate && formData.email?.trim()) {
        // Only warn on a TRUE duplicate — same email AND same name. Family members
        // (e.g. a child dependent) may legitimately share a parent's email, so a
        // same-email/different-name match is allowed through without a warning.
        const { data: existing } = await supabase
          .from('crm_records')
          .select('id, title, email, data')
          .eq('org_id', authProfile.organization_id)
          .eq('module_id', leadsModuleId)
          .ilike('email', formData.email.trim())
          .limit(5);

        const newName = `${formData.firstName} ${formData.lastName}`
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .trim();
        const sameNameMatch = (existing ?? []).find((r) => {
          const d = (r.data ?? {}) as Record<string, unknown>;
          const existingName = (
            `${(d.first_name as string) ?? ''} ${(d.last_name as string) ?? ''}`.trim() ||
            (r.title ?? '')
          )
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
          return existingName === newName;
        });

        if (sameNameMatch) {
          setDuplicateWarning(sameNameMatch as { id: string; title: string | null; email: string | null });
          setLoading(false);
          return;
        }
      }

      const recordData: Record<string, unknown> = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email || null,
        phone: formData.phone || null,
        group_name: formData.groupName.trim() || null,
        contact_role: formData.contactRole || null,
        is_decision_maker: formData.isDecisionMaker || null,
        contact_phone: formData.contactPhone.trim() || null,
        contact_email: formData.contactEmail.trim() || null,
        state: formData.state || null,
        lead_source: formData.source || null,
        campaign: formData.campaign || null,
        household_size: formData.householdSize ? parseInt(formData.householdSize, 10) : null,
        desired_start_date: formData.desiredStartDate || null,
        current_coverage: formData.currentCoverage || null,
        lead_status: leadStatus,
        advisor_id: formData.advisorId || null,
        notes: formData.notes || null,
      };

      // owner_id = CRM user (list/assignment). advisor_id = advisor entity.
      // When an advisor is selected and mapped to a profile, set both.
      let ownerId: string | null = authProfile.id;
      if (formData.advisorId) {
        const { data: advProfile } = await supabase
          .from('advisors')
          .select('profile_id')
          .eq('id', formData.advisorId)
          .maybeSingle();
        if (advProfile?.profile_id) {
          ownerId = advProfile.profile_id as string;
        }
      }

      const insertedLead = await postCrmRecord({
        org_id: authProfile.organization_id,
        module_id: leadsModuleId,
        status: leadStatus,
        owner_id: ownerId,
        data: recordData,
        force: forceCreate,
      });

      await logActivityForLead({
        organizationId: authProfile.organization_id,
        createdByProfileId: authProfile.id,
        leadId: insertedLead.id,
        type: ActivityTypes.LEAD_CREATED,
        subject: `New lead: ${formData.firstName} ${formData.lastName}`,
        description: formData.source
          ? `Lead from ${formData.source} source`
          : `Created new lead with email ${formData.email}`,
      });

      setOpen(false); // closing triggers the reset effect above
      router.push(`/crm/r/${insertedLead.id}`);
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
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Lead</DialogTitle>
          <DialogDescription>
            Create a new lead in the CRM Leads module (convertible to contact when qualified)
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {duplicateWarning && (
            <div className="mb-4 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                    A lead with this email already exists
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    {duplicateWarning.title || 'Existing lead'} — {duplicateWarning.email}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/crm/r/${duplicateWarning.id}`)}
                    >
                      <ExternalLink className="h-3.5 w-3.5 mr-1" />
                      View existing
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setForceCreate(true);
                        setDuplicateWarning(null);
                      }}
                    >
                      Create anyway
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>

            <Separator />

            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Building2 className="h-4 w-4" />
              Company &amp; Contact
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              For small groups — record the company and who you&apos;re actually speaking with
              (e.g. the Office Manager), and whether they&apos;re the decision-maker.
            </p>

            <div className="space-y-2">
              <Label htmlFor="groupName">Company / Group</Label>
              <Input
                id="groupName"
                placeholder="e.g. Anchor Construction"
                value={formData.groupName}
                onChange={(e) => setFormData({ ...formData, groupName: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactRole">Contact Role</Label>
                <Select
                  value={formData.contactRole}
                  onValueChange={(value) => setFormData({ ...formData, contactRole: value })}
                >
                  <SelectTrigger id="contactRole">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTACT_ROLE_OPTIONS.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="isDecisionMaker">Primary Decision-Maker?</Label>
                <Select
                  value={formData.isDecisionMaker}
                  onValueChange={(value) => setFormData({ ...formData, isDecisionMaker: value })}
                >
                  <SelectTrigger id="isDecisionMaker">
                    <SelectValue placeholder="Unknown" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactPhone">Direct Phone</Label>
                <Input
                  id="contactPhone"
                  placeholder="Contact's direct line"
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Direct Email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  placeholder="Contact's direct email"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                />
              </div>
            </div>

            <Separator />

            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <MapPin className="h-4 w-4" />
              Location & Source
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Select
                  value={formData.state}
                  onValueChange={(value) => setFormData({ ...formData, state: value })}
                >
                  <SelectTrigger id="state">
                    <SelectValue placeholder="Select state" />
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
                <Label htmlFor="source">Lead Source</Label>
                <Select
                  value={formData.source}
                  onValueChange={(value) => setFormData({ ...formData, source: value })}
                >
                  <SelectTrigger id="source">
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_SOURCES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="campaign">Campaign</Label>
                <Input
                  id="campaign"
                  value={formData.campaign}
                  onChange={(e) => setFormData({ ...formData, campaign: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="advisorId">Assigned Advisor</Label>
                <Select
                  value={formData.advisorId}
                  onValueChange={(value) => setFormData({ ...formData, advisorId: value })}
                >
                  <SelectTrigger id="advisorId">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    {advisors.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.first_name} {a.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Target className="h-4 w-4" />
              Qualification
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currentCoverage">Current Coverage</Label>
                <Select
                  value={formData.currentCoverage}
                  onValueChange={(value) => setFormData({ ...formData, currentCoverage: value })}
                >
                  <SelectTrigger id="currentCoverage">
                    <SelectValue placeholder="Select coverage" />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENT_COVERAGE_OPTIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="householdSize">Household Size</Label>
                <Input
                  id="householdSize"
                  type="number"
                  min={1}
                  value={formData.householdSize}
                  onChange={(e) => setFormData({ ...formData, householdSize: e.target.value })}
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
            </div>

            <Separator />

            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <FileText className="h-4 w-4" />
              Notes
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !leadsModuleId}>
              {loading ? 'Creating…' : 'Create Lead'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
