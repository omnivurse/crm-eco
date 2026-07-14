'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { usePathname } from 'next/navigation';

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
    activeModule: TopModule;
    setActiveModule: (module: TopModule) => void;
}

const ModuleContext = createContext<ModuleContextType | undefined>(undefined);

const STORAGE_KEY = 'crm_active_module';

export function ModuleProvider({ children }: { children: ReactNode }) {
    const [activeModule, setActiveModuleState] = useState<TopModule>('crm');

    // Load from localStorage on mount (client-side only)
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY) as TopModule | null;
        if (stored && isValidModule(stored)) {
            queueMicrotask(() => setActiveModuleState(stored));
        }
    }, []);

    const setActiveModule = useCallback((module: TopModule) => {
        setActiveModuleState(module);
        localStorage.setItem(STORAGE_KEY, module);
    }, []);

    const value = useMemo(
        () => ({ activeModule, setActiveModule }),
        [activeModule, setActiveModule]
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

function isValidModule(value: string): value is TopModule {
    return ['crm', 'communications', 'revenue', 'operations', 'analytics', 'integrations', 'settings'].includes(value);
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

/** Keeps ModuleContext in sync with the URL (Zoho-style module persistence). */
export function ModulePathSync() {
    const pathname = usePathname();
    const { setActiveModule } = useModule();

    useEffect(() => {
        setActiveModule(resolveTopModuleFromPathname(pathname));
    }, [pathname, setActiveModule]);

    return null;
}

/** Navigation item: link, section header, or separator */
export type NavItem =
    | { key: string; label: string; icon: string; href: string; separator?: false; badge?: 'new' | 'beta'; }
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

    { key: 'sec-pipeline', separator: true, sectionTitle: 'Sales Pipeline' },
    { key: 'leads', label: 'Leads', icon: 'user-plus', href: '/crm/modules/leads' },
    { key: 'contacts', label: 'Contacts', icon: 'users', href: '/crm/modules/contacts' },
    { key: 'accounts', label: 'Accounts', icon: 'building', href: '/crm/modules/accounts' },
    { key: 'deals', label: 'Deals', icon: 'dollar-sign', href: '/crm/modules/deals' },
    { key: 'pipeline', label: 'Pipeline', icon: 'kanban', href: '/crm/pipeline' },

    { key: 'sec-people', separator: true, sectionTitle: 'People Management' },
    { key: 'advisors', label: 'Advisors & Agents', icon: 'user-cog', href: '/crm/members' },
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
    { key: 'import', label: 'Import Data', icon: 'upload', href: '/crm/import' },

    { key: 'sec-data-quality', separator: true, sectionTitle: 'Data Quality' },
    { key: 'duplicates', label: 'Review Duplicates', icon: 'git-merge', href: '/crm/duplicates' },
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
    { key: 'import', label: 'Import / Export', icon: 'upload', href: '/crm/import' },
    { key: 'data-jobs', label: 'Data Jobs', icon: 'database', href: '/crm/settings/system-health?tab=jobs' },
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
    { key: 'users', label: 'Users & Teams', icon: 'users', href: '/crm/settings/users' },
    { key: 'roles', label: 'Roles & Permissions', icon: 'shield', href: '/crm/settings/users?tab=roles' },
    { key: 'security', label: 'Security Control', icon: 'lock', href: '/crm/settings/security-control' },

    { key: 'sec-custom', separator: true, sectionTitle: 'Customization' },
    { key: 'modules', label: 'Modules', icon: 'layers', href: '/crm/settings/modules' },
    { key: 'fields', label: 'Fields', icon: 'list', href: '/crm/settings/fields' },
    { key: 'layouts', label: 'Layouts', icon: 'layout', href: '/crm/settings/layouts' },
    { key: 'blueprints', label: 'Blueprints', icon: 'git-branch', href: '/crm/settings/blueprints' },
    { key: 'validation', label: 'Validation Rules', icon: 'shield-check', href: '/crm/settings/customization' },

    { key: 'sec-automation', separator: true, sectionTitle: 'Automation' },
    { key: 'workflows', label: 'Workflows', icon: 'workflow', href: '/crm/settings/automations/workflows' },
    { key: 'macros', label: 'Macros & Rules', icon: 'zap', href: '/crm/settings/automations/macros' },
    { key: 'assignment', label: 'Assignment Rules', icon: 'user-cog', href: '/crm/settings/automations/assignment' },
    { key: 'scoring', label: 'Scoring Rules', icon: 'star', href: '/crm/settings/automations/scoring' },
    { key: 'sla', label: 'SLA Policies', icon: 'clock', href: '/crm/settings/automations/sla' },
    { key: 'cadences', label: 'Cadences', icon: 'repeat', href: '/crm/settings/automations/cadences' },
    { key: 'responses', label: 'Auto-Responses', icon: 'bot', href: '/crm/settings/automations/responses' },

    { key: 'sec-comm', separator: true, sectionTitle: 'Communication' },
    { key: 'templates', label: 'Templates', icon: 'file-text', href: '/crm/settings/templates' },
    { key: 'signatures', label: 'Signatures', icon: 'file-signature', href: '/crm/settings/signatures' },
    { key: 'email-domains', label: 'Email Domains', icon: 'globe', href: '/crm/settings/email-domains' },
    { key: 'notifications', label: 'Notifications', icon: 'bell', href: '/crm/settings/comms' },

    { key: 'sec-data', separator: true, sectionTitle: 'Data Management' },
    { key: 'imports', label: 'Imports', icon: 'upload', href: '/crm/settings/mappings' },
    { key: 'export', label: 'Export', icon: 'download', href: '/crm/settings/system-health?tab=export' },
    { key: 'data-admin', label: 'Data Admin', icon: 'database', href: '/crm/settings/system-health' },
    { key: 'audit-logs', label: 'Audit Logs', icon: 'scroll-text', href: '/crm/settings/system-health?tab=audit' },

    { key: 'sec-advanced', separator: true, sectionTitle: 'Advanced' },
    { key: 'configuration', label: 'Configuration', icon: 'sliders', href: '/crm/settings/configuration' },
    { key: 'landing-pages', label: 'Landing Pages', icon: 'globe', href: '/crm/settings/landing-pages', badge: 'beta' },
    { key: 'developer', label: 'Developer Hub', icon: 'code', href: '/crm/integrations?tab=api-keys' },
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

