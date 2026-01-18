'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Label, Checkbox } from '@crm-eco/ui';
import { Shield, AlertTriangle, UserPlus, FileCheck, Info } from 'lucide-react';
import { useEnrollmentWizard, WizardNavigation } from '../wizard';
import { completeComplianceStep } from '@/app/crm/enrollment/actions';

// Mode-aware copy variants
const COPY_VARIANTS = {
  advisor_assisted: {
    pageTitle: 'Required Acknowledgements',
    pageDescription: 'Please read and accept each statement to continue',
    healthshareTitle: 'Healthshare Understanding *',
    healthshareText: (
      <>
        I understand that this is a <strong>healthshare membership</strong>, not insurance. 
        Healthshare ministries operate on a voluntary sharing model where members share 
        each other&apos;s medical expenses according to the program guidelines.
      </>
    ),
    guidelinesTitle: 'Membership Guidelines *',
    guidelinesText: (
      <>
        I have reviewed and understand the <strong>membership guidelines</strong> and 
        limitations. I understand which medical expenses are eligible for sharing and 
        which are not covered by the program.
      </>
    ),
    sharingTitle: 'Sharing Limitations *',
    sharingText: (
      <>
        I understand that <strong>sharing is not guaranteed</strong> and is subject to 
        the program guidelines. Pre-existing conditions may have waiting periods, and 
        certain expenses may not be eligible for sharing.
      </>
    ),
    mandateWarning: (
      <>
        Your state may have individual coverage mandates or penalties for not maintaining 
        qualified health coverage. Healthshare ministries are not insurance and may not 
        satisfy these requirements. You are responsible for understanding and complying 
        with your state&apos;s healthcare laws.
      </>
    ),
    age65Warning: (
      <>
        If you are eligible for Medicare or other government programs, please consult 
        with a licensed advisor before cancelling any existing coverage. Healthshare 
        plans are not a substitute for Medicare and may not cover all your healthcare needs.
      </>
    ),
  },
  member_self_serve: {
    pageTitle: 'Important Information About Your Membership',
    pageDescription: 'Please read each statement carefully and confirm your understanding',
    healthshareTitle: 'This is NOT Insurance *',
    healthshareText: (
      <>
        <strong className="text-amber-700">Important:</strong> This is a <strong>healthshare membership</strong>, 
        which is different from health insurance. Members voluntarily share each other&apos;s 
        medical expenses based on program guidelines. There is no guarantee that your medical 
        bills will be paid. Please make sure you understand this before continuing.
      </>
    ),
    guidelinesTitle: 'I Have Read the Guidelines *',
    guidelinesText: (
      <>
        I confirm that I have <strong>read and understand the membership guidelines</strong>. 
        I know which medical expenses can be shared and which cannot. I understand that some 
        treatments and conditions may not be eligible for sharing.
      </>
    ),
    sharingTitle: 'Sharing is Voluntary *',
    sharingText: (
      <>
        <strong className="text-amber-700">Please note:</strong> Medical bill sharing is 
        <strong> not guaranteed</strong>. Pre-existing conditions may have waiting periods 
        of up to 3 years. Some expenses may never be eligible. You should maintain adequate 
        savings or alternative coverage for unexpected medical costs.
      </>
    ),
    mandateWarning: (
      <>
        <strong>Your state may require you to have health insurance.</strong> Healthshare 
        memberships are <strong>not health insurance</strong> and may not satisfy your 
        state&apos;s requirements. You could face tax penalties or other consequences. 
        Please research your state&apos;s healthcare laws before continuing.
      </>
    ),
    age65Warning: (
      <>
        <strong>You may be eligible for Medicare.</strong> If you are 65 or older, you 
        should carefully consider Medicare enrollment before joining a healthshare. 
        Healthshare programs do <strong>not</strong> replace Medicare and may leave 
        significant gaps in your coverage. We strongly recommend speaking with a 
        Medicare counselor first.
      </>
    ),
  },
  internal_ops: {
    pageTitle: 'Compliance Acknowledgements',
    pageDescription: 'Record member acknowledgements',
    healthshareTitle: 'Healthshare Understanding *',
    healthshareText: (
      <>
        Member understands this is a healthshare membership, not insurance, operating 
        on a voluntary sharing model.
      </>
    ),
    guidelinesTitle: 'Guidelines Acknowledgement *',
    guidelinesText: (
      <>
        Member has reviewed and understands the membership guidelines and limitations.
      </>
    ),
    sharingTitle: 'Sharing Limitations *',
    sharingText: (
      <>
        Member understands sharing is not guaranteed and subject to program guidelines.
      </>
    ),
    mandateWarning: (
      <>
        Member is in a mandate state. Ensure they understand healthshare may not 
        satisfy state requirements.
      </>
    ),
    age65Warning: (
      <>
        Member is 65+. Verify Medicare eligibility has been discussed.
      </>
    ),
  },
};

export function ComplianceStep() {
  const {
    enrollmentId,
    snapshot,
    enrollmentMode,
    hasMandateWarning,
    hasAge65Warning,
    setIsLoading,
    setError,
    markStepComplete,
    nextStep,
    updateSnapshot,
  } = useEnrollmentWizard();

  // Get copy for current mode
  const copy = COPY_VARIANTS[enrollmentMode] || COPY_VARIANTS.advisor_assisted;
  const isSelfServe = enrollmentMode === 'member_self_serve';

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
      {/* Self-serve mode intro banner */}
      {isSelfServe && (
        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-blue-800">Please Read Carefully</p>
            <p className="text-sm text-blue-700 mt-1">
              These acknowledgements are important. Take your time to read and understand each one 
              before checking the box. If you have questions, please contact us before continuing.
            </p>
          </div>
        </div>
      )}

      {/* Warning Banners */}
      {(hasMandateWarning || hasAge65Warning) && (
        <div className="space-y-3">
          {hasMandateWarning && (
            <div className={`flex items-start gap-3 p-4 rounded-lg border ${
              isSelfServe 
                ? 'bg-red-50 border-red-300' 
                : 'bg-amber-50 border-amber-200'
            }`}>
              <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                isSelfServe ? 'text-red-600' : 'text-amber-600'
              }`} />
              <div>
                <p className={`font-medium ${isSelfServe ? 'text-red-800' : 'text-amber-800'}`}>
                  {isSelfServe ? 'Important: State Insurance Requirements' : 'State Mandate Notice'}
                </p>
                <p className={`text-sm mt-1 ${isSelfServe ? 'text-red-700' : 'text-amber-700'}`}>
                  {copy.mandateWarning}
                </p>
              </div>
            </div>
          )}
          {hasAge65Warning && (
            <div className={`flex items-start gap-3 p-4 rounded-lg border ${
              isSelfServe 
                ? 'bg-red-50 border-red-300' 
                : 'bg-orange-50 border-orange-200'
            }`}>
              <UserPlus className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                isSelfServe ? 'text-red-600' : 'text-orange-600'
              }`} />
              <div>
                <p className={`font-medium ${isSelfServe ? 'text-red-800' : 'text-orange-800'}`}>
                  {isSelfServe ? 'Important: Medicare Eligibility' : 'Medicare Eligibility Notice'}
                </p>
                <p className={`text-sm mt-1 ${isSelfServe ? 'text-red-700' : 'text-orange-700'}`}>
                  {copy.age65Warning}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Required Acknowledgements */}
      <Card className={isSelfServe ? 'border-amber-200' : undefined}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className={`w-5 h-5 ${isSelfServe ? 'text-amber-500' : 'text-slate-400'}`} />
            {copy.pageTitle}
          </CardTitle>
          <CardDescription>
            {copy.pageDescription}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className={`flex items-start gap-3 p-4 rounded-lg border ${
              isSelfServe && !acknowledgements.healthshare
                ? 'border-amber-300 bg-amber-50'
                : 'border-slate-200 bg-slate-50'
            }`}>
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
                  {copy.healthshareTitle}
                </Label>
                <p className="text-sm text-slate-600 mt-1">
                  {copy.healthshareText}
                </p>
              </div>
            </div>

            <div className={`flex items-start gap-3 p-4 rounded-lg border ${
              isSelfServe && !acknowledgements.guidelines
                ? 'border-amber-300 bg-amber-50'
                : 'border-slate-200 bg-slate-50'
            }`}>
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
                  {copy.guidelinesTitle}
                </Label>
                <p className="text-sm text-slate-600 mt-1">
                  {copy.guidelinesText}
                </p>
              </div>
            </div>

            <div className={`flex items-start gap-3 p-4 rounded-lg border ${
              isSelfServe && !acknowledgements.sharingLimitations
                ? 'border-amber-300 bg-amber-50'
                : 'border-slate-200 bg-slate-50'
            }`}>
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
                  {copy.sharingTitle}
                </Label>
                <p className="text-sm text-slate-600 mt-1">
                  {copy.sharingText}
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

