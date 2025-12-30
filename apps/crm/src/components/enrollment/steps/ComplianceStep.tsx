'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Label, Checkbox } from '@crm-eco/ui';
import { Shield, AlertTriangle, UserPlus, FileCheck } from 'lucide-react';
import { useEnrollmentWizard, WizardNavigation } from '../wizard';
import { completeComplianceStep } from '@/app/(dashboard)/enrollments/new/actions';

export function ComplianceStep() {
  const {
    enrollmentId,
    snapshot,
    hasMandateWarning,
    hasAge65Warning,
    setIsLoading,
    setError,
    markStepComplete,
    nextStep,
    updateSnapshot,
  } = useEnrollmentWizard();

  const [acknowledgements, setAcknowledgements] = useState({
    healthshare: snapshot.compliance?.healthshareAcknowledgement ?? false,
    guidelines: snapshot.compliance?.guidelinesAcknowledgement ?? false,
    sharingLimitations: snapshot.compliance?.sharingLimitationsAcknowledgement ?? false,
    telehealth: snapshot.compliance?.telehealthConsent ?? false,
    electronicCommunications: snapshot.compliance?.electronicCommunicationsConsent ?? false,
  });

  const allRequiredChecked =
    acknowledgements.healthshare &&
    acknowledgements.guidelines &&
    acknowledgements.sharingLimitations;

  const handleNext = async () => {
    if (!allRequiredChecked) {
      setError('All required acknowledgements must be accepted');
      return;
    }

    if (!enrollmentId) {
      setError('Enrollment not initialized');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await completeComplianceStep({
        enrollmentId,
        healthshareAcknowledgement: acknowledgements.healthshare,
        guidelinesAcknowledgement: acknowledgements.guidelines,
        sharingLimitationsAcknowledgement: acknowledgements.sharingLimitations,
        telehealthConsent: acknowledgements.telehealth,
        electronicCommunicationsConsent: acknowledgements.electronicCommunications,
      });

      if (!result.success) {
        setError(result.error || 'Failed to complete compliance step');
        return;
      }

      updateSnapshot('compliance', {
        healthshareAcknowledgement: acknowledgements.healthshare,
        guidelinesAcknowledgement: acknowledgements.guidelines,
        sharingLimitationsAcknowledgement: acknowledgements.sharingLimitations,
        telehealthConsent: acknowledgements.telehealth,
        electronicCommunicationsConsent: acknowledgements.electronicCommunications,
      });

      markStepComplete('compliance');
      nextStep();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Warning Banners */}
      {(hasMandateWarning || hasAge65Warning) && (
        <div className="space-y-3">
          {hasMandateWarning && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">State Mandate Notice</p>
                <p className="text-sm text-amber-700 mt-1">
                  Your state may have individual coverage mandates or penalties for not maintaining 
                  qualified health coverage. Healthshare ministries are not insurance and may not 
                  satisfy these requirements. You are responsible for understanding and complying 
                  with your state&apos;s healthcare laws.
                </p>
              </div>
            </div>
          )}
          {hasAge65Warning && (
            <div className="flex items-start gap-3 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <UserPlus className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-orange-800">Medicare Eligibility Notice</p>
                <p className="text-sm text-orange-700 mt-1">
                  If you are eligible for Medicare or other government programs, please consult 
                  with a licensed advisor before cancelling any existing coverage. Healthshare 
                  plans are not a substitute for Medicare and may not cover all your healthcare needs.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Required Acknowledgements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-slate-400" />
            Required Acknowledgements
          </CardTitle>
          <CardDescription>
            Please read and accept each statement to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-lg border border-slate-200 bg-slate-50">
              <Checkbox
                id="healthshare"
                checked={acknowledgements.healthshare}
                onCheckedChange={(checked) =>
                  setAcknowledgements({ ...acknowledgements, healthshare: checked === true })
                }
                className="mt-0.5"
              />
              <div className="flex-1">
                <Label htmlFor="healthshare" className="font-medium text-slate-900 cursor-pointer">
                  Healthshare Understanding *
                </Label>
                <p className="text-sm text-slate-600 mt-1">
                  I understand that this is a <strong>healthshare membership</strong>, not insurance. 
                  Healthshare ministries operate on a voluntary sharing model where members share 
                  each other&apos;s medical expenses according to the program guidelines.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-lg border border-slate-200 bg-slate-50">
              <Checkbox
                id="guidelines"
                checked={acknowledgements.guidelines}
                onCheckedChange={(checked) =>
                  setAcknowledgements({ ...acknowledgements, guidelines: checked === true })
                }
                className="mt-0.5"
              />
              <div className="flex-1">
                <Label htmlFor="guidelines" className="font-medium text-slate-900 cursor-pointer">
                  Membership Guidelines *
                </Label>
                <p className="text-sm text-slate-600 mt-1">
                  I have reviewed and understand the <strong>membership guidelines</strong> and 
                  limitations. I understand which medical expenses are eligible for sharing and 
                  which are not covered by the program.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-lg border border-slate-200 bg-slate-50">
              <Checkbox
                id="sharingLimitations"
                checked={acknowledgements.sharingLimitations}
                onCheckedChange={(checked) =>
                  setAcknowledgements({ ...acknowledgements, sharingLimitations: checked === true })
                }
                className="mt-0.5"
              />
              <div className="flex-1">
                <Label htmlFor="sharingLimitations" className="font-medium text-slate-900 cursor-pointer">
                  Sharing Limitations *
                </Label>
                <p className="text-sm text-slate-600 mt-1">
                  I understand that <strong>sharing is not guaranteed</strong> and is subject to 
                  the program guidelines. Pre-existing conditions may have waiting periods, and 
                  certain expenses may not be eligible for sharing.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Optional Consents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileCheck className="w-4 h-4 text-slate-400" />
            Additional Consents (Optional)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="telehealth"
              checked={acknowledgements.telehealth}
              onCheckedChange={(checked) =>
                setAcknowledgements({ ...acknowledgements, telehealth: checked === true })
              }
            />
            <div className="flex-1">
              <Label htmlFor="telehealth" className="text-sm font-medium text-slate-900 cursor-pointer">
                Telehealth / Virtual Care Consent
              </Label>
              <p className="text-sm text-slate-500 mt-0.5">
                I consent to receive telehealth and virtual care services as part of my membership.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="electronicCommunications"
              checked={acknowledgements.electronicCommunications}
              onCheckedChange={(checked) =>
                setAcknowledgements({ ...acknowledgements, electronicCommunications: checked === true })
              }
            />
            <div className="flex-1">
              <Label htmlFor="electronicCommunications" className="text-sm font-medium text-slate-900 cursor-pointer">
                Electronic Communications Consent
              </Label>
              <p className="text-sm text-slate-500 mt-0.5">
                I consent to receive electronic communications including emails, text messages, 
                and notifications regarding my membership.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress Indicator */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-slate-500">Required acknowledgements</span>
                <span className="font-medium">
                  {[acknowledgements.healthshare, acknowledgements.guidelines, acknowledgements.sharingLimitations].filter(Boolean).length} / 3
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{
                    width: `${([acknowledgements.healthshare, acknowledgements.guidelines, acknowledgements.sharingLimitations].filter(Boolean).length / 3) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <WizardNavigation
        onNext={handleNext}
        isNextDisabled={!allRequiredChecked}
      />
    </div>
  );
}

