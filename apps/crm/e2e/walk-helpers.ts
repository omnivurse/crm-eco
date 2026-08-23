/**
 * Shared helpers for the EV-5 persona specs. Nothing here performs a counted
 * user action — every click/keypress/type stays in the spec, through `walk`.
 */
import type { Locator, Page, Request } from '@playwright/test';
import { breakpointForProject } from './traps';

/** ⌘ on macOS, Ctrl elsewhere — the palette/composer accept either. */
export function modKey(): 'Meta' | 'Control' {
  return process.platform === 'darwin' ? 'Meta' : 'Control';
}

export function isMobileProject(project: string): boolean {
  return breakpointForProject(project) === 'mobile';
}

/** Below Tailwind `lg` (1024px) — the tablet and mobile projects. */
export function isBelowLg(page: Page): boolean {
  const vp = page.viewportSize();
  return !!vp && vp.width < 1024;
}

/** Sonner toast titles (`<li data-sonner-toast><div data-title>…`). */
export function toastTitles(page: Page): Locator {
  return page.locator('[data-sonner-toast] [data-title]');
}

/** Per-run unique suffix so repeated walks never collide on names/phones. */
export function runSuffix(): string {
  return Date.now().toString(36).slice(-6).toUpperCase();
}

/** A unique 10-digit 555 phone for records the walk creates (never the fixture's). */
export function uniquePhone(): string {
  const tail = String(Date.now() % 10_000_000).padStart(7, '0');
  return `555${tail}`;
}

/** Today as MM/DD/YYYY (a valid coverage start for the drawer). */
export function todayMdy(now = new Date()): string {
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${now.getFullYear()}`;
}

export interface SeenRequest {
  method: string;
  url: string;
  status: number | null;
}

/**
 * Records every request whose URL matches `match` (method + final status).
 * Returns the live array; call before the action, read after.
 */
export function trackRequests(page: Page, match: RegExp): SeenRequest[] {
  const seen: SeenRequest[] = [];
  const onRequest = (req: Request) => {
    if (!match.test(req.url())) return;
    const row: SeenRequest = { method: req.method(), url: req.url(), status: null };
    seen.push(row);
    req
      .response()
      .then((res) => {
        row.status = res ? res.status() : null;
      })
      .catch(() => {
        /* request aborted */
      });
  };
  page.on('request', onRequest);
  return seen;
}

/**
 * Headless Chromium hands `tel:` links to the OS protocol handler; stub the
 * default action so a counted click on a Call link stays measurable. The click
 * still fires (and is counted); only the external hand-off is suppressed.
 */
export async function stubTelLinks(page: Page): Promise<void> {
  await page.addInitScript(() => {
    document.addEventListener(
      'click',
      (ev) => {
        const a = (ev.target as HTMLElement | null)?.closest?.('a[href^="tel:"]');
        if (a) ev.preventDefault();
      },
      true,
    );
  });
}

/** The href the user lands on after a `tel:` click the stub swallowed. */
export function telHref(phone: string): string {
  return `tel:${phone}`;
}

/** Pathname + search of the page URL, e.g. "/crm/modules/contacts?page=2". */
export function pathWithQuery(page: Page): string {
  const u = new URL(page.url());
  return `${u.pathname}${u.search}`;
}

/** Parse "Showing 26 to 50 of 112 results" into numbers. */
export function parseShowing(text: string): { from: number; to: number; total: number } | null {
  const m = text.replace(/,/g, '').match(/Showing\s+(\d+)\s+to\s+(\d+)\s+of\s+(\d+)/i);
  if (!m) return null;
  return { from: Number(m[1]), to: Number(m[2]), total: Number(m[3]) };
}

/** First integer inside a chip/badge label like "Pending 4" (null when none). */
export function firstInt(text: string): number | null {
  const m = text.replace(/,/g, '').match(/\d+/);
  return m ? Number(m[0]) : null;
}

/**
 * Scroll the element's nearest scrollable ancestor (the V2 record page scrolls
 * inside `<main class="overflow-y-auto">`, not the window) until a pointer at
 * the element's centre would actually land on it — i.e. it is not covered by
 * sticky chrome (record header, pane tabs, the mobile action bar). Returns the
 * number of nudges that were needed (0 = a plain scroll-into-view sufficed);
 * specs record it so a viewport whose sticky chrome hides the content is
 * evidence, not a flaky click. Throws when no scroll position exposes it.
 */
export async function nudgeIntoClickableView(locator: Locator): Promise<number> {
  return locator.evaluate((el) => {
    const hit = () => {
      const r = el.getBoundingClientRect();
      const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!at && (at === el || el.contains(at));
    };
    el.scrollIntoView({ block: 'center' });
    if (hit()) return 0;
    let scroller: HTMLElement | null = el.parentElement;
    while (
      scroller &&
      !(/(auto|scroll)/.test(getComputedStyle(scroller).overflowY) && scroller.scrollHeight > scroller.clientHeight + 1)
    ) {
      scroller = scroller.parentElement;
    }
    const target = scroller ?? (document.scrollingElement as HTMLElement);
    for (let n = 1; n <= 40; n++) {
      const delta = (n % 2 === 1 ? 1 : -1) * 24 * Math.ceil(n / 2);
      target.scrollTop += delta;
      if (hit()) return n;
      target.scrollTop -= delta;
    }
    throw new Error('nudgeIntoClickableView: no scroll position exposes the element (covered by sticky chrome at every offset)');
  });
}

/**
 * Bring a row/card that a virtualised list has not rendered yet into existence
 * by scrolling every scrollable container (window + overflow-y auto/scroll
 * elements) a screen at a time until `locator` is visible. Scrolling is not a
 * counted action. Returns the number of scroll steps (0 = already visible),
 * or -1 when nothing can scroll further and it is still not there.
 */
export async function revealByScrolling(locator: Locator, maxSteps = 30): Promise<number> {
  const page = locator.page();
  for (let step = 0; step < maxSteps; step++) {
    if ((await locator.count()) > 0 && (await locator.first().isVisible())) return step;
    const moved = await page.evaluate(() => {
      const scrollers: HTMLElement[] = [document.scrollingElement as HTMLElement];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('main, [data-radix-scroll-area-viewport], div'))) {
        const cs = getComputedStyle(el);
        if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) scrollers.push(el);
      }
      let any = false;
      for (const s of scrollers) {
        const before = s.scrollTop;
        s.scrollTop = before + Math.max(200, Math.floor(s.clientHeight * 0.8));
        if (s.scrollTop !== before) any = true;
      }
      return any;
    });
    if (!moved) return -1;
    await page.waitForTimeout(150);
  }
  return -1;
}

/** Whether the element's box sits fully inside the current viewport (no scrolling needed). */
export async function isFullyInViewport(locator: Locator): Promise<boolean> {
  const page = locator.page();
  const vp = page.viewportSize();
  const box = await locator.boundingBox();
  if (!vp || !box) return false;
  return box.y >= 0 && box.x >= 0 && box.y + box.height <= vp.height && box.x + box.width <= vp.width;
}

/** Selector for the visible "working" affordances a list may show while it re-queries (LS-3). */
export const PENDING_STATE_SELECTOR = '[aria-busy="true"], [role="progressbar"], .animate-pulse';

declare global {
  interface Window {
    __walkPendingLatch?: { seen: boolean; selector: string; stop: () => void };
  }
}

/**
 * Arms an in-page MutationObserver that latches the first node matching
 * PENDING_STATE_SELECTOR (already present or added/attributed later). Use it
 * BEFORE the action that should show a pending state — the state can be
 * shorter than one runner round-trip, so polling from outside races it.
 */
export async function armPendingStateLatch(page: Page, selector: string = PENDING_STATE_SELECTOR): Promise<void> {
  await page.evaluate((sel) => {
    window.__walkPendingLatch?.stop();
    const latch = { seen: document.querySelector(sel) !== null, selector: sel, stop: () => undefined as void };
    const obs = new MutationObserver(() => {
      if (!latch.seen && document.querySelector(sel) !== null) latch.seen = true;
    });
    obs.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-busy', 'role', 'class'] });
    latch.stop = () => obs.disconnect();
    window.__walkPendingLatch = latch;
  }, selector);
}

/** Reads (and disarms) the latch, waiting up to `withinMs` for it to trip. */
export async function readPendingStateLatch(page: Page, withinMs = 2_000): Promise<boolean> {
  const deadline = Date.now() + withinMs;
  let seen = false;
  while (!seen && Date.now() < deadline) {
    seen = await page.evaluate(() => window.__walkPendingLatch?.seen === true);
    if (!seen) await page.waitForTimeout(50);
  }
  await page.evaluate(() => window.__walkPendingLatch?.stop());
  return seen;
}
