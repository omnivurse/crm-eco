'use client';

import { ArrowRight, CircleNotch } from '@phosphor-icons/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SelfServeEnrollmentWizard } from '@crm-eco/enrollment';
import type {
  WizardPlan,
  WizardSnapshot,
  PrefillData,
  EnrollmentActions,
  IntakeData,
  HouseholdMember,
  PlanSelectionData,
  ComplianceData,
  PaymentData,
} from '@crm-eco/enrollment';
import { Button, Input, Label, Card, CardContent } from '@crm-eco/ui';
import { getRecaptchaToken } from '@/lib/recaptcha-client';

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://members.doublehelixhub.com';

interface PublicEnrollmentWizardProps {
  plans: WizardPlan[];
  /**
   * Landing-page slug. Present for the agent landing-page form (`/enroll/[slug]`),
   * omitted for the generic form (`/enroll`) where the draft route resolves the
   * tenant from the request host. The signed cookie carries the resolved org either
   * way — this client never sends an org.
   */
  slug?: string;
  prefillData?: PrefillData;
  existingSnapshot?: WizardSnapshot;
  completedSteps?: string[];
}

/**
 * PUBLIC (anonymous prospect — NO login) enrollment wizard for the admin
 * enrollment software, served on tenant-facing domains. The signed draft cookie
 * (set by /api/enroll/draft, verified server-side) is the prospect's identity /
 * ownership token. The final submit attaches a reCAPTCHA v3 token.
 *
 * The shared wizard's intake step collects email/phone/address but NOT the primary
 * member's name or DOB, so this gates the wizard behind a small lead-capture form
 * that starts the draft and supplies name/email/phone as prefill.
 */
export function PublicEnrollmentWizard({
  plans,
  slug,
  prefillData,
  existingSnapshot,
  completedSteps,
}: PublicEnrollmentWizardProps) {
  const [started, setStarted] = useState(false);
  const [member, setMember] = useState<PrimaryMember>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
  });

  // The primary member captured at the gate is the identity the submit route
  // dedupes on (org + email + name). Held in a ref so the submit closure always
  // reads the latest values without re-creating the adapter on each keystroke.
  const memberRef = useRef<PrimaryMember>(member);
  useEffect(() => {
    memberRef.current = member;
  }, [member]);

  // Mirror each step's data so the final /api/enroll/submit can assemble the full
  // member payload (the wizard only hands submitEnrollment() the enrollmentId).
  const draftRef = useRef<{
    intake?: IntakeData;
    household?: HouseholdMember[];
    plan?: PlanSelectionData;
    compliance?: ComplianceData;
  }>({});

  const actions: EnrollmentActions = useMemo(() => {
    /** Merge a partial draft into the signed cookie via /api/enroll/draft. */
    async function patchDraft(data: Record<string, unknown>): Promise<boolean> {
      const res = await fetch('/api/enroll/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // `slug` is omitted for the generic form; the route resolves org by host.
        body: JSON.stringify({ slug, data }),
      });
      return res.ok;
    }

    return {
      createEnrollment: async () => {
        const ok = await patchDraft({ member: memberRef.current });
        if (!ok) {
          return { success: false, error: 'Failed to start enrollment' };
        }
        return { success: true, data: { enrollmentId: `anon-${slug ?? 'generic'}` } };
      },

      completeIntakeStep: async (_enrollmentId: string, data: IntakeData) => {
        draftRef.current.intake = data;
        const ok = await patchDraft({ intake: data });
        return ok ? { success: true } : { success: false, error: 'Failed to save' };
      },

      completeHouseholdStep: async (_enrollmentId: string, members: HouseholdMember[]) => {
        draftRef.current.household = members;
        const ok = await patchDraft({ household: members });
        return ok ? { success: true } : { success: false, error: 'Failed to save' };
      },

      completePlanSelectionStep: async (_enrollmentId: string, data: PlanSelectionData) => {
        draftRef.current.plan = data;
        const ok = await patchDraft({ plan_selection: data });
        return ok ? { success: true } : { success: false, error: 'Failed to save' };
      },

      completeComplianceStep: async (_enrollmentId: string, data: ComplianceData) => {
        draftRef.current.compliance = data;
        const ok = await patchDraft({ compliance: data });
        return ok ? { success: true } : { success: false, error: 'Failed to save' };
      },

      completePaymentStep: async (_enrollmentId: string, data: PaymentData) => {
        const ok = await patchDraft({ payment: data });
        return ok ? { success: true } : { success: false, error: 'Failed to save' };
      },

      submitEnrollment: async () => {
        const m = memberRef.current;
        const { intake, household, plan, compliance } = draftRef.current;

        const recaptchaToken = await getRecaptchaToken('enrollment_submit');

        const acknowledgments: Record<string, boolean> = {
          not_insurance: !!compliance?.acknowledged_not_insurance,
          sharing_guidelines: !!compliance?.acknowledged_sharing_guidelines,
          pre_existing_conditions: !!compliance?.acknowledged_pre_existing_conditions,
        };

        const res = await fetch('/api/enroll/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recaptchaToken,
            member: {
              first_name: m.first_name,
              last_name: m.last_name,
              email: m.email,
              phone: m.phone || undefined,
              date_of_birth: m.date_of_birth || undefined,
              address_line1: intake?.address_line1,
              city: intake?.city,
              state: intake?.state,
              zip_code: intake?.zip_code,
            },
            selected_plan_id: plan?.selected_plan_id,
            effective_date: plan?.requested_effective_date,
            household: (household ?? []).map((h) => ({
              first_name: h.first_name,
              last_name: h.last_name,
              date_of_birth: h.date_of_birth,
              relationship: h.relationship,
            })),
            acknowledgments,
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          return { success: false, error: body.error || 'Failed to submit enrollment' };
        }
        return { success: true, data: {} };
      },

      // Rx pricing is an authenticated-only feature; the anon path renders the plan
      // step without it.
      runRxPricing: async () => ({
        success: false,
        error: 'Rx pricing is available after you create an account.',
      }),
    };
  }, [slug]);

  // The captured name/email/phone seed the shared intake step's prefill.
  const anonPrefill: PrefillData = {
    first_name: member.first_name,
    last_name: member.last_name,
    email: member.email,
    phone: member.phone,
    date_of_birth: member.date_of_birth,
    address_line1: prefillData?.address_line1 ?? '',
    address_line2: prefillData?.address_line2 ?? '',
    city: prefillData?.city ?? '',
    state: prefillData?.state ?? '',
    zip_code: prefillData?.zip_code ?? '',
  };

  if (!started) {
    return (
      <LeadCaptureGate
        slug={slug}
        member={member}
        onChange={setMember}
        onStarted={() => setStarted(true)}
      />
    );
  }

  return (
    <SelfServeEnrollmentWizard
      plans={plans}
      prefillData={anonPrefill}
      isAuthenticated={false}
      existingSnapshot={existingSnapshot}
      completedSteps={completedSteps}
      actions={actions}
      afterSubmitUrl={`${PORTAL_URL}/signin`}
      afterSubmitLabel="Sign In to Member Portal"
    />
  );
}

// ============================================================================
// Types + lead-capture gate
// ============================================================================

interface PrimaryMember {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
}

interface LeadCaptureGateProps {
  slug?: string;
  member: PrimaryMember;
  onChange: (m: PrimaryMember) => void;
  onStarted: () => void;
}

function LeadCaptureGate({ slug, member, onChange, onStarted }: LeadCaptureGateProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // Start the signed draft cookie. The cookie carries the org (resolved
      // server-side from the slug or host) and becomes this prospect's ownership
      // token for the rest of the flow.
      const res = await fetch('/api/enroll/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          data: {
            member: {
              first_name: member.first_name,
              last_name: member.last_name,
              email: member.email,
              phone: member.phone,
              date_of_birth: member.date_of_birth,
            },
          },
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to start enrollment');
      }

      onStarted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }

  const set = (field: keyof PrimaryMember, value: string) =>
    onChange({ ...member, [field]: value });

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Tell us about yourself</h2>
        <p className="text-slate-600 mb-6">
          Start your enrollment — no account needed. It only takes a few minutes.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name *</Label>
              <Input
                id="first_name"
                required
                value={member.first_name}
                onChange={(e) => set('first_name', e.target.value)}
                placeholder="John"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name *</Label>
              <Input
                id="last_name"
                required
                value={member.last_name}
                onChange={(e) => set('last_name', e.target.value)}
                placeholder="Doe"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              required
              value={member.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={member.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date_of_birth">Date of Birth</Label>
              <Input
                id="date_of_birth"
                type="date"
                value={member.date_of_birth}
                onChange={(e) => set('date_of_birth', e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={submitting} className="gap-2">
              {submitting ? (
                <>
                  <CircleNotch weight="light" className="w-4 h-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight weight="light" className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
