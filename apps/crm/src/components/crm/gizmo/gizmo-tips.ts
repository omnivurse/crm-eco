import type { GizmoTipSet } from './gizmo-types';

/**
 * Route pattern -> tip set mapping.
 *
 * Matching logic: iterate keys longest-first; the first key
 * where pathname.startsWith(key) wins. Exact '/crm' only matches
 * the dashboard root.
 *
 * To add tips for a new page, just add an entry here.
 *
 * Last reviewed: 2026-05-11
 */
export const GIZMO_TIP_REGISTRY: Record<string, GizmoTipSet> = {
  // ── Dashboard ──
  '/crm': {
    pageLabel: 'Dashboard',
    tips: [
      {
        id: 'dash-home-base',
        title: 'Your command center',
        body: 'Dashboard widgets show pipeline health, open tasks, and key metrics at a glance. Everything updates in real time as your team works.',
        icon: 'layout-dashboard',
        learnMoreHref: '/crm/learn/getting-started/dashboard',
      },
      {
        id: 'dash-smart-chat',
        title: 'Smart Chat (Ctrl + Space)',
        body: 'The search bar at the bottom is Smart Chat. Press Ctrl + Space (or Cmd + Space on Mac) to open it from anywhere. Search records, jump to pages, or type what you need in plain language.',
        icon: 'terminal',
        learnMoreHref: '/crm/learn/terminal/commands',
      },
      {
        id: 'dash-sidebar-nav',
        title: 'Sidebar navigation',
        body: 'The left sidebar organizes everything: People (Members, Advisors, Leads), Service, Needs, Enrollment, Analytics, Operations, and Admin settings. Click any section to jump in.',
        icon: 'panel-left',
      },
      {
        id: 'dash-gizmo-intro',
        title: "Hi, I'm Gizmo",
        body: "I show helpful tips on every page. Dismiss tips you've learned with \"Got it,\" or hide me entirely — you can always bring me back from the sidebar footer.",
        icon: 'lightbulb',
      },
      {
        id: 'dash-learn-hub',
        title: 'Need a deeper walkthrough?',
        body: 'Open Learn from the sidebar for full guides on contacts, deals, workflows, reports, and more. Gizmo gives you quick tips — Learn gives you the full story.',
        icon: 'graduation-cap',
        learnMoreHref: '/crm/learn',
      },
    ],
  },

  // ── Contacts ──
  '/crm/modules/contacts': {
    pageLabel: 'Contacts',
    tips: [
      {
        id: 'contacts-scroll',
        title: 'Scroll sideways for more columns',
        body: 'Your contacts table has many fields. Scroll horizontally to see them all, or hold Shift + mouse wheel for quick sideways scrolling.',
        icon: 'move-horizontal',
      },
      {
        id: 'contacts-filters',
        title: 'Filter and sort',
        body: 'Click any column header to sort. Use the Filters button in the toolbar to narrow by status, owner, date, advisor, or any custom field.',
        icon: 'filter',
      },
      {
        id: 'contacts-views',
        title: 'Save custom views',
        body: 'Set up your filters, then save them as a View. Switch between saved views using the dropdown — great for "My Active Clients" or "Needs Follow-up."',
        icon: 'bookmark',
      },
      {
        id: 'contacts-import',
        title: 'Import from a spreadsheet',
        body: 'Click Import in the toolbar to upload a CSV. Map your columns to CRM fields, preview the data, then import. Duplicates are detected by email and phone.',
        icon: 'upload',
      },
      {
        id: 'contacts-bulk',
        title: 'Bulk actions',
        body: 'Select multiple records with checkboxes, then use Bulk Update or Mass Delete from the More menu to make changes across many records at once.',
        icon: 'layers',
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
        body: 'Leads are potential customers not yet qualified. Work through them here — the best ones get converted into Contacts and Deals.',
        icon: 'user-plus',
      },
      {
        id: 'leads-convert',
        title: 'Convert a lead',
        body: 'When a lead is qualified, open their record and click the green "Convert" button in the header. This creates a Contact (and optionally a Deal) in one step.',
        icon: 'arrow-right-left',
      },
      {
        id: 'leads-board',
        title: 'Board vs. list view',
        body: 'Switch between list and board (Kanban) views using the toggle in the toolbar. Board view lets you drag leads between stages visually.',
        icon: 'columns',
      },
      {
        id: 'leads-saved-views',
        title: 'Saved views for leads',
        body: 'Create saved views to quickly filter leads — for example "Hot Leads This Week" or "Uncontacted." Your views are private to your account.',
        icon: 'bookmark',
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
        body: 'Switch to Kanban view to see your pipeline visually. Drag deal cards between columns to update their stage instantly.',
        icon: 'columns',
      },
      {
        id: 'deals-pipeline',
        title: 'Pipeline view',
        body: 'Use the Pipeline page (in the sidebar under Sales) for a bird\'s-eye view of all deals across stages with revenue totals.',
        icon: 'trending-up',
      },
      {
        id: 'deals-stages',
        title: 'Customize deal stages',
        body: 'Go to Settings > Pipelines to add, rename, reorder, or color-code your deal stages to match your sales process.',
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
        title: 'Company-level records',
        body: 'Accounts represent companies or organizations. Link contacts and deals to an account to see all activity for that company in one place.',
        icon: 'building-2',
      },
      {
        id: 'accounts-linking',
        title: 'Link related records',
        body: 'Open any account, go to the Connected Records tab, and click "+ Link Record" to connect contacts, deals, or other records to this account.',
        icon: 'link',
      },
    ],
  },

  // ── Pipeline ──
  '/crm/pipeline': {
    pageLabel: 'Pipeline',
    tips: [
      {
        id: 'pipeline-overview',
        title: 'Pipeline at a glance',
        body: "See all active deals across stages with revenue totals. Hover over any bar for details, or click to drill into that stage's deals.",
        icon: 'trending-up',
      },
    ],
  },

  // ── Activities & Tasks ──
  '/crm/activities': {
    pageLabel: 'Activities',
    tips: [
      {
        id: 'activities-timeline',
        title: 'All touchpoints in one place',
        body: 'Calls, meetings, tasks, and emails are combined here. Use the tabs to filter by type, or use the Tasks shortcut in the sidebar for a task-only view.',
        icon: 'check-square',
      },
      {
        id: 'activities-linked',
        title: 'Linked to records',
        body: 'Activities are tied to contacts, deals, and accounts — so when you log a call here, it also appears on that contact\'s timeline.',
        icon: 'link',
      },
    ],
  },

  // ── Tasks ──
  '/crm/tasks': {
    pageLabel: 'Tasks',
    tips: [
      {
        id: 'tasks-manage',
        title: 'Your task list',
        body: 'View and manage all your tasks. Create new ones with the "+ New" button, set priorities and due dates, and mark them complete as you go.',
        icon: 'check-square',
      },
    ],
  },

  // ── Calendar ──
  '/crm/calendar': {
    pageLabel: 'Calendar',
    tips: [
      {
        id: 'calendar-overview',
        title: 'Your CRM calendar',
        body: 'See tasks, meetings, and activities on a calendar view. Connect Google or Outlook from Settings > Integrations to sync external events.',
        icon: 'calendar',
      },
    ],
  },

  // ── Scheduling ──
  '/crm/scheduling': {
    pageLabel: 'Scheduling',
    tips: [
      {
        id: 'scheduling-links',
        title: 'Booking links',
        body: 'Create shareable scheduling links so prospects and clients can book time with you. Set availability, meeting types, and durations — then share the link.',
        icon: 'calendar',
      },
    ],
  },

  // ── Inbox ──
  '/crm/inbox': {
    pageLabel: 'Inbox',
    tips: [
      {
        id: 'inbox-unified',
        title: 'Unified inbox',
        body: 'All emails and notifications land here. Click any message to see the full thread and the linked CRM record. Reply directly without leaving the page.',
        icon: 'inbox',
      },
      {
        id: 'inbox-compose',
        title: 'Compose from inbox',
        body: 'Click "Compose" to send a new email. Your responses are automatically tracked on the contact\'s timeline.',
        icon: 'reply',
      },
    ],
  },

  // ── Campaigns ──
  '/crm/campaigns': {
    pageLabel: 'Email Campaigns',
    tips: [
      {
        id: 'campaigns-create',
        title: 'Send a campaign',
        body: 'Click "New Campaign" to compose an email, select recipients from your contacts, and schedule or send immediately.',
        icon: 'mail',
      },
      {
        id: 'campaigns-analytics',
        title: 'Track performance',
        body: 'Every campaign tracks delivery, opens, clicks, and bounces in real time. Check the Analytics tab after sending to see results.',
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
        title: 'Automated follow-ups',
        body: 'Sequences are multi-step email drip campaigns with timed delays. Build a sequence once, then enroll contacts — the system follows up automatically.',
        icon: 'repeat',
      },
    ],
  },

  // ── Communications (SMS + email) ──
  '/crm/communications': {
    pageLabel: 'Communications',
    tips: [
      {
        id: 'communications-channels',
        title: 'SMS and outbound email',
        body: 'Switch between channels using the tabs. Send messages from templates and keep all conversations tied to CRM records for a complete history.',
        icon: 'message-square',
      },
    ],
  },

  // ── Reports ──
  '/crm/reports': {
    pageLabel: 'Reports',
    tips: [
      {
        id: 'reports-templates',
        title: 'Start with templates',
        body: 'Browse report templates for common scenarios: pipeline health, lead conversion, advisor performance, and more. Customize any template to fit your needs.',
        icon: 'file-text',
      },
      {
        id: 'reports-builder',
        title: 'Build custom reports',
        body: 'Click "Create Report" to build from scratch. Pick a module, choose columns, add filters, select a chart type, and save.',
        icon: 'pie-chart',
      },
      {
        id: 'reports-schedule',
        title: 'Schedule reports',
        body: 'Set any saved report to run on a schedule and deliver results by email — great for weekly pipeline reviews or monthly summaries.',
        icon: 'clock',
      },
    ],
  },

  // ── Analytics ──
  '/crm/analytics': {
    pageLabel: 'Analytics',
    tips: [
      {
        id: 'analytics-dashboards',
        title: 'Performance dashboards',
        body: 'Track KPIs, conversion rates, and team performance. The Leaderboard view ranks advisors and reps by their key metrics.',
        icon: 'bar-chart-2',
      },
    ],
  },

  // ── Commissions ──
  '/crm/commissions': {
    pageLabel: 'Commissions',
    tips: [
      {
        id: 'commissions-overview',
        title: 'Commission tracking',
        body: 'View pending and paid commissions. Use period filters to reconcile payouts against deals or enrollments. Export data when Finance needs receipts.',
        icon: 'wallet',
      },
    ],
  },

  // ── Import ──
  '/crm/import': {
    pageLabel: 'Import',
    tips: [
      {
        id: 'import-csv',
        title: 'Import your data',
        body: 'Upload a CSV, map each column to a CRM field, and preview before importing. The system detects duplicates by email and phone — matches are updated, not duplicated.',
        icon: 'upload',
      },
    ],
  },

  // ── Duplicates ──
  '/crm/duplicates': {
    pageLabel: 'Duplicates',
    tips: [
      {
        id: 'duplicates-review',
        title: 'Review duplicate records',
        body: 'Compare potential duplicates side by side. Choose the surviving record carefully — timelines, notes, and relationships are merged into the keeper.',
        icon: 'copy',
      },
      {
        id: 'duplicates-dismiss',
        title: 'Not a duplicate?',
        body: 'If two records are genuinely different people, click Dismiss to remove them from this list. They won\'t be flagged again.',
        icon: 'x-circle',
      },
    ],
  },

  // ── Data Health ──
  '/crm/data-health': {
    pageLabel: 'Data Health',
    tips: [
      {
        id: 'data-health-score',
        title: 'One honest number',
        body: 'The score sweeps every record with deterministic checks — nothing here changes your data. Open "What moves this number" to see exactly how it is calculated.',
        icon: 'heart-pulse',
      },
      {
        id: 'data-health-act',
        title: 'Every card links to the fix',
        body: 'Each check explains what it found in plain language. Where a fix screen exists — like Review Duplicates or Dropdown lists — the card links you straight there.',
        icon: 'lightbulb',
      },
    ],
  },

  // ── Documents ──
  '/crm/documents': {
    pageLabel: 'Documents',
    tips: [
      {
        id: 'docs-upload',
        title: 'Upload and organize',
        body: 'Drag files here or click Upload. You can link documents to contacts, deals, or accounts so your team always finds what they need.',
        icon: 'file-text',
      },
    ],
  },

  // ── Enrollment ──
  '/crm/enrollment': {
    pageLabel: 'Enrollment',
    tips: [
      {
        id: 'enrollment-track',
        title: 'Track enrollment journeys',
        body: 'Monitor applications, follow-ups, and statuses here. Click any enrollment row to see full details including member info, plan, and advisor.',
        icon: 'clipboard-list',
      },
    ],
  },

  // ── Needs ──
  '/crm/needs': {
    pageLabel: 'Needs',
    tips: [
      {
        id: 'needs-overview',
        title: 'Member need requests',
        body: 'Track open needs from the overview or command-center view. Filter by owner, urgency, or type to make sure nothing falls through the cracks.',
        icon: 'heart-handshake',
      },
      {
        id: 'needs-command-center',
        title: 'Command center view',
        body: 'Click "Command Center" for a focused triage view that surfaces the most urgent needs first with quick-action buttons.',
        icon: 'gauge',
      },
    ],
  },

  // ── Approvals ──
  '/crm/approvals': {
    pageLabel: 'Approvals',
    tips: [
      {
        id: 'approvals-queue',
        title: 'Clear your approval queue',
        body: 'Open each request to see context and attachments. Approve or request clarification quickly — clearing the queue keeps commissions and payouts on schedule.',
        icon: 'check-circle',
      },
    ],
  },

  // ── Workqueue ──
  '/crm/workqueue': {
    pageLabel: 'Workqueue',
    tips: [
      {
        id: 'workqueue-overview',
        title: 'Your all-in-one work list',
        body: 'The Workqueue combines approvals, follow-ups, overdue tasks, and action items into one prioritized list so you always know what to do next.',
        icon: 'layers',
      },
    ],
  },

  // ── Playbooks ──
  '/crm/playbooks': {
    pageLabel: 'Playbooks',
    tips: [
      {
        id: 'playbooks-intro',
        title: 'Repeatable sales plays',
        body: 'Build step-by-step guides your team follows for outreach, onboarding, or handoffs. Everyone runs the same winning process.',
        icon: 'book-open',
      },
      {
        id: 'playbooks-create',
        title: 'Create a playbook',
        body: 'Click "New Playbook" to define steps, assign owners, and set timelines. Then attach it to deals or enrollments to keep your team on track.',
        icon: 'plus',
      },
    ],
  },

  // ── Products & Quotes ──
  '/crm/products': {
    pageLabel: 'Products',
    tips: [
      {
        id: 'products-catalog',
        title: 'Product catalog',
        body: 'Manage your products and pricing here. Link products to deals and quotes so revenue tracking stays accurate.',
        icon: 'package',
      },
    ],
  },

  '/crm/quotes': {
    pageLabel: 'Quotes',
    tips: [
      {
        id: 'quotes-create',
        title: 'Generate quotes',
        body: 'Create professional quotes from your product catalog. Link them to deals and contacts, then share with prospects.',
        icon: 'file-text',
      },
    ],
  },

  // ── Vendors ──
  '/crm/vendors': {
    pageLabel: 'Vendors',
    tips: [
      {
        id: 'vendors-manage',
        title: 'External data vendors',
        body: 'Connect third-party data feeds and sync jobs. Use the Connectors, Jobs, Changes, and Upload tabs to manage your vendor integrations.',
        icon: 'building-2',
      },
    ],
  },

  // ── Integrations ──
  '/crm/integrations': {
    pageLabel: 'Integrations',
    tips: [
      {
        id: 'integrations-connect',
        title: 'Connect your tools',
        body: 'Link email, calendars, carriers, APIs, and webhooks from here. Check the logs when troubleshooting sync or delivery issues.',
        icon: 'link',
      },
    ],
  },

  // ── Search ──
  '/crm/search': {
    pageLabel: 'Search',
    tips: [
      {
        id: 'search-global',
        title: 'Search across everything',
        body: 'This search spans all modules — contacts, leads, deals, accounts, and more. Use the filters in the toolbar to narrow results.',
        icon: 'search',
      },
    ],
  },

  // ── Pipeline settings ──
  '/crm/settings/pipelines': {
    pageLabel: 'Pipelines',
    tips: [
      {
        id: 'pipelines-manage',
        title: 'Manage your pipelines',
        body: 'Add, rename, reorder, or color-code pipeline stages. Changes apply to all deals in that pipeline. You can create multiple pipelines for different sales processes.',
        icon: 'git-branch',
      },
    ],
  },

  // ── Automations hub ──
  '/crm/settings/automations': {
    pageLabel: 'Automations',
    tips: [
      {
        id: 'automations-hub',
        title: 'Your automation toolkit',
        body: 'Workflows, rules, macros, SLA timers, scoring, approvals, cadences, and web forms — all in one hub. Start with Workflows to create trigger-based automations.',
        icon: 'workflow',
      },
    ],
  },

  // ── My Carriers ──
  '/crm/settings/my-carriers': {
    pageLabel: 'My Carriers',
    tips: [
      {
        id: 'carriers-manage',
        title: 'Carrier management',
        body: 'Add the carriers you work with, manage plans, set commission rates, and track certifications. This feeds into enrollment and commission calculations.',
        icon: 'shield',
      },
    ],
  },

  // ── Settings (general) ──
  '/crm/settings': {
    pageLabel: 'Settings',
    tips: [
      {
        id: 'settings-overview',
        title: 'Configure your CRM',
        body: 'Manage modules, custom fields, layouts, pipelines, automations, team members, email settings, and more. Changes apply to your entire organization.',
        icon: 'settings',
      },
      {
        id: 'settings-quick-links',
        title: 'Key settings pages',
        body: 'Modules — add or configure record types. Fields — customize data fields. Pipelines — manage deal stages. Users & Teams — manage access and roles.',
        icon: 'link',
      },
    ],
  },

  // ── Record detail (universal /crm/r/[id]) ──
  '/crm/r/': {
    pageLabel: 'Record',
    tips: [
      {
        id: 'record-inline-edit',
        title: 'Click any field to edit',
        body: 'Click directly on the title, email, phone, status, or any field to edit it in place. Changes save automatically — no need to hit a save button.',
        icon: 'pencil-line',
      },
      {
        id: 'record-tabs',
        title: 'Tabs below the header',
        body: 'Use the tabs to switch between Details, Notes, Emails, Activities, Attachments, and Connected Records. Each tab shows data specific to this record.',
        icon: 'layout-list',
      },
      {
        id: 'record-connected',
        title: 'Connect family & household records',
        body: 'Open the "Connected Records" tab, then click "+ Link Record" to search for any record across modules. Choose a relationship type like parent, dependent, spouse, or household.',
        icon: 'users',
      },
      {
        id: 'record-keyboard',
        title: 'Keyboard shortcuts',
        body: 'Press E to edit, N to add a note, T to create a task, M to send email, U to upload a file, or / to search within this record. Press ? to see all shortcuts.',
        icon: 'keyboard',
      },
      {
        id: 'record-collaboration',
        title: 'Real-time collaboration',
        body: 'See who else is viewing this record via the avatars in the header. When a teammate makes changes, you\'ll get a notification and the page refreshes automatically.',
        icon: 'users',
      },
      {
        id: 'record-attachments',
        title: 'Attach files',
        body: 'Go to the Attachments tab (or press U) to upload documents, images, or any file. Files stay linked to this record for your whole team to access.',
        icon: 'paperclip',
      },
    ],
  },

  // ── Profile ──
  '/crm/profile': {
    pageLabel: 'Profile',
    tips: [
      {
        id: 'profile-settings',
        title: 'Your account settings',
        body: 'Update your display name, email preferences, and email signature here. You\'re editing your own profile — not the organization.',
        icon: 'user',
      },
    ],
  },

  // ── Forecasting ──
  '/crm/forecasting': {
    pageLabel: 'Forecasting',
    tips: [
      {
        id: 'forecasting-overview',
        title: 'Revenue forecasting',
        body: 'Compare expected revenue, committed deals, and upside using live deal data. Drill into categories when leadership asks what changed.',
        icon: 'trending-up',
      },
    ],
  },

  // ── Operations ──
  '/crm/operations': {
    pageLabel: 'Operations',
    tips: [
      {
        id: 'operations-overview',
        title: 'Back-office operations',
        body: 'Track internal queues, SLAs, and back-office work. Pair this with Approvals and Tasks to close the loop across teams.',
        icon: 'gauge',
      },
    ],
  },

  // ── Executive ──
  '/crm/executive': {
    pageLabel: 'Executive',
    tips: [
      {
        id: 'executive-overview',
        title: 'Executive dashboard',
        body: 'High-level KPIs, trends, and performance metrics for leadership. See the big picture without digging through individual reports.',
        icon: 'crown',
      },
    ],
  },

  // ── Learn hub ──
  '/crm/learn': {
    pageLabel: 'Learn',
    tips: [
      {
        id: 'learn-guides',
        title: 'Full guides and walkthroughs',
        body: 'Browse topics in the sidebar: getting started, contacts, leads, deals, reports, workflows, sequences, terminal commands, and more.',
        icon: 'book-open',
      },
      {
        id: 'learn-vs-gizmo',
        title: 'Learn vs. Gizmo',
        body: 'Gizmo (that\'s me!) gives quick tips on each page. Learn is where you go for full walkthroughs, reference docs, and video guides.',
        icon: 'lightbulb',
      },
    ],
  },

  // ── Organizer ──
  '/crm/organizer': {
    pageLabel: 'Organizer',
    tips: [
      {
        id: 'organizer-hub',
        title: 'Your productivity hub',
        body: 'Quick access to your tasks, notes, and recent records. Think of it as your personal workspace within the CRM.',
        icon: 'layout-dashboard',
      },
    ],
  },

  // ── Healthcare ──
  '/crm/healthcare': {
    pageLabel: 'Healthcare',
    tips: [
      {
        id: 'healthcare-networks',
        title: 'Provider networks',
        body: 'Browse and manage provider or network records. These connect to eligibility, referrals, and quoting tools elsewhere in the platform.',
        icon: 'heart-pulse',
      },
    ],
  },

  // ── Deal workspaces ──
  '/crm/deals/': {
    pageLabel: 'Deal workspace',
    tips: [
      {
        id: 'deals-war-room',
        title: 'Deal war room',
        body: 'The war room pulls your deal team, next steps, and alerts into one focused view. For the full record with notes and linked contacts, click through from the header.',
        icon: 'target',
      },
    ],
  },
};

/**
 * Find the best-matching tip set for a given pathname.
 * Matches the longest prefix first for specificity.
 */
export function getTipSetForPath(
  pathname: string
): { routeKey: string; tipSet: GizmoTipSet } | null {
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
