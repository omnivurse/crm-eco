// ============================================================================
// Integration Marketplace - Extended Provider Catalog
// 50+ third-party integrations for CRM
// ============================================================================

import type { ProviderConfig, ConnectionType, IntegrationProvider } from './types';

// Extended provider types for marketplace
export type MarketplaceProvider = IntegrationProvider
    // Marketing Automation
    | 'mailchimp' | 'activecampaign' | 'getresponse' | 'convertkit' | 'klaviyo' | 'drip'
    // Social Media
    | 'facebook' | 'linkedin' | 'twitter' | 'instagram' | 'youtube' | 'tiktok'
    // Accounting
    | 'quickbooks' | 'xero' | 'freshbooks' | 'wave' | 'sage'
    // Customer Support
    | 'zendesk' | 'intercom' | 'freshdesk' | 'helpscout' | 'crisp' | 'drift'
    // Project Management
    | 'asana' | 'monday' | 'trello' | 'clickup' | 'notion' | 'jira' | 'basecamp'
    // Analytics
    | 'google_analytics' | 'mixpanel' | 'segment' | 'amplitude' | 'heap' | 'hotjar'
    // Lead Generation
    | 'linkedin_sales' | 'clearbit' | 'zoominfo' | 'apollo' | 'lusha' | 'hunter'
    // Forms & Surveys
    | 'typeform' | 'jotform' | 'surveymonkey' | 'google_forms' | 'formstack' | 'cognito_forms'
    // Storage
    | 'google_drive' | 'dropbox' | 'onedrive' | 'box'
    // Automation & AI
    | 'zapier' | 'make' | 'pipedream' | 'openai' | 'anthropic' | 'n8n';

export type MarketplaceCategory = ConnectionType
    | 'marketing' | 'social' | 'accounting' | 'support'
    | 'projects' | 'analytics' | 'leadgen' | 'forms'
    | 'storage' | 'automation';


// ============================================================================
// Marketplace Category Definitions
// ============================================================================

export interface CategoryInfo {
    id: MarketplaceCategory;
    name: string;
    description: string;
    icon: string;
    color: string;
    gradient: string;
}

export const MARKETPLACE_CATEGORIES: CategoryInfo[] = [
    // Communication
    { id: 'email', name: 'Email', description: 'Email delivery & marketing', icon: 'Mail', color: 'blue', gradient: 'from-blue-500 to-cyan-500' },
    { id: 'phone', name: 'Phone & SMS', description: 'Voice & text messaging', icon: 'Phone', color: 'green', gradient: 'from-green-500 to-emerald-500' },
    { id: 'video', name: 'Video Conferencing', description: 'Video meetings & webinars', icon: 'Video', color: 'purple', gradient: 'from-purple-500 to-violet-500' },
    { id: 'chat', name: 'Team Chat', description: 'Messaging & notifications', icon: 'MessageSquare', color: 'indigo', gradient: 'from-indigo-500 to-purple-500' },
    // Productivity
    { id: 'calendar', name: 'Calendar', description: 'Scheduling & calendar sync', icon: 'Calendar', color: 'orange', gradient: 'from-orange-500 to-amber-500' },
    { id: 'projects', name: 'Project Management', description: 'Tasks & workflows', icon: 'Kanban', color: 'pink', gradient: 'from-pink-500 to-rose-500' },
    { id: 'storage', name: 'Cloud Storage', description: 'Files & documents', icon: 'Cloud', color: 'sky', gradient: 'from-sky-500 to-blue-500' },
    // Sales & Marketing
    { id: 'marketing', name: 'Marketing Automation', description: 'Campaigns & email lists', icon: 'Target', color: 'amber', gradient: 'from-amber-500 to-orange-500' },
    { id: 'social', name: 'Social Media', description: 'Social platforms', icon: 'Share2', color: 'cyan', gradient: 'from-cyan-500 to-teal-500' },
    { id: 'leadgen', name: 'Lead Generation', description: 'Prospect data & enrichment', icon: 'UserPlus', color: 'lime', gradient: 'from-lime-500 to-green-500' },
    { id: 'forms', name: 'Forms & Surveys', description: 'Data collection', icon: 'ClipboardList', color: 'violet', gradient: 'from-violet-500 to-purple-500' },
    // Business Operations
    { id: 'commerce', name: 'E-Commerce', description: 'Online stores', icon: 'ShoppingBag', color: 'emerald', gradient: 'from-emerald-500 to-teal-500' },
    { id: 'payments', name: 'Payments', description: 'Payment processing', icon: 'CreditCard', color: 'slate', gradient: 'from-slate-500 to-gray-500' },
    { id: 'accounting', name: 'Accounting', description: 'Finance & invoicing', icon: 'Calculator', color: 'teal', gradient: 'from-teal-500 to-cyan-500' },
    { id: 'esign', name: 'E-Signatures', description: 'Document signing', icon: 'PenTool', color: 'yellow', gradient: 'from-yellow-500 to-amber-500' },
    // Customer & Analytics
    { id: 'support', name: 'Customer Support', description: 'Help desk & chat', icon: 'Headphones', color: 'rose', gradient: 'from-rose-500 to-pink-500' },
    { id: 'analytics', name: 'Analytics', description: 'Data & insights', icon: 'BarChart3', color: 'fuchsia', gradient: 'from-fuchsia-500 to-pink-500' },
    { id: 'crm_sync', name: 'CRM Sync', description: 'External CRM data', icon: 'RefreshCw', color: 'red', gradient: 'from-red-500 to-rose-500' },
    // Automation
    { id: 'automation', name: 'Automation & AI', description: 'Workflows & AI tools', icon: 'Zap', color: 'amber', gradient: 'from-amber-400 to-yellow-500' },
];

// ============================================================================
// Extended Provider Configurations
// ============================================================================

export interface MarketplaceProviderConfig extends Omit<ProviderConfig, 'id' | 'connectionType'> {
    id: MarketplaceProvider;
    category: MarketplaceCategory;
    popular?: boolean;
    new?: boolean;
    logoUrl?: string;
}

export const MARKETPLACE_PROVIDERS: MarketplaceProviderConfig[] = [
    // ============ MARKETING AUTOMATION ============
    { id: 'mailchimp', name: 'Mailchimp', description: 'Email marketing & automation', category: 'marketing', icon: 'mail', color: 'yellow', authType: 'oauth', features: ['email_campaigns', 'lists', 'automation'], popular: true, docsUrl: 'https://mailchimp.com/developer/' },
    { id: 'activecampaign', name: 'ActiveCampaign', description: 'Marketing automation platform', category: 'marketing', icon: 'zap', color: 'blue', authType: 'api_key', features: ['email', 'automation', 'crm'], popular: true, docsUrl: 'https://developers.activecampaign.com/' },
    { id: 'getresponse', name: 'GetResponse', description: 'Email marketing solution', category: 'marketing', icon: 'mail', color: 'cyan', authType: 'api_key', features: ['email', 'landing_pages', 'webinars'], docsUrl: 'https://apidocs.getresponse.com/' },
    { id: 'convertkit', name: 'ConvertKit', description: 'Creator marketing platform', category: 'marketing', icon: 'send', color: 'red', authType: 'api_key', features: ['email', 'forms', 'sequences'], docsUrl: 'https://developers.convertkit.com/' },
    { id: 'klaviyo', name: 'Klaviyo', description: 'E-commerce marketing', category: 'marketing', icon: 'shopping-bag', color: 'green', authType: 'api_key', features: ['email', 'sms', 'segments'], popular: true, docsUrl: 'https://developers.klaviyo.com/' },
    { id: 'drip', name: 'Drip', description: 'E-commerce CRM', category: 'marketing', icon: 'droplet', color: 'purple', authType: 'api_key', features: ['email', 'automation', 'segments'], docsUrl: 'https://developer.drip.com/' },

    // ============ SOCIAL MEDIA ============
    { id: 'facebook', name: 'Facebook', description: 'Facebook Pages & Ads', category: 'social', icon: 'facebook', color: 'blue', authType: 'oauth', features: ['pages', 'ads', 'messenger'], popular: true, docsUrl: 'https://developers.facebook.com/' },
    { id: 'linkedin', name: 'LinkedIn', description: 'Professional networking', category: 'social', icon: 'linkedin', color: 'blue', authType: 'oauth', features: ['posts', 'company_pages', 'ads'], popular: true, docsUrl: 'https://developer.linkedin.com/' },
    { id: 'twitter', name: 'X (Twitter)', description: 'Social media platform', category: 'social', icon: 'twitter', color: 'slate', authType: 'oauth', features: ['tweets', 'dms', 'analytics'], popular: true, docsUrl: 'https://developer.twitter.com/' },
    { id: 'instagram', name: 'Instagram', description: 'Photo & video sharing', category: 'social', icon: 'instagram', color: 'pink', authType: 'oauth', features: ['posts', 'stories', 'insights'], popular: true, docsUrl: 'https://developers.facebook.com/docs/instagram-api/' },
    { id: 'youtube', name: 'YouTube', description: 'Video platform', category: 'social', icon: 'youtube', color: 'red', authType: 'oauth', features: ['videos', 'channels', 'analytics'], docsUrl: 'https://developers.google.com/youtube' },
    { id: 'tiktok', name: 'TikTok', description: 'Short-form video', category: 'social', icon: 'music', color: 'slate', authType: 'oauth', features: ['videos', 'ads'], new: true, docsUrl: 'https://developers.tiktok.com/' },

    // ============ ACCOUNTING ============
    { id: 'quickbooks', name: 'QuickBooks', description: 'Accounting software', category: 'accounting', icon: 'calculator', color: 'green', authType: 'oauth', features: ['invoices', 'expenses', 'reports'], popular: true, docsUrl: 'https://developer.intuit.com/' },
    { id: 'xero', name: 'Xero', description: 'Cloud accounting', category: 'accounting', icon: 'trending-up', color: 'blue', authType: 'oauth', features: ['invoices', 'bank_feeds', 'payroll'], popular: true, docsUrl: 'https://developer.xero.com/' },
    { id: 'freshbooks', name: 'FreshBooks', description: 'Invoicing & accounting', category: 'accounting', icon: 'file-text', color: 'green', authType: 'oauth', features: ['invoices', 'expenses', 'time_tracking'], docsUrl: 'https://www.freshbooks.com/api/' },
    { id: 'wave', name: 'Wave', description: 'Free accounting', category: 'accounting', icon: 'activity', color: 'blue', authType: 'oauth', features: ['invoices', 'accounting', 'receipts'], docsUrl: 'https://developer.waveapps.com/' },
    { id: 'sage', name: 'Sage', description: 'Business management', category: 'accounting', icon: 'briefcase', color: 'green', authType: 'oauth', features: ['accounting', 'payroll', 'payments'], docsUrl: 'https://developer.sage.com/' },

    // ============ CUSTOMER SUPPORT ============
    { id: 'zendesk', name: 'Zendesk', description: 'Customer service platform', category: 'support', icon: 'headphones', color: 'green', authType: 'oauth', features: ['tickets', 'chat', 'knowledge_base'], popular: true, docsUrl: 'https://developer.zendesk.com/' },
    { id: 'intercom', name: 'Intercom', description: 'Customer messaging', category: 'support', icon: 'message-circle', color: 'blue', authType: 'oauth', features: ['chat', 'bots', 'help_center'], popular: true, docsUrl: 'https://developers.intercom.com/' },
    { id: 'freshdesk', name: 'Freshdesk', description: 'Help desk software', category: 'support', icon: 'life-buoy', color: 'green', authType: 'api_key', features: ['tickets', 'chat', 'phone'], docsUrl: 'https://developers.freshdesk.com/' },
    { id: 'helpscout', name: 'Help Scout', description: 'Help desk for teams', category: 'support', icon: 'help-circle', color: 'blue', authType: 'oauth', features: ['mailbox', 'docs', 'beacon'], docsUrl: 'https://developer.helpscout.com/' },
    { id: 'crisp', name: 'Crisp', description: 'Business messaging', category: 'support', icon: 'message-square', color: 'purple', authType: 'api_key', features: ['chat', 'inbox', 'knowledge'], new: true, docsUrl: 'https://docs.crisp.chat/' },
    { id: 'drift', name: 'Drift', description: 'Conversational marketing', category: 'support', icon: 'message-circle', color: 'blue', authType: 'oauth', features: ['chat', 'bots', 'meetings'], docsUrl: 'https://devdocs.drift.com/' },

    // ============ PROJECT MANAGEMENT ============
    { id: 'asana', name: 'Asana', description: 'Work management', category: 'projects', icon: 'check-square', color: 'pink', authType: 'oauth', features: ['tasks', 'projects', 'portfolios'], popular: true, docsUrl: 'https://developers.asana.com/' },
    { id: 'monday', name: 'Monday.com', description: 'Work OS', category: 'projects', icon: 'layout', color: 'red', authType: 'oauth', features: ['boards', 'automations', 'dashboards'], popular: true, docsUrl: 'https://developer.monday.com/' },
    { id: 'trello', name: 'Trello', description: 'Kanban boards', category: 'projects', icon: 'trello', color: 'blue', authType: 'oauth', features: ['boards', 'cards', 'power_ups'], popular: true, docsUrl: 'https://developer.atlassian.com/cloud/trello/' },
    { id: 'clickup', name: 'ClickUp', description: 'All-in-one productivity', category: 'projects', icon: 'check-circle', color: 'purple', authType: 'oauth', features: ['tasks', 'docs', 'goals'], popular: true, docsUrl: 'https://clickup.com/api/' },
    { id: 'notion', name: 'Notion', description: 'Connected workspace', category: 'projects', icon: 'file-text', color: 'slate', authType: 'oauth', features: ['pages', 'databases', 'wikis'], popular: true, docsUrl: 'https://developers.notion.com/' },
    { id: 'jira', name: 'Jira', description: 'Issue tracking', category: 'projects', icon: 'bug', color: 'blue', authType: 'oauth', features: ['issues', 'sprints', 'boards'], popular: true, docsUrl: 'https://developer.atlassian.com/cloud/jira/' },
    { id: 'basecamp', name: 'Basecamp', description: 'Project management', category: 'projects', icon: 'home', color: 'green', authType: 'oauth', features: ['projects', 'todos', 'messages'], docsUrl: 'https://github.com/basecamp/bc3-api' },

    // ============ ANALYTICS ============
    { id: 'google_analytics', name: 'Google Analytics', description: 'Web analytics', category: 'analytics', icon: 'bar-chart-2', color: 'orange', authType: 'oauth', features: ['pageviews', 'events', 'conversions'], popular: true, docsUrl: 'https://developers.google.com/analytics' },
    { id: 'mixpanel', name: 'Mixpanel', description: 'Product analytics', category: 'analytics', icon: 'pie-chart', color: 'purple', authType: 'api_key', features: ['events', 'funnels', 'retention'], popular: true, docsUrl: 'https://developer.mixpanel.com/' },
    { id: 'segment', name: 'Segment', description: 'Customer data platform', category: 'analytics', icon: 'git-branch', color: 'green', authType: 'api_key', features: ['tracking', 'destinations', 'profiles'], popular: true, docsUrl: 'https://segment.com/docs/' },
    { id: 'amplitude', name: 'Amplitude', description: 'Product analytics', category: 'analytics', icon: 'activity', color: 'blue', authType: 'api_key', features: ['events', 'cohorts', 'experiments'], docsUrl: 'https://developers.amplitude.com/' },
    { id: 'heap', name: 'Heap', description: 'Digital insights', category: 'analytics', icon: 'layers', color: 'purple', authType: 'api_key', features: ['autocapture', 'funnels', 'paths'], docsUrl: 'https://developers.heap.io/' },
    { id: 'hotjar', name: 'Hotjar', description: 'Behavior analytics', category: 'analytics', icon: 'eye', color: 'red', authType: 'api_key', features: ['heatmaps', 'recordings', 'surveys'], docsUrl: 'https://help.hotjar.com/hc/en-us/categories/360003405813' },

    // ============ LEAD GENERATION ============
    { id: 'linkedin_sales', name: 'LinkedIn Sales Nav', description: 'Sales intelligence', category: 'leadgen', icon: 'user-plus', color: 'blue', authType: 'oauth', features: ['leads', 'accounts', 'insights'], popular: true, docsUrl: 'https://developer.linkedin.com/' },
    { id: 'clearbit', name: 'Clearbit', description: 'Data enrichment', category: 'leadgen', icon: 'search', color: 'blue', authType: 'api_key', features: ['enrichment', 'reveal', 'prospector'], popular: true, docsUrl: 'https://clearbit.com/docs' },
    { id: 'zoominfo', name: 'ZoomInfo', description: 'B2B database', category: 'leadgen', icon: 'database', color: 'green', authType: 'api_key', features: ['contacts', 'companies', 'intent'], popular: true, docsUrl: 'https://developers.zoominfo.com/' },
    { id: 'apollo', name: 'Apollo.io', description: 'Sales intelligence', category: 'leadgen', icon: 'target', color: 'blue', authType: 'api_key', features: ['contacts', 'sequences', 'enrichment'], popular: true, docsUrl: 'https://apolloio.github.io/apollo-api-docs/' },
    { id: 'lusha', name: 'Lusha', description: 'Contact data', category: 'leadgen', icon: 'users', color: 'purple', authType: 'api_key', features: ['contacts', 'enrichment'], docsUrl: 'https://www.lusha.com/docs/' },
    { id: 'hunter', name: 'Hunter.io', description: 'Email finder', category: 'leadgen', icon: 'mail', color: 'orange', authType: 'api_key', features: ['email_finder', 'verifier'], docsUrl: 'https://hunter.io/api-documentation' },

    // ============ FORMS & SURVEYS ============
    { id: 'typeform', name: 'Typeform', description: 'Interactive forms', category: 'forms', icon: 'clipboard', color: 'slate', authType: 'oauth', features: ['forms', 'surveys', 'quizzes'], popular: true, docsUrl: 'https://developer.typeform.com/' },
    { id: 'jotform', name: 'JotForm', description: 'Online forms', category: 'forms', icon: 'edit-3', color: 'orange', authType: 'api_key', features: ['forms', 'submissions', 'approvals'], docsUrl: 'https://api.jotform.com/docs/' },
    { id: 'surveymonkey', name: 'SurveyMonkey', description: 'Survey platform', category: 'forms', icon: 'bar-chart', color: 'green', authType: 'oauth', features: ['surveys', 'responses', 'analytics'], popular: true, docsUrl: 'https://developer.surveymonkey.com/' },
    { id: 'google_forms', name: 'Google Forms', description: 'Free form builder', category: 'forms', icon: 'file-text', color: 'purple', authType: 'oauth', features: ['forms', 'responses'], docsUrl: 'https://developers.google.com/forms' },
    { id: 'formstack', name: 'Formstack', description: 'Workplace productivity', category: 'forms', icon: 'layers', color: 'green', authType: 'oauth', features: ['forms', 'documents', 'signatures'], docsUrl: 'https://developers.formstack.com/' },
    { id: 'cognito_forms', name: 'Cognito Forms', description: 'Form builder', category: 'forms', icon: 'clipboard-list', color: 'blue', authType: 'api_key', features: ['forms', 'payments', 'workflows'], docsUrl: 'https://www.cognitoforms.com/support/' },

    // ============ CLOUD STORAGE ============
    { id: 'google_drive', name: 'Google Drive', description: 'Cloud storage', category: 'storage', icon: 'hard-drive', color: 'green', authType: 'oauth', features: ['files', 'folders', 'sharing'], popular: true, docsUrl: 'https://developers.google.com/drive' },
    { id: 'dropbox', name: 'Dropbox', description: 'File hosting', category: 'storage', icon: 'box', color: 'blue', authType: 'oauth', features: ['files', 'sync', 'sharing'], popular: true, docsUrl: 'https://www.dropbox.com/developers' },
    { id: 'onedrive', name: 'OneDrive', description: 'Microsoft cloud', category: 'storage', icon: 'cloud', color: 'blue', authType: 'oauth', features: ['files', 'sync', 'office'], popular: true, docsUrl: 'https://learn.microsoft.com/en-us/onedrive/developer/' },
    { id: 'box', name: 'Box', description: 'Enterprise storage', category: 'storage', icon: 'archive', color: 'blue', authType: 'oauth', features: ['files', 'collaboration', 'security'], docsUrl: 'https://developer.box.com/' },

    // ============ AUTOMATION & AI ============
    { id: 'zapier', name: 'Zapier', description: 'Workflow automation', category: 'automation', icon: 'zap', color: 'orange', authType: 'api_key', features: ['zaps', 'triggers', 'actions'], popular: true, docsUrl: 'https://platform.zapier.com/' },
    { id: 'make', name: 'Make (Integromat)', description: 'Visual automation', category: 'automation', icon: 'git-merge', color: 'purple', authType: 'api_key', features: ['scenarios', 'modules', 'webhooks'], popular: true, docsUrl: 'https://www.make.com/en/api-documentation' },
    { id: 'pipedream', name: 'Pipedream', description: 'Developer automation', category: 'automation', icon: 'terminal', color: 'green', authType: 'api_key', features: ['workflows', 'code', 'triggers'], docsUrl: 'https://pipedream.com/docs' },
    { id: 'openai', name: 'OpenAI', description: 'AI language models', category: 'automation', icon: 'cpu', color: 'green', authType: 'api_key', features: ['chat', 'completions', 'embeddings'], popular: true, new: true, docsUrl: 'https://platform.openai.com/docs' },
    { id: 'anthropic', name: 'Anthropic Claude', description: 'AI assistant', category: 'automation', icon: 'bot', color: 'amber', authType: 'api_key', features: ['chat', 'analysis', 'coding'], popular: true, new: true, docsUrl: 'https://docs.anthropic.com/' },
    { id: 'n8n', name: 'n8n', description: 'Self-hosted automation', category: 'automation', icon: 'workflow', color: 'orange', authType: 'api_key', features: ['workflows', 'nodes', 'webhooks'], docsUrl: 'https://docs.n8n.io/' },
];

// Get providers by category
export function getProvidersByCategory(category: MarketplaceCategory): MarketplaceProviderConfig[] {
    return MARKETPLACE_PROVIDERS.filter(p => p.category === category);
}

// Get popular providers
export function getPopularProviders(): MarketplaceProviderConfig[] {
    return MARKETPLACE_PROVIDERS.filter(p => p.popular);
}

// Get new providers
export function getNewProviders(): MarketplaceProviderConfig[] {
    return MARKETPLACE_PROVIDERS.filter(p => p.new);
}

// Search providers
export function searchProviders(query: string): MarketplaceProviderConfig[] {
    const q = query.toLowerCase();
    return MARKETPLACE_PROVIDERS.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.features.some(f => f.toLowerCase().includes(q))
    );
}
