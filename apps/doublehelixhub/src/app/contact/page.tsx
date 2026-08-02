import type { Metadata } from 'next';
import { LeadForm } from '@/components/lead-form';

export const metadata: Metadata = {
  title: 'Contact | Double Helix Software',
  description: 'Get in touch with the Double Helix team. We respond within one business day.',
};

export default function ContactPage() {
  return (
    <main className="container-page py-20 md:py-28">
      <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <span className="dh-eyebrow">Contact</span>
          <h1 className="mt-5 font-heading text-[clamp(2.25rem,5vw,3.5rem)] font-bold tracking-[-0.04em] text-foreground">
            Tell us about your operation.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
            Whether you&rsquo;re evaluating, comparing, or ready to migrate — drop a note and
            we&rsquo;ll get back within one business day.
          </p>
          <div className="mt-10 space-y-4">
            <div className="dh-bezel">
              <div className="dh-bezel-inner p-6">
                <h3 className="font-heading text-sm font-semibold text-foreground">For partners & licensees</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  We&rsquo;re selectively onboarding agencies and TPAs in waves. Tell us about your
                  book — we&rsquo;ll tell you whether we&rsquo;re a fit.
                </p>
              </div>
            </div>
            <div className="dh-bezel">
              <div className="dh-bezel-inner p-6">
                <h3 className="font-heading text-sm font-semibold text-foreground">For members</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  If you&rsquo;re an enrolled member of an agency that uses Double Helix, please
                  reach out to your agency directly — we don&rsquo;t handle individual member support.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="dh-bezel">
          <div className="dh-bezel-inner p-7 sm:p-8">
            <LeadForm />
          </div>
        </div>
      </div>
    </main>
  );
}
