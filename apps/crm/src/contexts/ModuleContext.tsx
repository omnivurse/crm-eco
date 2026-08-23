'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
// Relative (not '@/'): e2e/nav-tabs.test.ts loads this module under the e2e
// vitest config, which has no path alias.
import { PEOPLE_SECTION_LABEL } from '../lib/crm/nav-lexicon';
import { isNavHrefActive } from '../lib/crm/nav-profile';

// Top-level modules in the Zoho-style navigation
export type TopModule =
    | 'crm'
    | 'communications'
    | 'revenue'
    | 'operations'
    | 'analytics'
    | 'integrations'
    | 'settings';

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

export const TOP_MODULE_TITLES: Record<TopModule, string> = {
    crm: 'CRM',
    communications: 'Communications',
    revenue: 'Revenue',
    operations: 'Operations',
    analytics: 'Analytics',
    integrations: 'Integrations',
    settings: 'Settings',
};

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

/**
 * Navigation item: link, section header, or separator.
 * `adminOnly` links are hidden for non-admins with the SAME predicate
 * app/crm/settings/page.tsx uses for its cards (`crm_role === 'crm_admin'`);
 * `managerOrAdmin` links with the predicate app/crm/import/page.tsx uses
 * (`crm_admin | crm_manager`) — see nav-profile.ts visibleNavItemsForRole
 * (NV-M1 / NV-2 / D10).
 */
export type NavItem =
    | { key: string; label: string; icon: string; href: string; separator?: false; badge?: 'new' | 'beta'; adminOnly?: boolean; managerOrAdmin?: boolean; }
    | { key: string; separator: true; sectionTitle?: string; label?: undefined; icon?: undefined; href?: undefined };

// Module configuration for navigation
export const TOP_MODULES: {
    key: TopModule;
    label: string;
    icon: string;
    href: string;
}[] = [
        { key: 'crm', label: 'CRM', icon: 'users', href: '/crm' },
        { key: 'communications', label: 'Communications', icon: 'message-square', href: '/crm/communications' },
        { key: 'revenue', label: 'Revenue', icon: 'dollar-sign', href: '/crm/revenue' },
        { key: 'operations', label: 'Operations', icon: 'settings-2', href: '/crm/operations' },
        { key: 'analytics', label: 'Analytics', icon: 'bar-chart-3', href: '/crm/analytics' },
        { key: 'integrations', label: 'Integrations', icon: 'plug', href: '/crm/integrations' },
        // Settings removed from module bar - accessed via gear icon in header
    ];

// ---------------------------------------------------------------------------
// CRM — Core sales pipeline, people management, and health intelligence
// ---------------------------------------------------------------------------
export const CRM_NAV_ITEMS: NavItem[] = [
    // Home base
    { key: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard', href: '/crm' },
    { key: 'workqueue', label: 'Workqueue', icon: 'inbox', href: '/crm/workqueue' },

    // NOTE: the module links in this section are the static baseline used by
    // the reachability test; the rendered sidebar rebuilds them from the org's
    // enabled crm_modules via buildFullCrmNav() (lib/crm/nav-profile.ts).
    // Section KEY stays 'sec-pipeline' (nav-profile.ts injects the org's
    // modules after it); the heading is the lexicon's "People" (NV-6 / D10).
    { key: 'sec-pipeline', separator: true, sectionTitle: PEOPLE_SECTION_LABEL },
    { key: 'leads', label: 'Leads', icon: 'user-plus', href: '/crm/modules/leads' },
    { key: 'contacts', label: 'Contacts', icon: 'users', href: '/crm/modules/contacts' },
    { key: 'accounts', label: 'Accounts', icon: 'building', href: '/crm/modules/accounts' },
    // Members list (the deals module is disabled; /crm/modules/deals silently
    // redirected here, so name the destination honestly).
    { key: 'members', label: 'Members', icon: 'shield-check', href: '/crm/modules/members' },
    { key: 'pipeline', label: 'Pipeline', icon: 'kanban', href: '/crm/pipeline' },

    { key: 'sec-people', separator: true, sectionTitle: 'People Management' },
    // The `advisors` CRM module (crm_modules.key = 'advisors'); the sidebar
    // hides this when the org has that module disabled (see nav-profile.ts).
    { key: 'advisors', label: 'Advisors', icon: 'user-cog', href: '/crm/modules/advisors' },
    // Admin-Portal member roster (health-share `members` table), distinct from
    // the CRM `members` module list above — label it for what it opens.
    { key: 'member-roster', label: 'Member Roster', icon: 'heart-pulse', href: '/crm/members' },
    { key: 'contact-groups', label: 'Contact Groups', icon: 'folder-users', href: '/crm/modules/contacts?tab=groups' },
    { key: 'segmentation', label: 'Segmentation', icon: 'target', href: '/crm/modules/contacts?tab=segments' },

    { key: 'sec-engage', separator: true, sectionTitle: 'Engagement' },
    { key: 'inbox', label: 'Inbox', icon: 'inbox', href: '/crm/inbox' },
    { key: 'activities', label: 'Activities', icon: 'activity', href: '/crm/activities' },
    { key: 'tasks', label: 'Tasks', icon: 'check-square', href: '/crm/tasks' },
    { key: 'calendar', label: 'Calendar', icon: 'calendar', href: '/crm/calendar' },
    { key: 'tickets', label: 'Tickets', icon: 'ticket', href: '/crm/tickets' },
    { key: 'organizer', label: 'Organizer', icon: 'layout', href: '/crm/organizer' },

    { key: 'sec-health', separator: true, sectionTitle: 'Health Intelligence' },
    { key: 'lifecycle', label: 'Lifecycle Events', icon: 'heart-pulse', href: '/crm/modules/contacts?tab=lifecycle' },
    { key: 'medicaid', label: 'Medicaid Tracker', icon: 'shield-plus', href: '/crm/modules/contacts?tab=medicaid' },
    { key: 'carriers', label: 'Carriers & Plans', icon: 'building-2', href: '/crm/modules/contacts?tab=carriers' },
    { key: 'premium-compare', label: 'Premium Compare', icon: 'calculator', href: '/crm/modules/contacts?tab=premiums' },
    { key: 'healthcare-networks', label: 'Provider Networks', icon: 'building-2', href: '/crm/healthcare/networks' },
    { key: 'provider-search', label: 'Provider Search', icon: 'search', href: '/crm/healthcare/search' },

    { key: 'sec-insights', separator: true, sectionTitle: 'Insights' },
    { key: 'reports', label: 'Reports', icon: 'pie-chart', href: '/crm/reports' },
    { key: 'documents', label: 'Documents', icon: 'file-text', href: '/crm/documents' },
    // /crm/import redirects anyone but crm_admin | crm_manager (import/page.tsx)
    // — same gate here so agents never click into a permission bounce (NV-2).
    { key: 'import', label: 'Import Data', icon: 'upload', href: '/crm/import', managerOrAdmin: true },

    { key: 'sec-data-quality', separator: true, sectionTitle: 'Data Quality' },
    { key: 'duplicates', label: 'Review Duplicates', icon: 'git-merge', href: '/crm/duplicates' },
    // Data Health lives HERE, beside Review Duplicates, because this is the
    // section a person already opens when they are asking "is the book clean?"
    // — Settings is where you go to change a setting. It is also linked from
    // the Settings index for the admin who starts there.
    // /crm/data-health redirects anyone but crm_admin | crm_manager (its
    // page.tsx, same gate as /crm/duplicates) — the link carries the same
    // predicate so agents/viewers are never offered a bounce (NV-2).
    { key: 'data-health', label: 'Data Health', icon: 'heart-pulse', href: '/crm/data-health', managerOrAdmin: true },
];

// ---------------------------------------------------------------------------
// COMMUNICATIONS — Email, SMS, campaigns, and outreach
// ---------------------------------------------------------------------------
export const COMMUNICATIONS_NAV_ITEMS: NavItem[] = [
    { key: 'inbox', label: 'Inbox', icon: 'inbox', href: '/crm/inbox' },
    { key: 'compose', label: 'Compose', icon: 'mail-plus', href: '/crm/communications/compose' },
    { key: 'overview', label: 'Overview', icon: 'home', href: '/crm/communications' },

    { key: 'sec-campaigns', separator: true, sectionTitle: 'Campaigns' },
    { key: 'email-campaigns', label: 'Email Campaigns', icon: 'megaphone', href: '/crm/campaigns' },
    { key: 'sequences', label: 'Sequences', icon: 'repeat', href: '/crm/sequences' },
    { key: 'sms-campaigns', label: 'SMS Campaigns', icon: 'message-square', href: '/crm/communications?tab=sms', badge: 'beta' },

    { key: 'sec-tools', separator: true, sectionTitle: 'Tools' },
    { key: 'templates', label: 'Templates', icon: 'layout', href: '/crm/settings/templates' },
    { key: 'assets', label: 'Asset Library', icon: 'folder', href: '/crm/email/assets' },
    { key: 'signatures', label: 'Signatures', icon: 'file-signature', href: '/crm/settings/signatures' },
    { key: 'domains', label: 'Email Domains', icon: 'globe', href: '/crm/settings/email-domains' },

    { key: 'sec-channels', separator: true, sectionTitle: 'Channels' },
    { key: 'call-logs', label: 'Call Logs', icon: 'phone', href: '/crm/activities?type=call' },
    { key: 'notifications', label: 'Notifications', icon: 'bell', href: '/crm/settings/comms' },
];

// ---------------------------------------------------------------------------
// REVENUE — Financial operations, products, quotes, invoicing
// ---------------------------------------------------------------------------
export const REVENUE_NAV_ITEMS: NavItem[] = [
    { key: 'overview', label: 'Overview', icon: 'home', href: '/crm/revenue' },

    { key: 'sec-sales', separator: true, sectionTitle: 'Sales' },
    { key: 'products', label: 'Products', icon: 'package', href: '/crm/products' },
    { key: 'quotes', label: 'Quotes', icon: 'file-check', href: '/crm/quotes' },
    { key: 'invoices', label: 'Invoices', icon: 'receipt', href: '/crm/invoices' },
    { key: 'documents', label: 'Documents', icon: 'file-text', href: '/crm/documents' },

    { key: 'sec-insurance', separator: true, sectionTitle: 'Insurance' },
    { key: 'carriers', label: 'Carriers & Plans', icon: 'building-2', href: '/crm/modules/contacts?tab=carriers' },
    { key: 'premium-compare', label: 'Premium Compare', icon: 'calculator', href: '/crm/modules/contacts?tab=premiums' },

    { key: 'sec-financial', separator: true, sectionTitle: 'Financial' },
    { key: 'forecasting', label: 'Forecasting', icon: 'chart-line', href: '/crm/forecasting' },
    { key: 'commissions', label: 'Commissions', icon: 'wallet', href: '/crm/commissions' },
    { key: 'payments', label: 'Payments', icon: 'credit-card', href: '/crm/commissions?tab=payments' },
];

// ---------------------------------------------------------------------------
// OPERATIONS — Process, enrollment, vendors, data administration
// ---------------------------------------------------------------------------
export const OPERATIONS_NAV_ITEMS: NavItem[] = [
    { key: 'overview', label: 'Overview', icon: 'home', href: '/crm/operations' },

    { key: 'sec-process', separator: true, sectionTitle: 'Process' },
    { key: 'scheduling', label: 'Scheduling', icon: 'calendar', href: '/crm/scheduling' },
    { key: 'playbooks', label: 'Playbooks', icon: 'book-open', href: '/crm/playbooks' },
    { key: 'enrollment', label: 'Enrollment', icon: 'clipboard-check', href: '/crm/enrollment' },
    { key: 'needs', label: 'Needs', icon: 'heart', href: '/crm/needs' },
    { key: 'approvals', label: 'Approvals', icon: 'check-circle', href: '/crm/approvals' },

    { key: 'sec-vendors', separator: true, sectionTitle: 'Vendors' },
    { key: 'vendors', label: 'Vendor Hub', icon: 'building-2', href: '/crm/vendors' },
    { key: 'vendor-upload', label: 'Upload Files', icon: 'file-up', href: '/crm/vendors/upload' },
    { key: 'vendor-changes', label: 'Review Changes', icon: 'git-branch', href: '/crm/vendors/changes' },
    { key: 'vendor-connectors', label: 'Connectors', icon: 'link-2', href: '/crm/vendors/connectors' },
    { key: 'vendor-jobs', label: 'Processing Jobs', icon: 'refresh-cw', href: '/crm/vendors/jobs' },

    { key: 'sec-data', separator: true, sectionTitle: 'Data Management' },
    { key: 'import', label: 'Import / Export', icon: 'upload', href: '/crm/import', managerOrAdmin: true },
    // The jobs tab lives on /crm/settings/system-health, which redirects anyone
    // but crm_admin to /crm/settings (settings/system-health/page.tsx) — same
    // gate here, exactly like Settings › Export, so a manager/agent/viewer is
    // never offered a link that bounces them (NV-2 cross-tab / NV-M1).
    { key: 'data-jobs', label: 'Data Jobs', icon: 'database', href: '/crm/settings/system-health?tab=jobs', adminOnly: true },
];

// ---------------------------------------------------------------------------
// ANALYTICS — Reporting, dashboards, executive insights, health metrics
// ---------------------------------------------------------------------------
export const ANALYTICS_NAV_ITEMS: NavItem[] = [
    { key: 'overview', label: 'Overview', icon: 'home', href: '/crm/analytics' },

    { key: 'sec-reporting', separator: true, sectionTitle: 'Reporting' },
    { key: 'reports', label: 'Reports', icon: 'pie-chart', href: '/crm/reports' },
    { key: 'dashboards', label: 'Dashboards', icon: 'layout-dashboard', href: '/crm/analytics/dashboards' },
    { key: 'scorecards', label: 'Scorecards', icon: 'award', href: '/crm/settings/scorecards' },

    { key: 'sec-executive', separator: true, sectionTitle: 'Executive' },
    { key: 'executive', label: 'Executive Dashboard', icon: 'gauge', href: '/crm/executive' },
    { key: 'leaderboard', label: 'Leaderboard', icon: 'trophy', href: '/crm/analytics?tab=leaderboard' },
    { key: 'forecast-analytics', label: 'Forecast', icon: 'chart-line', href: '/crm/forecasting' },

    { key: 'sec-health-metrics', separator: true, sectionTitle: 'Health Metrics' },
    { key: 'lifecycle-stats', label: 'Lifecycle Stats', icon: 'heart-pulse', href: '/crm/analytics?tab=lifecycle' },
    { key: 'medicaid-stats', label: 'Medicaid Stats', icon: 'shield-plus', href: '/crm/analytics?tab=medicaid' },
    { key: 'advisor-analytics', label: 'Advisor Analytics', icon: 'user-cog', href: '/crm/analytics?tab=advisors' },
    { key: 'churn-analysis', label: 'Churn Analysis', icon: 'trending-down', href: '/crm/analytics?tab=churn' },
];

// ---------------------------------------------------------------------------
// INTEGRATIONS — External connectors, channels, developer tools
// ---------------------------------------------------------------------------
export const INTEGRATIONS_NAV_ITEMS: NavItem[] = [
    { key: 'overview', label: 'Overview', icon: 'home', href: '/crm/integrations' },

    { key: 'sec-channels', separator: true, sectionTitle: 'Channels' },
    { key: 'email', label: 'Email', icon: 'mail', href: '/crm/integrations/email' },
    { key: 'sms-voice', label: 'SMS / Voice', icon: 'phone', href: '/crm/integrations/phone' },
    { key: 'calendar', label: 'Calendar', icon: 'calendar', href: '/crm/integrations/calendar' },
    { key: 'whatsapp', label: 'WhatsApp', icon: 'message-circle', href: '/crm/integrations/chat' },
    { key: 'video', label: 'Video', icon: 'video', href: '/crm/integrations/video' },

    { key: 'sec-developer', separator: true, sectionTitle: 'Developer' },
    { key: 'api-keys', label: 'API Keys', icon: 'key', href: '/crm/integrations?tab=api-keys' },
    { key: 'webhooks', label: 'Webhooks', icon: 'webhook', href: '/crm/integrations/webhooks' },
    { key: 'logs', label: 'Logs', icon: 'scroll-text', href: '/crm/integrations/logs' },

    { key: 'sec-marketplace', separator: true, sectionTitle: 'Marketplace' },
    { key: 'extensions', label: 'Extensions', icon: 'puzzle', href: '/crm/integrations?tab=extensions' },
    { key: 'installed', label: 'Installed', icon: 'check-circle', href: '/crm/integrations?tab=installed' },
];

// ---------------------------------------------------------------------------
// SETTINGS — Organization config, customization, automation, admin
// ---------------------------------------------------------------------------
export const SETTINGS_NAV_ITEMS: NavItem[] = [
    { key: 'general', label: 'General', icon: 'settings', href: '/crm/settings' },

    { key: 'sec-org', separator: true, sectionTitle: 'Organization' },
    // adminOnly mirrors the settings cards (app/crm/settings/page.tsx): Users,
    // Security, Customization, Automation, Email Domains, System Health /
    // Audit, Configuration, Developer Hub. Agents keep their own settings
    // (General, Templates, Signatures, Notifications, Import mappings).
    { key: 'users', label: 'Users & Teams', icon: 'users', href: '/crm/settings/users', adminOnly: true },
    { key: 'roles', label: 'Roles & Permissions', icon: 'shield', href: '/crm/settings/users?tab=roles', adminOnly: true },
    { key: 'security', label: 'Security Control', icon: 'lock', href: '/crm/settings/security-control', adminOnly: true },

    { key: 'sec-custom', separator: true, sectionTitle: 'Customization' },
    { key: 'modules', label: 'Modules', icon: 'layers', href: '/crm/settings/modules', adminOnly: true },
    { key: 'fields', label: 'Fields', icon: 'list', href: '/crm/settings/fields', adminOnly: true },
    // Plain-language name on purpose — the business owner curates pick lists
    // here (e.g. Membership / Plan). Deep-linkable via ?module=&field=.
    { key: 'field-options', label: 'Dropdown lists', icon: 'check-square', href: '/crm/settings/field-options', managerOrAdmin: true },
    { key: 'layouts', label: 'Layouts', icon: 'layout', href: '/crm/settings/layouts', adminOnly: true },
    { key: 'blueprints', label: 'Blueprints', icon: 'git-branch', href: '/crm/settings/blueprints', adminOnly: true },
    { key: 'validation', label: 'Validation Rules', icon: 'shield-check', href: '/crm/settings/customization', adminOnly: true },

    { key: 'sec-automation', separator: true, sectionTitle: 'Automation' },
    { key: 'workflows', label: 'Workflows', icon: 'workflow', href: '/crm/settings/automations/workflows', adminOnly: true },
    { key: 'macros', label: 'Macros & Rules', icon: 'zap', href: '/crm/settings/automations/macros', adminOnly: true },
    { key: 'assignment', label: 'Assignment Rules', icon: 'user-cog', href: '/crm/settings/automations/assignment', adminOnly: true },
    { key: 'scoring', label: 'Scoring Rules', icon: 'star', href: '/crm/settings/automations/scoring', adminOnly: true },
    { key: 'sla', label: 'SLA Policies', icon: 'clock', href: '/crm/settings/automations/sla', adminOnly: true },
    { key: 'cadences', label: 'Cadences', icon: 'repeat', href: '/crm/settings/automations/cadences', adminOnly: true },
    { key: 'responses', label: 'Auto-Responses', icon: 'bot', href: '/crm/settings/automations/responses', adminOnly: true },

    { key: 'sec-comm', separator: true, sectionTitle: 'Communication' },
    { key: 'templates', label: 'Templates', icon: 'file-text', href: '/crm/settings/templates' },
    { key: 'signatures', label: 'Signatures', icon: 'file-signature', href: '/crm/settings/signatures' },
    { key: 'email-domains', label: 'Email Domains', icon: 'globe', href: '/crm/settings/email-domains', adminOnly: true },
    { key: 'notifications', label: 'Notifications', icon: 'bell', href: '/crm/settings/comms' },

    { key: 'sec-data', separator: true, sectionTitle: 'Data Management' },
    // Same page as the CRM sidebar's Data Quality entry and the Settings card
    // below it — one screen, reachable from wherever the admin started.
    { key: 'data-health', label: 'Data Health', icon: 'heart-pulse', href: '/crm/data-health', managerOrAdmin: true },
    { key: 'imports', label: 'Imports', icon: 'upload', href: '/crm/settings/mappings' },
    { key: 'export', label: 'Export', icon: 'download', href: '/crm/settings/system-health?tab=export', adminOnly: true },
    { key: 'data-admin', label: 'Data Admin', icon: 'database', href: '/crm/settings/system-health', adminOnly: true },
    { key: 'audit-logs', label: 'Audit Logs', icon: 'scroll-text', href: '/crm/settings/system-health?tab=audit', adminOnly: true },
    // /api/crm/trash gates on has_crm_role('crm_admin') — a dead end for agents.
    { key: 'trash', label: 'Recycle Bin', icon: 'trash-2', href: '/crm/trash', adminOnly: true },

    { key: 'sec-advanced', separator: true, sectionTitle: 'Advanced' },
    { key: 'configuration', label: 'Configuration', icon: 'sliders', href: '/crm/settings/configuration', adminOnly: true },
    { key: 'landing-pages', label: 'Landing Pages', icon: 'globe', href: '/crm/settings/landing-pages', badge: 'beta' },
    { key: 'developer', label: 'Developer Hub', icon: 'code', href: '/crm/integrations?tab=api-keys', adminOnly: true },
];

// Get nav items for a specific module
export function getNavItemsForModule(module: TopModule): NavItem[] {
    switch (module) {
        case 'crm': return CRM_NAV_ITEMS;
        case 'communications': return COMMUNICATIONS_NAV_ITEMS;
        case 'revenue': return REVENUE_NAV_ITEMS;
        case 'operations': return OPERATIONS_NAV_ITEMS;
        case 'analytics': return ANALYTICS_NAV_ITEMS;
        case 'integrations': return INTEGRATIONS_NAV_ITEMS;
        case 'settings': return SETTINGS_NAV_ITEMS;
        default: return CRM_NAV_ITEMS;
    }
}

