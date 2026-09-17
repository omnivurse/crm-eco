'use client';

import { ArrowRight, CircleNotch } from '@phosphor-icons/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SelfServeEnrollmentWizard } from '@crm-eco/enrollment';
import type {
  WizardPlan,
  PrefillData,
  EnrollmentActions,
  IntakeData,
  HouseholdMember,
  PlanSelectionData,
  ComplianceData,
  PaymentData,
  EnrollmentLegalDocument,
  EnrollmentLocale,
} from '@crm-eco/enrollment';
import { detectEnrollmentLocale, enrollmentCopy } from '@crm-eco/enrollment';
import { Button, Input, Label, Card, CardContent } from '@crm-eco/ui';
import { getRecaptchaToken } from '@/lib/recaptcha-client';

interface Props {
  plans: WizardPlan[];
  slug: string;
  locale?: EnrollmentLocale;
  documents?: EnrollmentLegalDocument[];
  landingDocumentIds?: string[];
}

export function PublicSlugEnrollmentWizard({
  plans,
  slug,
  locale: storedLocale = 'en',
  documents = [],
  landingDocumentIds = [],
}: Props) {
  const [started, setStarted] = useState(false);
  const [skipPayment, setSkipPayment] = useState(false);
  const [locale, setLocale] = useState<EnrollmentLocale>(storedLocale);
  const [member, setMember] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
  });
  const memberRef = useRef(member);
  useEffect(() => {
    memberRef.current = member;
  }, [member]);

  useEffect(() => {
    const detected = detectEnrollmentLocale({
      stored: storedLocale,
      navigatorLanguage: typeof navigator !== 'undefined' ? navigator.language : null,
    });
    setLocale(detected);
    document.documentElement.lang = detected;
  }, [storedLocale]);

  const draftRef = useRef<{
    intake?: IntakeData;
    household?: HouseholdMember[];
    plan?: PlanSelectionData;
    compliance?: ComplianceData;
  }>({});

  const actions: EnrollmentActions = useMemo(() => {
    async function patchDraft(data: Record<string, unknown>): Promise<boolean> {
      const res = await fetch('/api/enroll/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, data: { ...data, locale } }),
      });
      return res.ok;
    }

    return {
      createEnrollment: async () => {
        const ok = await patchDraft({ member: memberRef.current, locale });
        if (!ok) return { success: false, error: 'Failed to start enrollment' };
        return { success: true, data: { enrollmentId: `anon-${slug}` } };
      },
      completeIntakeStep: async (_id, data) => {
        draftRef.current.intake = data;
        memberRef.current = {
          first_name: data.first_name || memberRef.current.first_name,
          last_name: data.last_name || memberRef.current.last_name,
          email: data.email || memberRef.current.email,
          phone: data.phone_cell || data.phone || data.phone_home || memberRef.current.phone,
          date_of_birth: data.date_of_birth || memberRef.current.date_of_birth,
        };
        setMember(memberRef.current);
        const ok = await patchDraft({ intake: data, member: memberRef.current });
        try {
          const matchRes = await fetch('/api/enroll/sponsor-match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              slug,
              firstName: memberRef.current.first_name,
              lastName: memberRef.current.last_name,
              dateOfBirth: memberRef.current.date_of_birth,
            }),
          });
          const match = await matchRes.json();
          setSkipPayment(match.sponsorPaid === true);
        } catch {
          setSkipPayment(false);
        }
        return ok ? { success: true } : { success: false, error: 'Failed to save' };
      },
      completeHouseholdStep: async (_id, members) => {
        draftRef.current.household = members;
        const ok = await patchDraft({ household: members });
        return ok ? { success: true } : { success: false, error: 'Failed to save' };
      },
      completePlanSelectionStep: async (_id, data) => {
        draftRef.current.plan = data;
        const ok = await patchDraft({ plan_selection: data });
        return ok ? { success: true } : { success: false, error: 'Failed to save' };
      },
      completeComplianceStep: async (_id, data) => {
        draftRef.current.compliance = data;
        const ok = await patchDraft({ compliance: data });
        return ok ? { success: true } : { success: false, error: 'Failed to save' };
      },
      completePaymentStep: async (_id, data: PaymentData) => {
        const ok = await patchDraft({ payment: data });
        return ok ? { success: true } : { success: false, error: 'Failed to save' };
      },
      submitEnrollment: async () => {
        const m = memberRef.current;
        const { intake, household, plan, compliance } = draftRef.current;
        const recaptchaToken = await getRecaptchaToken('enrollment_submit');
        const res = await fetch('/api/enroll/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recaptchaToken,
            locale,
            member: {
              first_name: intake?.first_name || m.first_name,
              last_name: intake?.last_name || m.last_name,
              email: intake?.email || m.email,
              phone: intake?.phone_cell || intake?.phone || m.phone || undefined,
              phone_cell: intake?.phone_cell,
              phone_home: intake?.phone_home,
              phone_work: intake?.phone_work,
              date_of_birth: intake?.date_of_birth || m.date_of_birth || undefined,
              address_line1: intake?.address_line1,
              address_line2: intake?.address_line2,
              city: intake?.city,
              state: intake?.state,
              zip_code: intake?.zip_code,
              preferred_contact: intake?.preferred_contact,
              may_contact_email: intake?.may_contact_email,
              leave_message_home: intake?.leave_message_home,
              leave_message_work: intake?.leave_message_work,
              leave_message_cell: intake?.leave_message_cell,
              relationship_status: intake?.relationship_status,
              referral_source: intake?.referral_source,
              emergency_contact: intake?.emergency_contact,
            },
            selected_plan_id: plan?.selected_plan_id,
            effective_date: plan?.requested_effective_date,
            household: (household ?? []).map((h) => ({
              first_name: h.first_name,
              last_name: h.last_name,
              date_of_birth: h.date_of_birth,
              relationship: h.relationship,
              lives_at_home: h.lives_at_home,
            })),
            acknowledgments: {
              not_insurance: !!compliance?.acknowledged_not_insurance,
              sharing_guidelines: !!compliance?.acknowledged_sharing_guidelines,
              pre_existing_conditions: !!compliance?.acknowledged_pre_existing_conditions,
            },
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          return { success: false, error: body.error || 'Failed to submit enrollment' };
        }
        return { success: true, data: {} };
      },
      runRxPricing: async () => ({
        success: false,
        error: 'Rx pricing is available after you create an account.',
      }),
    };
  }, [slug, locale]);

  const prefill: PrefillData = {
    first_name: member.first_name,
    last_name: member.last_name,
    email: member.email,
    phone: member.phone,
    date_of_birth: member.date_of_birth,
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    zip_code: '',
  };

  if (!started) {
    return (
      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-2 text-2xl font-bold text-slate-900">{enrollmentCopy(locale, 'leadTitle')}</h2>
          <p className="mb-6 text-slate-600">{enrollmentCopy(locale, 'leadSubtitle')}</p>
          <LeadGate
            member={member}
            slug={slug}
            locale={locale}
            onChange={setMember}
            onStarted={() => setStarted(true)}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <SelfServeEnrollmentWizard
      plans={plans}
      prefillData={prefill}
      isAuthenticated={false}
      actions={actions}
      afterSubmitUrl={`/enroll/${slug}/done`}
      afterSubmitLabel="Enrollment submitted"
      skipPayment={skipPayment}
      locale={locale}
      documents={documents}
      landingDocumentIds={landingDocumentIds}
    />
  );
}

function LeadGate({
  member,
  slug,
  locale,
  onChange,
  onStarted,
}: {
  member: { first_name: string; last_name: string; email: string; phone: string; date_of_birth: string };
  slug: string;
  locale: EnrollmentLocale;
  onChange: (m: typeof member) => void;
  onStarted: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/enroll/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, data: { member, locale } }),
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="first_name">{enrollmentCopy(locale, 'firstName')} *</Label>
          <Input id="first_name" required value={member.first_name} onChange={(e) => onChange({ ...member, first_name: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="last_name">{enrollmentCopy(locale, 'lastName')} *</Label>
          <Input id="last_name" required value={member.last_name} onChange={(e) => onChange({ ...member, last_name: e.target.value })} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">{enrollmentCopy(locale, 'email')} *</Label>
        <Input id="email" type="email" required value={member.email} onChange={(e) => onChange({ ...member, email: e.target.value })} />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">{enrollmentCopy(locale, 'phone')}</Label>
          <Input id="phone" type="tel" value={member.phone} onChange={(e) => onChange({ ...member, phone: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="date_of_birth">{enrollmentCopy(locale, 'dob')}</Label>
          <Input id="date_of_birth" type="date" value={member.date_of_birth} onChange={(e) => onChange({ ...member, date_of_birth: e.target.value })} />
        </div>
      </div>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className="flex justify-end">
        <Button type="submit" disabled={submitting} className="gap-2">
          {submitting ? <CircleNotch className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          {enrollmentCopy(locale, 'continue')}
        </Button>
      </div>
    </form>
  );
}
