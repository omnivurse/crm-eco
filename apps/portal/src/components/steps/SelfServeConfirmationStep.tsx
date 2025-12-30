'use client';

import { Button, Card, CardContent, Badge } from '@crm-eco/ui';
import { 
  Loader2, 
  Check, 
  Heart, 
  User, 
  Users, 
  CreditCard, 
  FileText, 
  Calendar,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import type { WizardSnapshot, WizardPlan } from '../SelfServeEnrollmentWizard';
import { format } from 'date-fns';

interface SelfServeConfirmationStepProps {
  snapshot: WizardSnapshot;
  selectedPlan?: WizardPlan;
  submitted: boolean;
  onSubmit: () => void;
  loading: boolean;
}

export function SelfServeConfirmationStep({
  snapshot,
  selectedPlan,
  submitted,
  onSubmit,
  loading,
}: SelfServeConfirmationStepProps) {
  if (submitted) {
    return (
      <div className="text-center py-8">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        
        <h2 className="text-2xl font-bold text-slate-900 mb-4">
          Enrollment Submitted!
        </h2>
        
        <p className="text-slate-600 mb-8 max-w-md mx-auto">
          Thank you for enrolling in WealthShare. Your application has been submitted 
          and is now being reviewed by our team.
        </p>

        <Card className="bg-blue-50 border-blue-200 max-w-md mx-auto">
          <CardContent className="pt-6">
            <h4 className="font-medium text-blue-900 mb-2">What happens next?</h4>
            <ol className="text-sm text-blue-800 text-left space-y-2">
              <li className="flex gap-2">
                <span className="font-medium">1.</span>
                Our team will review your enrollment within 1-2 business days
              </li>
              <li className="flex gap-2">
                <span className="font-medium">2.</span>
                You&apos;ll receive an email with next steps and payment setup instructions
              </li>
              <li className="flex gap-2">
                <span className="font-medium">3.</span>
                Once approved, your membership will start on your requested effective date
              </li>
            </ol>
          </CardContent>
        </Card>

        <div className="mt-8">
          <Link href="/">
            <Button className="gap-2">
              Return to Dashboard
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const householdCount = snapshot.household?.members?.length || 0;

  return (
    <div className="space-y-6">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <p className="text-sm text-green-800">
          <strong>Almost done!</strong> Please review your enrollment details below. 
          Once you submit, our team will review your application.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4">
        {/* Contact Info */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-slate-900">Contact Information</h4>
                <div className="mt-2 text-sm text-slate-600 space-y-1">
                  <p>{snapshot.intake?.email}</p>
                  {snapshot.intake?.phone && <p>{snapshot.intake.phone}</p>}
                  <p>
                    {snapshot.intake?.address_line1}
                    {snapshot.intake?.address_line2 && `, ${snapshot.intake.address_line2}`}
                  </p>
                  <p>
                    {snapshot.intake?.city}, {snapshot.intake?.state} {snapshot.intake?.zip_code}
                  </p>
                </div>
              </div>
              <Check className="w-5 h-5 text-green-600" />
            </div>
          </CardContent>
        </Card>

        {/* Household */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-slate-900">Household Members</h4>
                <div className="mt-2 text-sm text-slate-600">
                  {householdCount === 0 ? (
                    <p>Individual enrollment (no dependents)</p>
                  ) : (
                    <div className="space-y-1">
                      {snapshot.household?.members?.map((member, idx) => (
                        <p key={idx}>
                          {member.first_name} {member.last_name} ({member.relationship})
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <Check className="w-5 h-5 text-green-600" />
            </div>
          </CardContent>
        </Card>

        {/* Plan */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Heart className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-slate-900">Selected Plan</h4>
                <div className="mt-2 text-sm text-slate-600 space-y-1">
                  {selectedPlan ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{selectedPlan.name}</span>
                        <Badge variant="secondary">{selectedPlan.code}</Badge>
                      </div>
                      <p className="text-lg font-semibold text-slate-900">
                        ${selectedPlan.monthly_share}/month
                      </p>
                    </>
                  ) : (
                    <p>Plan selected</p>
                  )}
                  {snapshot.plan_selection?.requested_effective_date && (
                    <p className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Effective: {format(
                        new Date(snapshot.plan_selection.requested_effective_date),
                        'MMMM d, yyyy'
                      )}
                    </p>
                  )}
                </div>
              </div>
              <Check className="w-5 h-5 text-green-600" />
            </div>
          </CardContent>
        </Card>

        {/* Compliance */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-slate-900">Acknowledgments</h4>
                <div className="mt-2 text-sm text-slate-600 space-y-1">
                  <p>All required acknowledgments signed</p>
                  <p className="font-medium">
                    Signature: {snapshot.compliance?.electronic_signature}
                  </p>
                </div>
              </div>
              <Check className="w-5 h-5 text-green-600" />
            </div>
          </CardContent>
        </Card>

        {/* Payment */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-slate-900">Payment Setup</h4>
                <div className="mt-2 text-sm text-slate-600 space-y-1">
                  <p>
                    Method: {snapshot.payment?.payment_method === 'bank_draft' 
                      ? 'Bank Draft (ACH)' 
                      : 'Credit/Debit Card'}
                  </p>
                  <p>Billing day: {snapshot.payment?.billing_day}st of each month</p>
                </div>
              </div>
              <Check className="w-5 h-5 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Final Note */}
      <Card className="bg-slate-50">
        <CardContent className="pt-6">
          <p className="text-sm text-slate-600">
            By clicking &quot;Submit Enrollment&quot;, you confirm that all information provided 
            is accurate and complete. You agree to the terms and conditions of the 
            WealthShare healthshare program. Your application will be reviewed and you 
            will be notified of approval within 1-2 business days.
          </p>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-center pt-4">
        <Button 
          onClick={onSubmit} 
          disabled={loading} 
          size="lg"
          className="gap-2 px-8"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Submit Enrollment
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

