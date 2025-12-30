'use client';

import { useState } from 'react';
import { Input, Label, Button, Card, CardContent, Badge } from '@crm-eco/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@crm-eco/ui';
import { Loader2, ArrowRight, Plus, Trash2, Users } from 'lucide-react';
import type { HouseholdMember } from '../SelfServeEnrollmentWizard';

interface SelfServeHouseholdStepProps {
  members: HouseholdMember[];
  onComplete: (members: HouseholdMember[]) => void;
  loading: boolean;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

const emptyMember = (): HouseholdMember => ({
  id: generateId(),
  first_name: '',
  last_name: '',
  date_of_birth: '',
  relationship: 'spouse',
});

export function SelfServeHouseholdStep({
  members: initialMembers,
  onComplete,
  loading,
}: SelfServeHouseholdStepProps) {
  const [members, setMembers] = useState<HouseholdMember[]>(
    initialMembers.length > 0 ? initialMembers : []
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const addMember = () => {
    setMembers((prev) => [...prev, emptyMember()]);
  };

  const removeMember = (id: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== id));
    // Clear errors for removed member
    setErrors((prev) => {
      const newErrors = { ...prev };
      Object.keys(newErrors).forEach((key) => {
        if (key.startsWith(id)) delete newErrors[key];
      });
      return newErrors;
    });
  };

  const updateMember = (id: string, field: keyof HouseholdMember, value: string) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
    // Clear error for this field
    const errorKey = `${id}-${field}`;
    if (errors[errorKey]) {
      setErrors((prev) => ({ ...prev, [errorKey]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    members.forEach((member) => {
      if (!member.first_name.trim()) {
        newErrors[`${member.id}-first_name`] = 'First name is required';
      }
      if (!member.last_name.trim()) {
        newErrors[`${member.id}-last_name`] = 'Last name is required';
      }
      if (!member.date_of_birth) {
        newErrors[`${member.id}-date_of_birth`] = 'Date of birth is required';
      } else {
        const dob = new Date(member.date_of_birth);
        const today = new Date();
        if (dob >= today) {
          newErrors[`${member.id}-date_of_birth`] = 'Date must be in the past';
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onComplete(members);
    }
  };

  const getRelationshipLabel = (rel: string) => {
    switch (rel) {
      case 'spouse': return 'Spouse';
      case 'child': return 'Child';
      case 'dependent': return 'Other Dependent';
      default: return rel;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Adding family members?</strong> Include your spouse and any dependents 
          you&apos;d like to cover under your membership. If it&apos;s just you, you can skip 
          this step by clicking Continue.
        </p>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-2 text-slate-600">
        <Users className="w-5 h-5" />
        <span>
          {members.length === 0 
            ? 'No additional household members' 
            : `${members.length} household member${members.length > 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Member Cards */}
      {members.length > 0 && (
        <div className="space-y-4">
          {members.map((member, index) => (
            <Card key={member.id} className="relative">
              <CardContent className="pt-6">
                <div className="absolute top-2 right-2 flex items-center gap-2">
                  <Badge variant="secondary">
                    {getRelationshipLabel(member.relationship)}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeMember(member.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label>First Name *</Label>
                    <Input
                      placeholder="First name"
                      value={member.first_name}
                      onChange={(e) => updateMember(member.id, 'first_name', e.target.value)}
                      className={errors[`${member.id}-first_name`] ? 'border-red-500' : ''}
                    />
                    {errors[`${member.id}-first_name`] && (
                      <p className="text-sm text-red-600">{errors[`${member.id}-first_name`]}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Last Name *</Label>
                    <Input
                      placeholder="Last name"
                      value={member.last_name}
                      onChange={(e) => updateMember(member.id, 'last_name', e.target.value)}
                      className={errors[`${member.id}-last_name`] ? 'border-red-500' : ''}
                    />
                    {errors[`${member.id}-last_name`] && (
                      <p className="text-sm text-red-600">{errors[`${member.id}-last_name`]}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Date of Birth *</Label>
                    <Input
                      type="date"
                      value={member.date_of_birth}
                      onChange={(e) => updateMember(member.id, 'date_of_birth', e.target.value)}
                      className={errors[`${member.id}-date_of_birth`] ? 'border-red-500' : ''}
                    />
                    {errors[`${member.id}-date_of_birth`] && (
                      <p className="text-sm text-red-600">{errors[`${member.id}-date_of_birth`]}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Relationship *</Label>
                    <Select
                      value={member.relationship}
                      onValueChange={(value) => updateMember(member.id, 'relationship', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="spouse">Spouse</SelectItem>
                        <SelectItem value="child">Child</SelectItem>
                        <SelectItem value="dependent">Other Dependent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Member Button */}
      <Button
        type="button"
        variant="outline"
        onClick={addMember}
        className="w-full gap-2"
      >
        <Plus className="w-4 h-4" />
        Add Household Member
      </Button>

      {/* Important Notes */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        <p>
          <strong>Important:</strong> Each household member will be included in your 
          monthly share amount. Children under 26 may be covered as dependents. Members 
          65 and older have different eligibility requirements.
        </p>
      </div>

      {/* Submit */}
      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={loading} className="gap-2">
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

