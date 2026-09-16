import { cn } from '@crm-eco/ui/lib/utils';

/** Inbox is a workspace: flush to the sidebar and the right edge. */
export function isCrmFullBleedPath(pathname: string | null | undefined): boolean {
  return Boolean(pathname?.startsWith('/crm/inbox'));
}

/** Record detail — edge-to-edge main, BottomBar stays (unlike inbox). */
export function isCrmRecordPath(pathname: string | null | undefined): boolean {
  return Boolean(pathname?.startsWith('/crm/r/'));
}

export function crmShellMainClass(fullBleed: boolean, flushEdges = fullBleed): string {
  return cn(
    'flex-1 min-w-0 min-h-0 scrollbar-thin focus:outline-none',
    fullBleed
      ? 'overflow-hidden px-0 py-0'
      : flushEdges
        ? 'overflow-auto px-0 pt-1.5 pb-0'
        : 'overflow-auto [scrollbar-gutter:stable] px-2 py-1.5 sm:px-3 sm:py-1.5 lg:px-4 lg:py-2',
  );
}

/** Inbox + record detail fill the pane. Other pages keep a reading inset above BottomBar. */
export function crmShellMainInnerClass(fullBleed: boolean, fillPane = fullBleed): string {
  return fullBleed || fillPane ? 'h-full w-full min-h-0' : 'w-full pb-10';
}
