'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import { useClientAuth } from '@/hooks/useClientAuth';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  Checkbox,
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
import { Plus, User, MapPin, Shield, Building2, Contact, ChevronDown } from 'lucide-react';
import type { Database } from '@crm-eco/lib/types';
import { logActivityForMember, ActivityTypes } from '@crm-eco/lib';
import { CustomFieldsForm } from '@/components/shared/custom-fields-form';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

type MemberInsert = Database['public']['Tables']['members']['Insert'];

export function AddMemberDialog() {
  const router = useRouter();
  const { profile: authProfile } = useClientAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    dateOfBirth: string;
    state: string;
    city: string;
    postalCode: string;
    status: 'prospect' | 'pending' | 'active' | 'paused' | 'terminated' | 'inactive';
    programType: string;
    coverageType: string;
    // Extended contact
    phoneExt: string;
    phone2: string;
    phone2Ext: string;
    phone3: string;
    phone3Ext: string;
    fax: string;
    faxExt: string;
    email2: string;
    email3: string;
    county: string;
    // Employment
    companyName: string;
    position: string;
    department: string;
    division: string;
    // Demographics
    ethnicity: string;
    height: string;
    weight: string;
    disability: string;
    driversLicense: string;
    // CRM tracking
    source: string;
    referral: string;
    memberType: string;
    memberType2: string;
    stage: string;
    doNotCall: boolean;
    // System IDs
    internalId: string;
    externalUsername: string;
  }>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    state: '',
    city: '',
    postalCode: '',
    status: 'pending',
    programType: '',
    coverageType: '',
    phoneExt: '',
    phone2: '',
    phone2Ext: '',
    phone3: '',
    phone3Ext: '',
    fax: '',
    faxExt: '',
    email2: '',
    email3: '',
    county: '',
    companyName: '',
    position: '',
    department: '',
    division: '',
    ethnicity: '',
    height: '',
    weight: '',
    disability: '',
    driversLicense: '',
    source: '',
    referral: '',
    memberType: '',
    memberType2: '',
    stage: '',
    doNotCall: false,
    internalId: '',
    externalUsername: '',
  });

  const [customFields, setCustomFields] = useState<Record<string, any>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authProfile) return;
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();

      const insertData: Partial<MemberInsert> = {
        organization_id: authProfile.organization_id,
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        phone: formData.phone || null,
        date_of_birth: formData.dateOfBirth || null,
        state: formData.state || null,
        city: formData.city || null,
        postal_code: formData.postalCode || null,
        status: formData.status,
        program_type: formData.programType || null,
        coverage_type: formData.coverageType || null,
        custom_fields: Object.keys(customFields).length > 0 ? customFields : null,
        // Extended contact
        phone_ext: formData.phoneExt || null,
        phone2: formData.phone2 || null,
        phone2_ext: formData.phone2Ext || null,
        phone3: formData.phone3 || null,
        phone3_ext: formData.phone3Ext || null,
        fax: formData.fax || null,
        fax_ext: formData.faxExt || null,
        email2: formData.email2 || null,
        email3: formData.email3 || null,
        county: formData.county || null,
        // Employment
        company_name: formData.companyName || null,
        position: formData.position || null,
        department: formData.department || null,
        division: formData.division || null,
        // Demographics
        ethnicity: formData.ethnicity || null,
        height: formData.height || null,
        weight: formData.weight || null,
        disability: formData.disability || null,
        drivers_license: formData.driversLicense || null,
        // CRM tracking
        source: formData.source || null,
        referral: formData.referral || null,
        member_type: formData.memberType || null,
        member_type2: formData.memberType2 || null,
        stage: formData.stage || null,
        do_not_call: formData.doNotCall,
        // System IDs
        internal_id: formData.internalId || null,
        external_username: formData.externalUsername || null,
      };

      const { data: insertedMember, error: insertError } = await supabase
        .from('members')
        .insert(insertData as any)
        .select('id')
        .single();

      if (insertError) throw insertError;

      // Log activity
      if (insertedMember) {
        await logActivityForMember({
          organizationId: authProfile.organization_id,
          createdByProfileId: authProfile.id,
          memberId: (insertedMember as { id: string }).id,
          type: ActivityTypes.MEMBER_CREATED,
          subject: `New member: ${formData.firstName} ${formData.lastName}`,
          description: `Created new member with email ${formData.email}`,
        });
      }

      setOpen(false);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        dateOfBirth: '',
        state: '',
        city: '',
        postalCode: '',
        status: 'pending',
        programType: '',
        coverageType: '',
        phoneExt: '',
        phone2: '',
        phone2Ext: '',
        phone3: '',
        phone3Ext: '',
        fax: '',
        faxExt: '',
        email2: '',
        email3: '',
        county: '',
        companyName: '',
        position: '',
        department: '',
        division: '',
        ethnicity: '',
        height: '',
        weight: '',
        disability: '',
        driversLicense: '',
        source: '',
        referral: '',
        memberType: '',
        memberType2: '',
        stage: '',
        doNotCall: false,
        internalId: '',
        externalUsername: '',
      });
      setCustomFields({});
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create member';
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
          Add Member
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Member</DialogTitle>
          <DialogDescription>
            Create a new member in your health sharing organization
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
                  <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Address Section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-medium text-slate-700">Address</h3>
              </div>
              <div className="grid gap-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="New York"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Select
                      value={formData.state}
                      onValueChange={(value) => setFormData({ ...formData, state: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
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
                  <div className="space-y-2">
                    <Label htmlFor="postalCode">ZIP Code</Label>
                    <Input
                      id="postalCode"
                      value={formData.postalCode}
                      onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                      placeholder="10001"
                    />
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Coverage Section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-medium text-slate-700">Coverage Information</h3>
              </div>
              <div className="grid gap-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="status">Status *</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value: 'prospect' | 'pending' | 'active' | 'paused' | 'terminated' | 'inactive') => 
                        setFormData({ ...formData, status: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prospect">Prospect</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="paused">Paused</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="programType">Program Type</Label>
                    <Select
                      value={formData.programType}
                      onValueChange={(value) => setFormData({ ...formData, programType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="healthshare">Health Sharing</SelectItem>
                        <SelectItem value="major_medical">Major Medical</SelectItem>
                        <SelectItem value="dental">Dental</SelectItem>
                        <SelectItem value="vision">Vision</SelectItem>
                        <SelectItem value="supplemental">Supplemental</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="coverageType">Coverage Type</Label>
                    <Select
                      value={formData.coverageType}
                      onValueChange={(value) => setFormData({ ...formData, coverageType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="individual">Individual</SelectItem>
                        <SelectItem value="family">Family</SelectItem>
                        <SelectItem value="couple">Couple</SelectItem>
                        <SelectItem value="group">Group</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Advanced Fields - Collapsible */}
            <Accordion type="single" collapsible>
              <AccordionItem value="extended-contact" className="border rounded-lg px-3">
                <AccordionTrigger className="text-sm font-medium text-slate-700 py-3">
                  <div className="flex items-center gap-2">
                    <Contact className="w-4 h-4 text-slate-400" />
                    Extended Contact Info
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="grid gap-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2 col-span-2">
                        <Label>Phone 1 Extension</Label>
                        <Input
                          value={formData.phoneExt}
                          onChange={(e) => setFormData({ ...formData, phoneExt: e.target.value })}
                          placeholder="Ext"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>County</Label>
                        <Input
                          value={formData.county}
                          onChange={(e) => setFormData({ ...formData, county: e.target.value })}
                          placeholder="County"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Phone 2</Label>
                        <Input
                          value={formData.phone2}
                          onChange={(e) => setFormData({ ...formData, phone2: e.target.value })}
                          placeholder="(555) 234-5678"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone 2 Ext</Label>
                        <Input
                          value={formData.phone2Ext}
                          onChange={(e) => setFormData({ ...formData, phone2Ext: e.target.value })}
                          placeholder="Ext"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Phone 3</Label>
                        <Input
                          value={formData.phone3}
                          onChange={(e) => setFormData({ ...formData, phone3: e.target.value })}
                          placeholder="(555) 345-6789"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone 3 Ext</Label>
                        <Input
                          value={formData.phone3Ext}
                          onChange={(e) => setFormData({ ...formData, phone3Ext: e.target.value })}
                          placeholder="Ext"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Fax</Label>
                        <Input
                          value={formData.fax}
                          onChange={(e) => setFormData({ ...formData, fax: e.target.value })}
                          placeholder="(555) 456-7890"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Fax Ext</Label>
                        <Input
                          value={formData.faxExt}
                          onChange={(e) => setFormData({ ...formData, faxExt: e.target.value })}
                          placeholder="Ext"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Email 2</Label>
                        <Input
                          type="email"
                          value={formData.email2}
                          onChange={(e) => setFormData({ ...formData, email2: e.target.value })}
                          placeholder="alternate@example.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email 3</Label>
                        <Input
                          type="email"
                          value={formData.email3}
                          onChange={(e) => setFormData({ ...formData, email3: e.target.value })}
                          placeholder="third@example.com"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <Checkbox
                        id="doNotCall"
                        checked={formData.doNotCall}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, doNotCall: checked === true })
                        }
                      />
                      <Label htmlFor="doNotCall" className="text-sm font-normal">Do Not Call</Label>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="employment" className="border rounded-lg px-3 mt-2">
                <AccordionTrigger className="text-sm font-medium text-slate-700 py-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    Employment
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Company Name</Label>
                        <Input
                          value={formData.companyName}
                          onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                          placeholder="Acme Corp"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Position</Label>
                        <Input
                          value={formData.position}
                          onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                          placeholder="Manager"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Department</Label>
                        <Input
                          value={formData.department}
                          onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                          placeholder="Sales"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Division</Label>
                        <Input
                          value={formData.division}
                          onChange={(e) => setFormData({ ...formData, division: e.target.value })}
                          placeholder="West Region"
                        />
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="demographics" className="border rounded-lg px-3 mt-2">
                <AccordionTrigger className="text-sm font-medium text-slate-700 py-3">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400" />
                    Demographics
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="grid gap-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Ethnicity</Label>
                        <Input
                          value={formData.ethnicity}
                          onChange={(e) => setFormData({ ...formData, ethnicity: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Height</Label>
                        <Input
                          value={formData.height}
                          onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                          placeholder={`5'10"`}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Weight</Label>
                        <Input
                          value={formData.weight}
                          onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                          placeholder="180 lbs"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Disability</Label>
                        <Input
                          value={formData.disability}
                          onChange={(e) => setFormData({ ...formData, disability: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Drivers License</Label>
                        <Input
                          value={formData.driversLicense}
                          onChange={(e) => setFormData({ ...formData, driversLicense: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="crm-tracking" className="border rounded-lg px-3 mt-2">
                <AccordionTrigger className="text-sm font-medium text-slate-700 py-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-slate-400" />
                    Source & Tracking
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Source</Label>
                        <Input
                          value={formData.source}
                          onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                          placeholder="Referral, Web, Phone..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Referral</Label>
                        <Input
                          value={formData.referral}
                          onChange={(e) => setFormData({ ...formData, referral: e.target.value })}
                          placeholder="Referral source"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Member Type</Label>
                        <Input
                          value={formData.memberType}
                          onChange={(e) => setFormData({ ...formData, memberType: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Member Type 2</Label>
                        <Input
                          value={formData.memberType2}
                          onChange={(e) => setFormData({ ...formData, memberType2: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Stage</Label>
                        <Input
                          value={formData.stage}
                          onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Internal ID</Label>
                        <Input
                          value={formData.internalId}
                          onChange={(e) => setFormData({ ...formData, internalId: e.target.value })}
                          placeholder="External system ID"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Username</Label>
                      <Input
                        value={formData.externalUsername}
                        onChange={(e) => setFormData({ ...formData, externalUsername: e.target.value })}
                        placeholder="External system username"
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Custom Fields */}
            <CustomFieldsForm
              entityType="member"
              values={customFields}
              onChange={setCustomFields}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Member'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
