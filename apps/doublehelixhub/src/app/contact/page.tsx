import type { Metadata } from 'next';
import { LeadForm } from '@/components/lead-form';

export const metadata: Metadata = {
  title: 'Contact | Double Helix Software',
  description: 'Get in touch with the Double Helix team. We respond within one business day.',
};

export default function ContactPage() {
  return (
    <main className="container-page py-20">
      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Contact</p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Tell us about your operation.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Whether you&rsquo;re evaluating, comparing, or ready to migrate — drop a note and
            we&rsquo;ll get back within one business day.
          </p>
          <div className="mt-10 space-y-6 text-sm text-foreground/80">
            <div>
              <h3 className="font-semibold text-foreground">For partners & licensees</h3>
              <p className="mt-1 text-muted-foreground">
                We&rsquo;re selectively onboarding agencies and TPAs in waves. Tell us about your
                book — we&rsquo;ll tell you whether we&rsquo;re a fit.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground">For members</h3>
              <p className="mt-1 text-muted-foreground">
                If you&rsquo;re an enrolled member of an agency that uses Double Helix, please
                reach out to your agency directly — we don&rsquo;t handle individual member support.
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <LeadForm />
        </div>
      </div>
    </main>
  );
}
