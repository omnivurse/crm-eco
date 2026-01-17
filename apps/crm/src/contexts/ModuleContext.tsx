'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
            setActiveModuleState(stored);
        }
    }, []);

    const setActiveModule = (module: TopModule) => {
        setActiveModuleState(module);
        localStorage.setItem(STORAGE_KEY, module);
    };

    // Always render immediately with default/current value
    return (
        <ModuleContext.Provider value={{ activeModule, setActiveModule }}>
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

// CRM sidebar navigation items - Main record types
export const CRM_NAV_ITEMS = [
    { key: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard', href: '/crm' },
    { key: 'leads', label: 'Leads', icon: 'user-plus', href: '/crm/modules/leads' },
    { key: 'contacts', label: 'Contacts', icon: 'users', href: '/crm/modules/contacts' },
    { key: 'accounts', label: 'Accounts', icon: 'building', href: '/crm/accounts' },
    { key: 'deals', label: 'Deals', icon: 'dollar-sign', href: '/crm/modules/deals' },
    { key: 'pipeline', label: 'Pipeline', icon: 'trending-up', href: '/crm/pipeline' },
    { key: 'activities', label: 'Activities', icon: 'activity', href: '/crm/activities' },
    { key: 'tasks', label: 'Tasks', icon: 'check-square', href: '/crm/tasks' },
    { key: 'reports', label: 'Reports', icon: 'pie-chart', href: '/crm/reports' },
];

// Integrations sidebar navigation items
export const INTEGRATIONS_NAV_ITEMS = [
    { key: 'overview', label: 'Overview', icon: 'home', href: '/crm/integrations' },
    { key: 'email', label: 'Email', icon: 'mail', href: '/crm/integrations/email' },
    { key: 'sms-voice', label: 'SMS / Voice', icon: 'phone', href: '/crm/integrations/phone' },
    { key: 'calendar', label: 'Calendar', icon: 'calendar', href: '/crm/integrations/calendar' },
    { key: 'whatsapp', label: 'WhatsApp', icon: 'message-circle', href: '/crm/integrations/chat' },
    { key: 'video', label: 'Video', icon: 'video', href: '/crm/integrations/video' },
    { key: 'webhooks', label: 'Webhooks', icon: 'webhook', href: '/crm/integrations/webhooks' },
    { key: 'logs', label: 'Logs', icon: 'scroll-text', href: '/crm/integrations/logs' },
];

// Communications sidebar navigation items
export const COMMUNICATIONS_NAV_ITEMS = [
    { key: 'inbox', label: 'Inbox', icon: 'inbox', href: '/crm/inbox' },
    { key: 'email', label: 'Compose Email', icon: 'mail', href: '/crm/communications/new?type=email' },
    { key: 'sms', label: 'Send SMS', icon: 'message-square', href: '/crm/communications/new?type=sms' },
    { key: 'templates', label: 'Templates', icon: 'file-text', href: '/crm/settings/comms' },
    { key: 'campaigns', label: 'Campaigns', icon: 'megaphone', href: '/crm/communications' },
];

// Revenue sidebar navigation items - Financial focused
export const REVENUE_NAV_ITEMS = [
    { key: 'overview', label: 'Overview', icon: 'home', href: '/crm/revenue' },
    { key: 'products', label: 'Products', icon: 'package', href: '/crm/products' },
    { key: 'quotes', label: 'Quotes', icon: 'file-check', href: '/crm/quotes' },
    { key: 'invoices', label: 'Invoices', icon: 'receipt', href: '/crm/invoices' },
    { key: 'documents', label: 'Documents', icon: 'file-text', href: '/crm/documents' },
    { key: 'forecasting', label: 'Forecasting', icon: 'chart-line', href: '/crm/forecasting' },
    { key: 'commissions', label: 'Commissions', icon: 'dollar-sign', href: '/crm/commissions' },
];

// Operations sidebar navigation items
export const OPERATIONS_NAV_ITEMS = [
    { key: 'overview', label: 'Overview', icon: 'home', href: '/crm/operations' },
    { key: 'scheduling', label: 'Scheduling', icon: 'calendar', href: '/crm/scheduling' },
    { key: 'playbooks', label: 'Playbooks', icon: 'book-open', href: '/crm/playbooks' },
    { key: 'enrollment', label: 'Enrollment', icon: 'clipboard-check', href: '/crm/enrollment' },
    { key: 'needs', label: 'Needs', icon: 'heart', href: '/crm/needs' },
    { key: 'approvals', label: 'Approvals', icon: 'check-circle', href: '/crm/approvals' },
];

// Analytics sidebar navigation items  
export const ANALYTICS_NAV_ITEMS = [
    { key: 'overview', label: 'Overview', icon: 'home', href: '/crm/analytics' },
    { key: 'reports', label: 'Reports', icon: 'pie-chart', href: '/crm/reports' },
    { key: 'dashboards', label: 'Dashboards', icon: 'layout-dashboard', href: '/crm/analytics/dashboards' },
    { key: 'scorecards', label: 'Scorecards', icon: 'award', href: '/crm/settings/scorecards' },
];

// Settings sidebar navigation items
export const SETTINGS_NAV_ITEMS = [
    { key: 'general', label: 'General', icon: 'settings', href: '/crm/settings' },
    { key: 'users', label: 'Users', icon: 'users', href: '/crm/settings/users' },
    { key: 'modules', label: 'Modules', icon: 'layers', href: '/crm/settings/modules' },
    { key: 'fields', label: 'Fields', icon: 'list', href: '/crm/settings/fields' },
    { key: 'layouts', label: 'Layouts', icon: 'layout', href: '/crm/settings/layouts' },
    { key: 'automations', label: 'Automations', icon: 'zap', href: '/crm/settings/automations' },
    { key: 'imports', label: 'Imports', icon: 'upload', href: '/crm/settings/mappings' },
];

// Get nav items for a specific module
export function getNavItemsForModule(module: TopModule) {
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

