import { CircleNotch } from '@phosphor-icons/react/dist/ssr';

/**
 * Shared route-level loading fallback. Rendered by Next.js Suspense boundaries
 * (loading.tsx) while a server component fetches data, so navigations show a
 * clear pending state instead of a frozen page.
 */
export function PageLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      className="flex h-64 flex-col items-center justify-center gap-3"
      role="status"
      aria-live="polite"
    >
      <CircleNotch
        weight="light"
        className="h-8 w-8 animate-spin text-[var(--mp-teal)]"
        aria-hidden
      />
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}
