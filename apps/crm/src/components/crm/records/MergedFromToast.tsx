'use client';

/**
 * Shown once at mount when the page was reached via a stale URL that
 * has since been merged into another record. The server-side redirect
 * in /crm/r/[recordId]/page.tsx appends `?merged_from=<old_id>` to
 * signal this; this component surfaces a subtle info toast and strips
 * the param from the URL so a refresh doesn't retrigger it.
 */

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { toastCopy } from '@/lib/crm/toast-copy';

interface Props {
  /** The keeper's title, for friendlier toast copy. */
  recordTitle?: string | null;
}

export function MergedFromToast({ recordTitle }: Props) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    const mergedFrom = searchParams.get('merged_from');
    const fromTwin = searchParams.get('from_twin');
    if (!mergedFrom && !fromTwin) return;
    firedRef.current = true;

    const copy = fromTwin
      ? toastCopy.openedContactTwin(recordTitle)
      : toastCopy.mergedInto(recordTitle);
    toast.info(copy.title, { description: copy.description, duration: 4500 });

    // Strip the marker so a refresh doesn't retrigger the toast.
    const next = new URLSearchParams(searchParams.toString());
    next.delete('merged_from');
    next.delete('from_twin');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [searchParams, pathname, router, recordTitle]);

  return null;
}
