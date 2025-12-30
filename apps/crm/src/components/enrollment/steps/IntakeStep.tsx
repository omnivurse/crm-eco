'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Button } from '@crm-eco/ui';
import { User, UserPlus, Building2 } from 'lucide-react';
import { useEnrollmentWizard, WizardNavigation } from '../wizard';
import { completeIntakeStep } from '@/app/(dashboard)/enrollments/new/actions';

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  state: string | null;
  date_of_birth: string | null;
}

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
}

interface Advisor {
  id: string;
  first_name: string;
  last_name: string;
}

interface IntakeStepProps {
  members: Member[];
  leads: Lead[];
  advisors: Advisor[];
  currentAdvisorId?: string | null;
  isAdvisorRole: boolean;
}

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN',
  'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT',
  'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

const ENROLLMENT_SOURCES = [
  { value: 'advisor', label: 'Advisor' },
  { value: 'web', label: 'Website' },
  { value: 'phone', label: 'Phone' },
  { value: 'referral', label: 'Referral' },
  { value: 'other', label: 'Other' },
];

export function IntakeStep({ members, leads, advisors, currentAdvisorId, isAdvisorRole }: IntakeStepProps) {
  const {
    enrollmentId,
    snapshot,
    setIsLoading,
    setError,
    markStepComplete,
    nextStep,
    updateSnapshot,
    setPrimaryMemberData,
    setEnrollmentId,
  } = useEnrollmentWizard();

  const [isNewMember, setIsNewMember] = useState(snapshot.intake?.isNewMember ?? false);
  const [selectedMemberId, setSelectedMemberId] = useState(snapshot.intake?.memberId || '');
  const [selectedLeadId, setSelectedLeadId] = useState(snapshot.intake?.leadId || '');
  const [advisorId, setAdvisorId] = useState(snapshot.intake?.advisorId || currentAdvisorId || '');
  const [enrollmentSource, setEnrollmentSource] = useState(snapshot.intake?.enrollmentSource || '');
  const [channel, setChannel] = useState(snapshot.intake?.channel || '');

  // New member form state
  const [newMember, setNewMember] = useState({
    firstName: snapshot.intake?.newMember?.firstName || '',
    lastName: snapshot.intake?.newMember?.lastName || '',
    email: snapshot.intake?.newMember?.email || '',
    phone: snapshot.intake?.newMember?.phone || '',
    dateOfBirth: snapshot.intake?.newMember?.dateOfBirth || '',
    state: snapshot.intake?.newMember?.state || '',
    city: snapshot.intake?.newMember?.city || '',
    postalCode: snapshot.intake?.newMember?.postalCode || '',
    addressLine1: snapshot.intake?.newMember?.addressLine1 || '',
  });

  // Auto-fill from selected lead
  useEffect(() => {
    if (selectedLeadId && isNewMember) {
      const lead = leads.find((l) => l.id === selectedLeadId);
      if (lead) {
        setNewMember((prev) => ({
          ...prev,
          firstName: lead.first_name || prev.firstName,
          lastName: lead.last_name || prev.lastName,
          email: lead.email || prev.email,
        }));
      }
    }
  }, [selectedLeadId, leads, isNewMember]);

  const validateForm = (): string | null => {
    if (isNewMember) {
      if (!newMember.firstName.trim()) return 'First name is required';
      if (!newMember.lastName.trim()) return 'Last name is required';
      if (!newMember.email.trim()) return 'Email is required';
      if (!newMember.dateOfBirth) return 'Date of birth is required';
      if (!newMember.state) return 'State is required';
    } else {
      if (!selectedMemberId) return 'Please select a member';
    }
    return null;
  };

  const handleNext = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!enrollmentId) {
      setError('Enrollment not initialized');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await completeIntakeStep({
        enrollmentId,
        leadId: selectedLeadId || null,
        memberId: isNewMember ? null : selectedMemberId,
        isNewMember,
        newMember: isNewMember ? newMember : undefined,
        advisorId: advisorId || null,
        enrollmentSource,
        channel,
      });

      if (!result.success) {
        setError(result.error || 'Failed to complete intake step');
        return;
      }

      // If this was a new enrollment, update the enrollmentId
      if (result.data?.enrollmentId && result.data.enrollmentId !== enrollmentId) {
        setEnrollmentId(result.data.enrollmentId);
      }

      // Update local state
      updateSnapshot('intake', {
        leadId: selectedLeadId || null,
        memberId: result.data?.memberId || selectedMemberId,
        isNewMember,
        newMember: isNewMember ? newMember : undefined,
        advisorId: advisorId || null,
        enrollmentSource,
        channel,
      });

      // Set primary member data for warnings
      if (result.data) {
        setPrimaryMemberData(
          result.data.memberId,
          result.data.state,
          result.data.dateOfBirth
        );
      }

      markStepComplete('intake');
      nextStep();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-slate-400" />
            Primary Member
          </CardTitle>
          <CardDescription>
            Select an existing member or create a new one for this enrollment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Member Selection Toggle */}
          <div className="flex gap-4">
            <Button
              type="button"
              variant={!isNewMember ? 'default' : 'outline'}
              onClick={() => setIsNewMember(false)}
              className="gap-2"
            >
              <User className="w-4 h-4" />
              Select Existing
            </Button>
            <Button
              type="button"
              variant={isNewMember ? 'default' : 'outline'}
              onClick={() => setIsNewMember(true)}
              className="gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Create New
            </Button>
          </div>

          {!isNewMember ? (
            /* Existing Member Selection */
            <div className="space-y-2">
              <Label>Select Member</Label>
              <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a member" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.first_name} {member.last_name} ({member.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            /* New Member Form */
            <div className="space-y-4 border-t pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={newMember.firstName}
                    onChange={(e) => setNewMember({ ...newMember, firstName: e.target.value })}
                    placeholder="John"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={newMember.lastName}
                    onChange={(e) => setNewMember({ ...newMember, lastName: e.target.value })}
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newMember.email}
                    onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={newMember.phone}
                    onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
                    placeholder="555-123-4567"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={newMember.dateOfBirth}
                    onChange={(e) => setNewMember({ ...newMember, dateOfBirth: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State *</Label>
                  <Select
                    value={newMember.state}
                    onValueChange={(value) => setNewMember({ ...newMember, state: value })}
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

              <div className="space-y-2">
                <Label htmlFor="addressLine1">Address</Label>
                <Input
                  id="addressLine1"
                  value={newMember.addressLine1}
                  onChange={(e) => setNewMember({ ...newMember, addressLine1: e.target.value })}
                  placeholder="123 Main St"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={newMember.city}
                    onChange={(e) => setNewMember({ ...newMember, city: e.target.value })}
                    placeholder="Springfield"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postalCode">Postal Code</Label>
                  <Input
                    id="postalCode"
                    value={newMember.postalCode}
                    onChange={(e) => setNewMember({ ...newMember, postalCode: e.target.value })}
                    placeholder="12345"
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lead Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Link to Lead (Optional)</CardTitle>
          <CardDescription>Associate this enrollment with an existing lead</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
            <SelectTrigger>
              <SelectValue placeholder="No lead selected" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {leads.map((lead) => (
                <SelectItem key={lead.id} value={lead.id}>
                  {lead.first_name} {lead.last_name} {lead.email && `(${lead.email})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Advisor & Source */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="w-4 h-4 text-slate-400" />
            Enrollment Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Advisor</Label>
              <Select
                value={advisorId}
                onValueChange={setAdvisorId}
                disabled={isAdvisorRole}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select advisor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {advisors.map((advisor) => (
                    <SelectItem key={advisor.id} value={advisor.id}>
                      {advisor.first_name} {advisor.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isAdvisorRole && (
                <p className="text-xs text-slate-500">Assigned to you as the advisor</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Enrollment Source</Label>
              <Select value={enrollmentSource} onValueChange={setEnrollmentSource}>
                <SelectTrigger>
                  <SelectValue placeholder="How did they enroll?" />
                </SelectTrigger>
                <SelectContent>
                  {ENROLLMENT_SOURCES.map((source) => (
                    <SelectItem key={source.value} value={source.value}>
                      {source.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="channel">Channel / Campaign (Optional)</Label>
            <Input
              id="channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              placeholder="e.g., Facebook Ads, Google Search"
            />
          </div>
        </CardContent>
      </Card>

      <WizardNavigation
        onNext={handleNext}
        isNextDisabled={isNewMember ? !newMember.firstName || !newMember.email || !newMember.state : !selectedMemberId}
      />
    </div>
  );
}

