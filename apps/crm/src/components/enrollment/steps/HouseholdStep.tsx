'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Button } from '@crm-eco/ui';
import { Users, Plus, Trash2 } from 'lucide-react';
import { useEnrollmentWizard, WizardNavigation, HouseholdMember } from '../wizard';
import { completeHouseholdStep } from '@/app/crm/enrollment/actions';

const RELATIONSHIPS = [
  { value: 'primary', label: 'Primary (Self)' },
  { value: 'spouse', label: 'Spouse' },
  { value: 'child', label: 'Child' },
  { value: 'other', label: 'Other Dependent' },
];

const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

export function HouseholdStep() {
  const {
    enrollmentId,
    snapshot,
    setIsLoading,
    setError,
    markStepComplete,
    nextStep,
    updateSnapshot,
  } = useEnrollmentWizard();

  // Initialize with primary member from intake, or existing household data
  const initialMembers: HouseholdMember[] = snapshot.household?.members || [
    {
      relationship: 'primary',
      firstName: snapshot.intake?.newMember?.firstName || '',
      lastName: snapshot.intake?.newMember?.lastName || '',
      dateOfBirth: snapshot.intake?.newMember?.dateOfBirth || '',
      gender: '',
      tobaccoUse: false,
    },
  ];

  const [members, setMembers] = useState<HouseholdMember[]>(initialMembers);

  const addMember = () => {
    setMembers([
      ...members,
      {
        relationship: 'spouse',
        firstName: '',
        lastName: '',
        dateOfBirth: '',
        gender: '',
        tobaccoUse: false,
      },
    ]);
  };

  const removeMember = (index: number) => {
    // Don't allow removing primary member
    if (members[index].relationship === 'primary') return;
    setMembers(members.filter((_, i) => i !== index));
  };

  const updateMember = (index: number, field: keyof HouseholdMember, value: string | boolean) => {
    setMembers(
      members.map((member, i) =>
        i === index ? { ...member, [field]: value } : member
      )
    );
  };

  const validateForm = (): string | null => {
    // Check for primary member
    const hasPrimary = members.some((m) => m.relationship === 'primary');
    if (!hasPrimary) return 'Primary member is required';

    // Check each member has required fields
    for (let i = 0; i < members.length; i++) {
      const member = members[i];
      if (!member.firstName.trim()) return `Member ${i + 1}: First name is required`;
      if (!member.lastName.trim()) return `Member ${i + 1}: Last name is required`;
      if (!member.dateOfBirth) return `Member ${i + 1}: Date of birth is required`;
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
      const result = await completeHouseholdStep({
        enrollmentId,
        householdSize: members.length,
        members,
      });

      if (!result.success) {
        setError(result.error || 'Failed to complete household step');
        return;
      }

      updateSnapshot('household', {
        householdSize: members.length,
        members,
      });

      markStepComplete('household');
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
            <Users className="w-5 h-5 text-slate-400" />
            Household Members
          </CardTitle>
          <CardDescription>
            Add all family members who will be included in this enrollment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {members.map((member, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${
                  member.relationship === 'primary'
                    ? 'border-blue-200 bg-blue-50/50'
                    : 'border-slate-200 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-slate-700">
                    {member.relationship === 'primary' ? 'Primary Member' : `Dependent ${index}`}
                  </h4>
                  {member.relationship !== 'primary' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMember(index)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Relationship</Label>
                    <Select
                      value={member.relationship}
                      onValueChange={(value) =>
                        updateMember(index, 'relationship', value as HouseholdMember['relationship'])
                      }
                      disabled={member.relationship === 'primary'}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RELATIONSHIPS.filter(
                          (r) => r.value !== 'primary' || member.relationship === 'primary'
                        ).map((rel) => (
                          <SelectItem key={rel.value} value={rel.value}>
                            {rel.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>First Name *</Label>
                    <Input
                      value={member.firstName}
                      onChange={(e) => updateMember(index, 'firstName', e.target.value)}
                      placeholder="First name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Last Name *</Label>
                    <Input
                      value={member.lastName}
                      onChange={(e) => updateMember(index, 'lastName', e.target.value)}
                      placeholder="Last name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Date of Birth *</Label>
                    <Input
                      type="date"
                      value={member.dateOfBirth}
                      onChange={(e) => updateMember(index, 'dateOfBirth', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Gender</Label>
                    <Select
                      value={member.gender}
                      onValueChange={(value) =>
                        updateMember(index, 'gender', value as HouseholdMember['gender'])
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        {GENDERS.map((g) => (
                          <SelectItem key={g.value} value={g.value}>
                            {g.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Tobacco Use</Label>
                    <Select
                      value={member.tobaccoUse ? 'yes' : 'no'}
                      onValueChange={(value) => updateMember(index, 'tobaccoUse', value === 'yes')}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="yes">Yes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}

            <Button type="button" variant="outline" onClick={addMember} className="w-full gap-2">
              <Plus className="w-4 h-4" />
              Add Dependent
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Total Household Size</p>
              <p className="text-2xl font-bold text-slate-900">{members.length}</p>
            </div>
            <Users className="w-8 h-8 text-slate-300" />
          </div>
        </CardContent>
      </Card>

      <WizardNavigation
        onNext={handleNext}
        isNextDisabled={members.length === 0}
      />
    </div>
  );
}

