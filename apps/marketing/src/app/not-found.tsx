import { Button } from '@/components/primitives/Button';

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-helix-fog">
          DH/ERR · 404
        </p>
        <h1 className="display-2 mt-4">Off the helix.</h1>
        <p className="mt-3 text-sm text-helix-mist">
          The page you&apos;re looking for either moved, retired, or never existed.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button href="/" variant="primary">
            Back to home
          </Button>
          <Button href="/contact" variant="ghost">
            Contact us
          </Button>
        </div>
      </div>
    </div>
  );
}
