import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { Shield, Heart, Clock } from 'lucide-react';
import { resolveOrgByHost } from '@/lib/enroll-org';
import { PublicEnrollmentWizard } from './PublicEnrollmentWizard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Enroll Now',
  description: 'Start your enrollment. Complete our simple, secure process to join.',
};

/**
 * Generic public enrollment form (no landing-page slug). The tenant org is
 * resolved server-side from the request host (`organizations.domain`) — falling
 * back to the configured default org — and baked into the signed draft cookie by
 * /api/enroll/draft. Served on tenant-facing enrollment domains.
 */
export default async function GenericEnrollPage() {
  const host = (await headers()).get('host');
  const supabase = createServiceRoleClient();
  const organizationId = await resolveOrgByHost(supabase, host);

  // Active plans for the resolved tenant.
  const { data: plansData } = await (supabase as any)
    .from('plans')
    .select('id, name, code, monthly_share, description')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('monthly_share');

  const plans = plansData || [];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <section className="hub-cta-band text-white py-12" style={{ background: '#0d9488' }}>
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Enroll Now</h1>
          <p className="text-lg max-w-2xl mx-auto opacity-90">
            Complete the enrollment process below. It only takes a few minutes to join.
          </p>

          <div className="flex flex-wrap justify-center gap-6 mt-6">
            {[
              { icon: Clock, text: 'Takes ~5 minutes' },
              { icon: Shield, text: 'Secure & private' },
              { icon: Heart, text: 'No obligation' },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-2 text-sm opacity-80">
                <item.icon className="w-4 h-4" />
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Enrollment Wizard */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <PublicEnrollmentWizard plans={plans} />
        </div>
      </div>

      {/* Trust indicators */}
      <section className="bg-white border-t py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-8 text-sm text-slate-500">
            <span>256-bit SSL Encryption</span>
            <span>HIPAA Compliant</span>
            <span>No hidden fees</span>
            <span>Cancel anytime</span>
          </div>
        </div>
      </section>
    </div>
  );
}
