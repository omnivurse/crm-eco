import type { GizmoTipSet } from './gizmo-types';

/**
 * Route pattern -> tip set mapping.
 *
 * Matching logic: iterate keys longest-first; the first key
 * where pathname.startsWith(key) wins. Exact '/crm' only matches
 * the dashboard root.
 *
 * To add tips for a new page, just add an entry here.
 */
export const GIZMO_TIP_REGISTRY: Record<string, GizmoTipSet> = {
  // ── Dashboard ──
  '/crm': {
    pageLabel: 'Dashboard',
    tips: [
      {
        id: 'dash-welcome',
        title: 'Welcome to your CRM!',
        body: 'This is your command center. Widgets show real-time stats on your deals, tasks, and pipeline. You can rearrange them by clicking "Edit Layout."',
        icon: 'layout-dashboard',
      },
      {
        id: 'dash-sidebar',
        title: 'Navigate with the sidebar',
        body: 'The left sidebar switches between modules. Click the arrows to collapse it for more room.',
        icon: 'panel-left',
      },
      {
        id: 'dash-smart-chat',
        title: 'Try the Smart Bar',
        body: 'The input at the bottom is more than search — type a slash command like /create contact or just describe what you want to do.',
        icon: 'terminal',
      },
    ],
  },

  // ── Contacts ──
  '/crm/modules/contacts': {
    pageLabel: 'Contacts',
    tips: [
      {
        id: 'contacts-scroll',
        title: 'Scroll sideways for more',
        body: 'Your contacts table has many fields. Scroll horizontally to see them all, or hold Shift + scroll wheel for a quick sideways scroll.',
        icon: 'move-horizontal',
      },
      {
        id: 'contacts-filters',
        title: 'Filter and sort instantly',
        body: 'Click any column header to sort. Use the Filters button in the toolbar to narrow down by status, owner, date, or any custom field.',
        icon: 'filter',
      },
      {
        id: 'contacts-views',
        title: 'Save custom views',
        body: 'Set up your filters how you like, then save them as a View. Switch between views using the dropdown in the toolbar.',
        icon: 'bookmark',
      },
      {
        id: 'contacts-import',
        title: 'Import from a spreadsheet',
        body: 'Have a CSV? Click the Import button in the top-right to map columns and bring your data in bulk.',
        icon: 'upload',
      },
      {
        id: 'contacts-advisor',
        title: 'Sort by Advisor',
        body: 'Use the "By Advisor" buttons at the top to quickly group contacts by their assigned advisor.',
        icon: 'user-check',
      },
    ],
  },

  // ── Leads ──
  '/crm/modules/leads': {
    pageLabel: 'Leads',
    tips: [
      {
        id: 'leads-overview',
        title: 'Your lead pipeline',
        body: 'Leads are potential customers not yet qualified. Work through them to convert the best ones into contacts and deals.',
        icon: 'user-plus',
      },
      {
        id: 'leads-convert',
        title: 'Convert leads to contacts',
        body: 'When a lead is qualified, click "Convert" to turn them into a Contact + Deal in one step.',
        icon: 'arrow-right-left',
      },
      {
        id: 'leads-scoring',
        title: 'Lead scoring',
        body: 'Leads are scored based on engagement. Higher scores mean warmer prospects — focus on those first.',
        icon: 'flame',
      },
    ],
  },

  // ── Deals ──
  '/crm/modules/deals': {
    pageLabel: 'Deals',
    tips: [
      {
        id: 'deals-kanban',
        title: 'Drag deals between stages',
        body: 'Switch to Kanban view to see your pipeline visually. Drag cards between columns to update deal stages instantly.',
        icon: 'columns',
      },
      {
        id: 'deals-stages',
        title: 'Customize your stages',
        body: 'Deal stages are configurable. Go to Settings > Modules to add, rename, or reorder stages to match your sales process.',
        icon: 'settings',
      },
    ],
  },

  // ── Accounts ──
  '/crm/modules/accounts': {
    pageLabel: 'Accounts',
    tips: [
      {
        id: 'accounts-hierarchy',
        title: 'Organization hierarchy',
        body: 'Accounts represent companies. Link contacts and deals to accounts to see all activity for an organization in one place.',
        icon: 'building-2',
      },
      {
        id: 'accounts-linking',
        title: 'Link related records',
        body: 'Open any account to see linked contacts, deals, and tasks. Use the "Link" button on the record page to connect them.',
        icon: 'link',
      },
    ],
  },

  // ── Pipeline ──
  '/crm/pipeline': {
    pageLabel: 'Pipeline',
    tips: [
      {
        id: 'pipeline-view',
        title: 'Your visual pipeline',
        body: 'This is a bird\'s-eye view of all active deals across stages. Hover over any bar to see details, or click to jump in.',
        icon: 'trending-up',
      },
    ],
  },

  // ── Tasks ──
  '/crm/tasks': {
    pageLabel: 'Tasks',
    tips: [
      {
        id: 'tasks-types',
        title: 'Tasks, calls, and meetings',
        body: 'Activities come in three flavors: tasks, calls, and meetings. Each has its own fields like call duration or meeting location.',
        icon: 'check-square',
      },
      {
        id: 'tasks-link',
        title: 'Link tasks to records',
        body: 'Every task can be linked to a contact, lead, or deal. This keeps your activity history in one place on the record timeline.',
        icon: 'link',
      },
    ],
  },

  // ── Campaigns ──
  '/crm/campaigns': {
    pageLabel: 'Email Campaigns',
    tips: [
      {
        id: 'campaigns-create',
        title: 'Send your first campaign',
        body: 'Click "New Campaign" to compose an email, select recipients from your contacts, and schedule or send immediately.',
        icon: 'mail',
      },
      {
        id: 'campaigns-tracking',
        title: 'Track opens and clicks',
        body: 'Every campaign tracks delivery, opens, clicks, and bounces in real time. Check the Analytics tab after sending.',
        icon: 'bar-chart',
      },
    ],
  },

  // ── Sequences ──
  '/crm/sequences': {
    pageLabel: 'Sequences',
    tips: [
      {
        id: 'sequences-intro',
        title: 'Automate your follow-ups',
        body: 'Sequences are multi-step email drip campaigns. Set up timed delays between emails and let the system follow up automatically.',
        icon: 'repeat',
      },
    ],
  },

  // ── Reports ──
  '/crm/reports': {
    pageLabel: 'Reports',
    tips: [
      {
        id: 'reports-custom',
        title: 'Build custom reports',
        body: 'Click "Create Report" to build from scratch. Choose your module, select columns, add filters, pick a chart type, and save.',
        icon: 'pie-chart',
      },
      {
        id: 'reports-templates',
        title: 'Start from a template',
        body: 'Not sure where to start? Browse report templates for common scenarios like monthly sales, lead conversion, and pipeline health.',
        icon: 'file-text',
      },
    ],
  },

  // ── Inbox ──
  '/crm/inbox': {
    pageLabel: 'Inbox',
    tips: [
      {
        id: 'inbox-unified',
        title: 'Your unified inbox',
        body: 'All emails, SMS, and notifications land here. Click any message to see the full conversation thread and linked CRM record.',
        icon: 'inbox',
      },
      {
        id: 'inbox-reply',
        title: 'Reply from here',
        body: 'You can reply to emails and SMS directly from the inbox without leaving the page. Your responses are tracked on the contact timeline.',
        icon: 'reply',
      },
    ],
  },

  // ── Import ──
  '/crm/import': {
    pageLabel: 'Import',
    tips: [
      {
        id: 'import-csv',
        title: 'Map your CSV columns',
        body: 'Upload a CSV and map each column to a CRM field. The system will show a preview before importing so you can catch any issues.',
        icon: 'upload',
      },
      {
        id: 'import-duplicates',
        title: 'Duplicate detection',
        body: 'The importer checks for duplicates by email and phone. Matching records are updated instead of creating new ones.',
        icon: 'copy',
      },
    ],
  },

  // ── Calendar ──
  '/crm/calendar': {
    pageLabel: 'Calendar',
    tips: [
      {
        id: 'calendar-sync',
        title: 'Sync with Google or Outlook',
        body: 'Connect your calendar from Settings > Integrations to see your meetings alongside CRM tasks and activities.',
        icon: 'calendar',
      },
    ],
  },

  // ── Settings ──
  '/crm/settings': {
    pageLabel: 'Settings',
    tips: [
      {
        id: 'settings-overview',
        title: 'Configure your CRM',
        body: 'Manage modules, custom fields, layouts, automations, users, and import mappings here. Changes apply to your entire organization.',
        icon: 'settings',
      },
    ],
  },

  // ── Documents ──
  '/crm/documents': {
    pageLabel: 'Documents',
    tips: [
      {
        id: 'docs-upload',
        title: 'Upload and organize files',
        body: 'Drag files here or click Upload to store documents. You can link them to contacts, deals, or accounts for easy access.',
        icon: 'file-text',
      },
    ],
  },

  // ── Analytics ──
  '/crm/analytics': {
    pageLabel: 'Analytics',
    tips: [
      {
        id: 'analytics-dashboards',
        title: 'Build custom dashboards',
        body: 'Drag widgets onto the canvas to create personalized analytics views. Track KPIs, conversion rates, and team performance.',
        icon: 'bar-chart-2',
      },
    ],
  },
};

/**
 * Find the best-matching tip set for a given pathname.
 * Matches the longest prefix first for specificity.
 */
export function getTipSetForPath(pathname: string): { routeKey: string; tipSet: GizmoTipSet } | null {
  const sortedKeys = Object.keys(GIZMO_TIP_REGISTRY).sort((a, b) => b.length - a.length);

  for (const key of sortedKeys) {
    // Exact match for dashboard root
    if (key === '/crm' && pathname === '/crm') {
      return { routeKey: key, tipSet: GIZMO_TIP_REGISTRY[key] };
    }
    // Prefix match for everything else
    if (key !== '/crm' && pathname.startsWith(key)) {
      return { routeKey: key, tipSet: GIZMO_TIP_REGISTRY[key] };
    }
  }

  return null;
}
