import { Loader2 } from 'lucide-react';

/**
 * Shared route-level loading fallback. Rendered by Next.js Suspense boundaries
 * (loading.tsx) while a server component fetches data, so navigations show a
 * clear pending state instead of a frozen page.
 */
export function PageLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3" role="status" aria-live="polite">
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}
