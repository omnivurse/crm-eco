'use client';

/**
 * CallLink — THE click-to-call primitive (TE-8).
 *
 * A real `<a href="tel:…">` for every Call affordance — list rows, cards, the
 * record header, the mobile action bar, the dashboard desk and the `c` hotkey
 * all reuse it, so the OS dialer, long-press, middle-click and the walk
 * harness's `a[href^="tel:"]` assertion all see the same thing. Click
 * propagation is stopped by default so a Call inside a clickable row never
 * opens the record; pass your own `onClick` to run alongside (called after
 * the stop). Client module: it carries an event handler, and the desk
 * primitives that render it are server components.
 */

import { forwardRef, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react';
import { telHref } from '@/components/dashboard/command-desk/command-desk-format';

export interface CallLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'children'> {
  /** Raw phone as stored; formatted into a `tel:` href via telHref. */
  phone: string | null | undefined;
  /** Visible content — icon, number, or "Call" label. */
  children?: ReactNode;
  /** Render `fallback` (default null) when the phone does not look dialable. */
  fallback?: ReactNode;
}

export const CallLink = forwardRef<HTMLAnchorElement, CallLinkProps>(function CallLink(
  { phone, children, fallback = null, onClick, ...rest },
  ref,
) {
  const href = telHref(phone);
  if (!href) return <>{fallback}</>;
  return (
    <a
      ref={ref}
      href={href}
      data-call-link=""
      {...rest}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        e.stopPropagation();
        onClick?.(e);
      }}
    >
      {children}
    </a>
  );
});
