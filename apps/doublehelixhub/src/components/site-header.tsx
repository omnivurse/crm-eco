'use client';

/**
 * doublehelixhub site header.
 *
 * Same island the CRM and MMS landings ship — `.lp-nav-wrap` / `.lp-nav` /
 * `.lp-nav-links` / `.lp-nav-cta` / `.lp-theme-btn` out of the shared landing
 * stylesheet, which `app/globals.css` imports site-wide. It is NOT
 * `packages/ui`'s `<LandingNav>` — that hard-codes its own link set and CTA —
 * but it renders the same `<BrandLogo>` lockup, off the same `/logo.png`,
 * `/logo-white.png` and `/logo-icon.png` the two product apps ship (copied
 * into this app's public/). Everything else — the classes, the breakpoint, the
 * focus rings — is the shared vocabulary, so the corporate nav and the two
 * product navs are the same object.
 *
 * Two deliberate departures, both documented in chrome.module.css:
 *   - the brand is `<BrandLogo>`, the same lockup apps/crm and apps/admin
 *     render, rather than the old `/logo.svg` <img>. That SVG bakes its
 *     wordmark in as dark `<text>`, so dark mode needed a brightness/invert
 *     hack that flattened the helix gradient to white. The PNG set ships a
 *     real white variant, so both themes get the true mark.
 *   - the mobile menu stays a full-screen sheet (this site's existing
 *     interaction, with its body scroll lock) rather than the shared
 *     `.lp-nav-panel` dropdown
 *
 * Every link that was here before is still here, on the same href. "Sign in"
 * and "Access" were desktop-only; they are still hidden from the island below
 * 768px (there is no room at 390px) but they now also appear in the sheet, so
 * a phone can reach both.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowUpRight, CaretRight } from '@phosphor-icons/react';
import { ThemeToggle } from '@/components/theme-toggle';
import { BrandLogo } from '@crm-eco/ui/components/brand-logo';
import styles from '@/components/chrome.module.css';

const SIGN_IN_HREF = 'https://crm.doublehelixhub.com';
const ACCESS_HREF = '/#request-access';
const SHEET_ID = 'dh-mobile-menu';

type NavItem = {
  name: string;
  href: string;
  /** The two products carry their strand tone as wayfinding. */
  tone?: 'cyan' | 'emerald';
};

const NAV: readonly NavItem[] = [
  { name: 'CRM Core', href: '/products/crm', tone: 'cyan' },
  { name: 'Admin', href: '/products/admin', tone: 'emerald' },
  { name: 'Pricing', href: '/pricing' },
  { name: 'About', href: '/about' },
  { name: 'Contact', href: '/contact' },
];

/**
 * The breakpoint at which the sheet stops existing, read as an EXTERNAL store.
 *
 * This used to be an effect that called `window.matchMedia(...)` and then
 * `setMobileOpen(false)` — setState synchronously inside an effect body, which
 * is the cascading-render pattern `react-hooks/set-state-in-effect` rejects.
 * `useSyncExternalStore` is the sanctioned way to read a browser store: it
 * subscribes to the `change` event and re-renders from the media query itself,
 * with no React state to keep in sync.
 *
 * It matters for more than lint. Rotating a phone to landscape with the sheet
 * open takes the sheet away at >=769px, but the body scroll lock below is
 * keyed on the sheet being open — so without this the page stayed frozen.
 * `getServerSnapshot` returns false (mobile-first) so the server HTML and the
 * hydration render agree.
 */
const DESKTOP_QUERY = '(min-width: 769px)';

function subscribeDesktop(onStoreChange: () => void) {
  const mq = window.matchMedia(DESKTOP_QUERY);
  mq.addEventListener('change', onStoreChange);
  return () => mq.removeEventListener('change', onStoreChange);
}

function getDesktopSnapshot() {
  return window.matchMedia(DESKTOP_QUERY).matches;
}

function getDesktopServerSnapshot() {
  return false;
}

function isCurrent(pathname: string | null, href: string) {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function ToneDot({ tone }: { tone: 'cyan' | 'emerald' }) {
  return (
    <span
      aria-hidden
      className={`${styles.dot} ${tone === 'cyan' ? styles.dotCyan : styles.dotEmerald}`}
    />
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  /* The sheet's open state is stored as THE PATH IT WAS OPENED ON, not a
     boolean, so "close on navigate" is derived during render instead of being
     an effect that calls setState (which `react-hooks/set-state-in-effect`
     rejects, and which rendered one frame of the sheet over the new page).
     Navigate with the sheet open — back button, in-page anchor, a link inside
     the sheet — and `openPath` no longer equals `pathname`, so the sheet is
     closed on the very first render of the new route. */
  const [openPath, setOpenPath] = useState<string | null>(null);
  const isDesktop = useSyncExternalStore(
    subscribeDesktop,
    getDesktopSnapshot,
    getDesktopServerSnapshot,
  );
  const mobileOpen = openPath !== null && openPath === pathname && !isDesktop;

  const close = useCallback(() => setOpenPath(null), []);
  const toggle = useCallback(
    () => setOpenPath((current) => (current === pathname ? null : pathname)),
    [pathname],
  );

  /* Crossing UP to the desktop breakpoint also DISCARDS the stored path, so
     rotating a phone landscape and back does not resurrect a sheet the user
     never re-opened. `isDesktop` above already forces `mobileOpen` false the
     moment the query matches — this only clears the residue. setState here is
     inside the subscription CALLBACK, which is the pattern the
     set-state-in-effect rule explicitly endorses; the version that tripped it
     called setState in the effect BODY. */
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setOpenPath(null);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  /* Body scroll lock — the sheet covers the viewport, so the page behind it
     must not scroll. Unchanged from the previous header. */
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  /* Escape closes and hands focus back to the button that opened it. The
     sheet does not trap focus; Tab leaves it the way it leaves any dialog-less
     overlay, and the closed sheet is `visibility: hidden` + `inert`, so it is
     out of the tab order entirely. */
  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      close();
      menuBtnRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [close, mobileOpen]);

  return (
    <>
      <header className={`lp-nav-wrap ${styles.navWrap}`}>
        <nav className={`lp-nav ${styles.nav}`} aria-label="Primary">
          <Link
            href="/"
            className={`lp-nav-brand ${styles.brand}`}
            aria-label="Double Helix Hub — home"
          >
            <BrandLogo variant="full" size="sm" tone="auto" priority alt="Double Helix Hub" />
          </Link>

          <div className="lp-nav-links">
            {NAV.map((item) => {
              const current = isCurrent(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={styles.navLink}
                  aria-current={current ? 'page' : undefined}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>

          <div className="lp-nav-actions">
            <ThemeToggle className={`lp-theme-btn !h-11 !w-11 ${styles.themeBtn}`} />
            <Link href={SIGN_IN_HREF} className={styles.signIn}>
              Sign in
            </Link>
            <Link href={ACCESS_HREF} className={`lp-nav-cta ${styles.navCta}`}>
              Access
            </Link>
            <button
              ref={menuBtnRef}
              type="button"
              className="lp-nav-menu-btn"
              onClick={toggle}
              aria-expanded={mobileOpen}
              aria-controls={SHEET_ID}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            >
              <span
                aria-hidden
                className={`${styles.burger} ${mobileOpen ? styles.burgerOpen : ''}`}
              >
                <span className={styles.burgerBar} />
                <span className={styles.burgerBar} />
                <span className={styles.burgerBar} />
              </span>
            </button>
          </div>
        </nav>
      </header>

      {/* Sibling of the island, at a lower z-index, so the island — and the
          close button inside it — stays above the scrim and clickable. */}
      <div
        id={SHEET_ID}
        className={`${styles.sheet} ${mobileOpen ? styles.sheetOpen : ''}`}
        inert={!mobileOpen}
      >
        <div className={styles.sheetScrim} aria-hidden onClick={close} />
        <div className={styles.sheetPanel}>
          <p className={styles.sheetLabel}>Menu</p>
          <nav className={styles.sheetNav} aria-label="Mobile">
            {NAV.map((item) => {
              const current = isCurrent(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={styles.sheetLink}
                  aria-current={current ? 'page' : undefined}
                  onClick={close}
                >
                  {item.tone ? <ToneDot tone={item.tone} /> : null}
                  {item.name}
                  <CaretRight
                    weight="light"
                    className={`h-5 w-5 ${styles.sheetChevron}`}
                    aria-hidden
                  />
                </Link>
              );
            })}
          </nav>

          <div className={styles.sheetActions}>
            <Link href={ACCESS_HREF} className="lp-btn-primary" onClick={close}>
              Request access
              <ArrowUpRight weight="light" className="h-4 w-4" aria-hidden />
            </Link>
            <Link href={SIGN_IN_HREF} className="lp-btn-secondary" onClick={close}>
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
