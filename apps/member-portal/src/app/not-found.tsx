import Link from 'next/link';
import { Compass, House } from '@phosphor-icons/react/dist/ssr';
import { Button } from '@crm-eco/ui/components/button';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(11,109,133,0.08)]">
          <Compass weight="light" className="h-8 w-8 text-[var(--mp-teal)]" />
        </div>
        <h2 className="mb-3 text-2xl font-bold tracking-[-0.03em] text-[var(--mp-ink)]">Page not found</h2>
        <p className="mb-6 text-slate-600">
          The page you&apos;re looking for doesn&apos;t exist or may have moved.
        </p>
        <Link href="/">
          <Button className="gap-2 rounded-full bg-[var(--mp-teal)] hover:bg-[var(--mp-teal-soft)]">
            <House weight="light" className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
