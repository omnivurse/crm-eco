import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Page not found | Double Helix Hub',
};

/**
 * Root 404 for URLs that do not match any route. Without this file, Next.js
 * serves the stock gray "404 This page could not be found." shell.
 */
export default function NotFound() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 px-6 py-16 text-center bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
      <p className="text-sm font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">
        404
      </p>
      <h1 className="text-2xl font-bold max-w-md">This page could not be found</h1>
      <p className="text-slate-600 dark:text-slate-400 max-w-md text-sm leading-relaxed">
        The link may be wrong, the page may have moved, or you may be on a preview URL that does
        not exist in this deployment.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <Link
          href="/crm"
          className="inline-flex items-center justify-center rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 transition-colors"
        >
          CRM dashboard
        </Link>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
        >
          Home
        </Link>
        <Link
          href="/crm-login"
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
