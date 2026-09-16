'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
// Relative (not '@/'): e2e/nav-tabs.test.ts loads this module under the e2e
// vitest config, which has no path alias.
import { isNavHrefActive } from '../lib/crm/nav-profile';
import {
    getNavItemsForModule,
    type TopModule,
} from '../lib/crm/module-nav';

export type { NavItem, TopModule } from '../lib/crm/module-nav';
export {
    ANALYTICS_NAV_ITEMS,
    COMMUNICATIONS_NAV_ITEMS,
    CRM_NAV_ITEMS,
    INTEGRATIONS_NAV_ITEMS,
    OPERATIONS_NAV_ITEMS,
    REVENUE_NAV_ITEMS,
    SETTINGS_NAV_ITEMS,
    TOP_MODULES,
    TOP_MODULE_TITLES,
    getNavItemsForModule,
} from '../lib/crm/module-nav';

interface ModuleContextType {
    /** The highlighted top-level tab (tab strip, rail, sidebar menu). */
    activeModule: TopModule;
    /** Explicit pick (tab / rail click). */
    setActiveModule: (module: TopModule) => void;
    /**
     * NV-2 sticky tab: re-resolve the tab for a location change. Pure logic
     * lives in `resolveStickyTopModule`; this just applies it to state.
     */
    syncActiveModuleToLocation: (location: StickyLocation) => void;
}

const ModuleContext = createContext<ModuleContextType | undefined>(undefined);

export function ModuleProvider({ children }: { children: ReactNode }) {
    // Synchronous first paint: the tab the URL names (SSR and the client agree,
    // deep links never flash "CRM" first). Nothing stored (localStorage once
    // resurrected a stale tab over a deep link — D10 risk) — the URL wins.
    const pathname = usePathname();
    const [activeModule, setActiveModuleState] = useState<TopModule>(
        () => resolveTopModuleFromPathname(pathname ?? '/crm'),
    );

    const setActiveModule = useCallback((module: TopModule) => {
        setActiveModuleState(module);
    }, []);

    const syncActiveModuleToLocation = useCallback((location: StickyLocation) => {
        setActiveModuleState((current) => resolveStickyTopModule({ ...location, currentModule: current }));
    }, []);

    const value = useMemo(
        () => ({ activeModule, setActiveModule, syncActiveModuleToLocation }),
        [activeModule, setActiveModule, syncActiveModuleToLocation]
    );

    // Always render immediately with default/current value
    return (
        <ModuleContext.Provider value={value}>
            {children}
        </ModuleContext.Provider>
    );
}

export function useModule() {
    const context = useContext(ModuleContext);
    if (context === undefined) {
        throw new Error('useModule must be used within a ModuleProvider');
    }
    return context;
}

/** Resolve the active top-level module from the current pathname (single source of truth). */
export function resolveTopModuleFromPathname(pathname: string): TopModule {
    if (pathname.startsWith('/crm/settings')) return 'settings';
    if (pathname.startsWith('/crm/integrations')) return 'integrations';
    if (pathname.startsWith('/crm/analytics') || pathname.startsWith('/crm/executive')) return 'analytics';
    if (
        pathname.startsWith('/crm/operations') ||
        pathname.startsWith('/crm/scheduling') ||
        pathname.startsWith('/crm/playbooks') ||
        pathname.startsWith('/crm/enrollment') ||
        pathname.startsWith('/crm/needs') ||
        pathname.startsWith('/crm/approvals') ||
        pathname.startsWith('/crm/vendors')
    ) {
        return 'operations';
    }
    if (
        pathname.startsWith('/crm/revenue') ||
        pathname.startsWith('/crm/products') ||
        pathname.startsWith('/crm/quotes') ||
        pathname.startsWith('/crm/invoices') ||
        pathname.startsWith('/crm/forecasting') ||
        pathname.startsWith('/crm/commissions')
    ) {
        return 'revenue';
    }
    if (
        pathname.startsWith('/crm/communications') ||
        pathname.startsWith('/crm/campaigns') ||
        pathname.startsWith('/crm/sequences') ||
        pathname.startsWith('/crm/email') ||
        pathname.startsWith('/crm/inbox')
    ) {
        return 'communications';
    }
    return 'crm';
}

// ---------------------------------------------------------------------------
// NV-2 / D10 — sticky tab on client navigation
// ---------------------------------------------------------------------------

export interface StickyLocation {
    pathname: string;
    /** Current query string (`?a=b` or `a=b`), for `?tab=` style hrefs. */
    search?: string | null;
    /**
     * The pathname before this change; `null` on the first render (fresh
     * load / deep link), which always resolves from the URL.
     */
    previousPathname: string | null;
}

/**
 * Which tab should be highlighted after a location change.
 *
 *  - Fresh load / deep link (`previousPathname === null`): the tab the URL
 *    names (`resolveTopModuleFromPathname`) — synchronous, never stale.
 *  - Client navigation: if the CURRENT tab's sidebar has a link that is active
 *    for the new location (`isNavHrefActive`, path + query), the tab stays —
 *    the sidebar never swaps under a link the user just clicked in it
 *    (e.g. Communications › Templates → `/crm/settings/templates` keeps
 *    Communications). Otherwise the URL decides (a deep page link, the
 *    palette, a record page).
 */
export function resolveStickyTopModule(input: StickyLocation & { currentModule: TopModule }): TopModule {
    const { pathname, search, previousPathname, currentModule } = input;
    const byPath = resolveTopModuleFromPathname(pathname);
    if (previousPathname === null) return byPath;
    if (byPath === currentModule) return byPath;
    const items = getNavItemsForModule(currentModule);
    for (const item of items) {
        if (item.separator || !item.href) continue;
        if (isNavHrefActive(item.href, pathname, search)) return currentModule;
    }
    return byPath;
}

/** Keeps ModuleContext in sync with the URL (Zoho-style module persistence, sticky on client hops). */
export function ModulePathSync() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const search = searchParams?.toString() ?? '';
    const { syncActiveModuleToLocation } = useModule();
    const previousPathnameRef = useRef<string | null>(null);

    useEffect(() => {
        const previousPathname = previousPathnameRef.current;
        previousPathnameRef.current = pathname;
        syncActiveModuleToLocation({ pathname, search, previousPathname });
        // Only a pathname change counts as a hop; a query-only change (list
        // filters, ?tab=) must not re-run the sticky decision — `search` is
        // read on purpose without being a dependency.
    }, [pathname, syncActiveModuleToLocation]);

    return null;
}

