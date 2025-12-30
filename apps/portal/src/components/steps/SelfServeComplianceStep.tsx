'use client';

import { useState } from 'react';
import { Input, Label, Button, Card, CardContent } from '@crm-eco/ui';
import { Loader2, ArrowRight, AlertTriangle, Check } from 'lucide-react';

interface ComplianceData {
  acknowledged_not_insurance?: boolean;
  acknowledged_sharing_guidelines?: boolean;
  acknowledged_pre_existing_conditions?: boolean;
  electronic_signature?: string;
  signed_at?: string;
}

interface SelfServeComplianceStepProps {
  data?: ComplianceData;
  onComplete: (data: ComplianceData) => void;
  loading: boolean;
}

export function SelfServeComplianceStep({
  data,
  onComplete,
  loading,
}: SelfServeComplianceStepProps) {
  const [formData, setFormData] = useState<ComplianceData>({
    acknowledged_not_insurance: data?.acknowledged_not_insurance || false,
    acknowledged_sharing_guidelines: data?.acknowledged_sharing_guidelines || false,
    acknowledged_pre_existing_conditions: data?.acknowledged_pre_existing_conditions || false,
    electronic_signature: data?.electronic_signature || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const allAcknowledged = 
    formData.acknowledged_not_insurance &&
    formData.acknowledged_sharing_guidelines &&
    formData.acknowledged_pre_existing_conditions;

  const toggleAcknowledgment = (field: keyof ComplianceData) => {
    setFormData((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.acknowledged_not_insurance) {
      newErrors.acknowledged_not_insurance = 'This acknowledgment is required';
    }
    if (!formData.acknowledged_sharing_guidelines) {
      newErrors.acknowledged_sharing_guidelines = 'This acknowledgment is required';
    }
    if (!formData.acknowledged_pre_existing_conditions) {
      newErrors.acknowledged_pre_existing_conditions = 'This acknowledgment is required';
    }
    if (!formData.electronic_signature?.trim()) {
      newErrors.electronic_signature = 'Please type your full legal name to sign';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onComplete(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Important Warning */}
      <Card className="bg-amber-50 border-amber-300">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-amber-900 mb-2">
                Important: Please Read Carefully
              </h4>
              <p className="text-sm text-amber-800">
                Before proceeding, you must understand and acknowledge the following 
                about healthshare programs. Take your time to read each section.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Acknowledgment 1: Not Insurance */}
      <Card className={formData.acknowledged_not_insurance ? 'border-green-300 bg-green-50' : ''}>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => toggleAcknowledgment('acknowledged_not_insurance')}
              className={`flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                formData.acknowledged_not_insurance
                  ? 'bg-green-600 border-green-600 text-white'
                  : 'border-slate-300 hover:border-blue-500'
              }`}
            >
              {formData.acknowledged_not_insurance && <Check className="w-4 h-4" />}
            </button>
            <div className="flex-1">
              <h4 className="font-semibold text-slate-900 mb-2">
                This Is NOT Insurance
              </h4>
              <p className="text-sm text-slate-700 mb-2">
                I understand that WealthShare is a <strong>health cost sharing ministry</strong>, 
                not an insurance company or product. Members share each other&apos;s medical 
                expenses voluntarily. This program:
              </p>
              <ul className="text-sm text-slate-600 list-disc ml-4 space-y-1">
                <li>Is not regulated as insurance and is not subject to state insurance mandates</li>
                <li>Does not guarantee payment of any medical expense</li>
                <li>Does not pay claims – instead, members share eligible medical needs</li>
                <li>May not satisfy ACA/healthcare mandate requirements in some states</li>
              </ul>
              {errors.acknowledged_not_insurance && (
                <p className="text-sm text-red-600 mt-2">{errors.acknowledged_not_insurance}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Acknowledgment 2: Sharing Guidelines */}
      <Card className={formData.acknowledged_sharing_guidelines ? 'border-green-300 bg-green-50' : ''}>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => toggleAcknowledgment('acknowledged_sharing_guidelines')}
              className={`flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                formData.acknowledged_sharing_guidelines
                  ? 'bg-green-600 border-green-600 text-white'
                  : 'border-slate-300 hover:border-blue-500'
              }`}
            >
              {formData.acknowledged_sharing_guidelines && <Check className="w-4 h-4" />}
            </button>
            <div className="flex-1">
              <h4 className="font-semibold text-slate-900 mb-2">
                Sharing Guidelines Apply
              </h4>
              <p className="text-sm text-slate-700 mb-2">
                I understand that all medical needs must meet the program&apos;s 
                <strong> Sharing Guidelines</strong> to be eligible for sharing:
              </p>
              <ul className="text-sm text-slate-600 list-disc ml-4 space-y-1">
                <li>Not all medical expenses are eligible for sharing</li>
                <li>Pre-existing conditions may have waiting periods or limitations</li>
                <li>Some procedures require prior notification</li>
                <li>Annual and per-incident limits may apply</li>
                <li>I am responsible for reading and understanding the full guidelines</li>
              </ul>
              {errors.acknowledged_sharing_guidelines && (
                <p className="text-sm text-red-600 mt-2">{errors.acknowledged_sharing_guidelines}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Acknowledgment 3: Pre-existing Conditions */}
      <Card className={formData.acknowledged_pre_existing_conditions ? 'border-green-300 bg-green-50' : ''}>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => toggleAcknowledgment('acknowledged_pre_existing_conditions')}
              className={`flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                formData.acknowledged_pre_existing_conditions
                  ? 'bg-green-600 border-green-600 text-white'
                  : 'border-slate-300 hover:border-blue-500'
              }`}
            >
              {formData.acknowledged_pre_existing_conditions && <Check className="w-4 h-4" />}
            </button>
            <div className="flex-1">
              <h4 className="font-semibold text-slate-900 mb-2">
                Pre-Existing Conditions &amp; Age Limitations
              </h4>
              <p className="text-sm text-slate-700 mb-2">
                I understand the following limitations:
              </p>
              <ul className="text-sm text-slate-600 list-disc ml-4 space-y-1">
                <li>
                  <strong>Pre-existing conditions</strong> (medical conditions diagnosed or treated 
                  in the 36 months before enrollment) may be subject to waiting periods, 
                  phase-in sharing, or exclusions
                </li>
                <li>
                  <strong>Members age 65 and older</strong> have different eligibility requirements 
                  and may need to maintain Medicare as primary coverage
                </li>
                <li>
                  I have disclosed all known medical conditions accurately in my application
                </li>
                <li>
                  Failure to disclose pre-existing conditions may result in denial of sharing
                </li>
              </ul>
              {errors.acknowledged_pre_existing_conditions && (
                <p className="text-sm text-red-600 mt-2">{errors.acknowledged_pre_existing_conditions}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Electronic Signature */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-slate-900 mb-2">Electronic Signature</h4>
              <p className="text-sm text-slate-600">
                By typing your full legal name below, you acknowledge that you have read, 
                understood, and agree to all the statements above. This serves as your 
                electronic signature.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="signature">Type Your Full Legal Name *</Label>
              <Input
                id="signature"
                placeholder="John A. Smith"
                value={formData.electronic_signature || ''}
                onChange={(e) => setFormData((prev) => ({ 
                  ...prev, 
                  electronic_signature: e.target.value 
                }))}
                className={`text-lg ${errors.electronic_signature ? 'border-red-500' : ''}`}
                disabled={!allAcknowledged}
              />
              {errors.electronic_signature && (
                <p className="text-sm text-red-600">{errors.electronic_signature}</p>
              )}
              {!allAcknowledged && (
                <p className="text-sm text-amber-600">
                  Please acknowledge all statements above before signing
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-600">
        <p>
          <strong>Summary:</strong> By completing this enrollment, you are joining a 
          community of members who voluntarily share medical expenses according to 
          established guidelines. Sharing is not guaranteed but is facilitated by the 
          WealthShare community.
        </p>
      </div>

      {/* Submit */}
      <div className="flex justify-end pt-4">
        <Button 
          type="submit" 
          disabled={loading || !allAcknowledged} 
          className="gap-2"
        >
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

