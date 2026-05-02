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
        id: 'dash-home-base',
        title: 'Your home base',
        body: 'Dashboard widgets summarize pipeline health, workload, and key numbers. Tailor what you see with "Edit Layout" so the first screen matches how you sell.',
        icon: 'layout-dashboard',
        learnMoreHref: '/crm/learn/getting-started/dashboard',
      },
      {
        id: 'dash-modules-nav',
        title: 'Modules & main menu',
        body: 'Use "Modules" for each record type you work in (contacts, deals, carriers, etc.). Below that are quick links—Pipeline, Inbox, Campaigns—grouped into sections.',
        icon: 'panel-left',
      },
      {
        id: 'dash-gizmo',
        title: "That's me—Gizmo",
        body: 'Click the teal light bulb when you spot it. Tips change on every screen. Dismiss tips you\'ve mastered, use "Got it" to clear a page, or "Hide" to turn me off—you can restore tips from the bottom of the sidebar.',
        icon: 'lightbulb',
      },
      {
        id: 'dash-smart-chat-ctrl',
        title: 'Smart Chat at the bottom',
        body: 'The wide field is Smart Chat (try Ctrl or Cmd + Space). Search records, jump to views, run quick navigation commands, or type what you want in plain language—it suggests next steps.',
        icon: 'terminal',
        learnMoreHref: '/crm/learn/terminal/commands',
      },
      {
        id: 'dash-learn',
        title: 'Full guides in Learn',
        body: 'For deep dives—getting started, reports, workflows, voice, and FAQs—open Learn anytime to walk through features at your own pace.',
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
        body: "This is a bird's-eye view of all active deals across stages. Hover over any bar to see details, or click to jump in.",
        icon: 'trending-up',
      },
    ],
  },

  // ── Activities & tasks (canonical URL uses /activities; /tasks redirects) ──
  '/crm/activities': {
    pageLabel: 'Activities',
    tips: [
      {
        id: 'activities-timeline',
        title: 'Activities in one timeline',
        body: 'See calls, meetings, tasks, and other touchpoints together. Filters and tabs help you zero in—use the Tasks shortcut in the sidebar for the task-only view.',
        icon: 'check-square',
      },
      {
        id: 'activities-link',
        title: 'Tied to real records',
        body: 'When an activity references a contact, deal, or other record, it shows up there too—so your team sees the whole story.',
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

  // ── Record detail (universal /crm/r/[id]) ──
  '/crm/r/': {
    pageLabel: 'Record',
    tips: [
      {
        id: 'record-overview',
        title: 'Everything about one relationship',
        body: 'This layout pulls together timeline, linked deals, attachments, notes, and custom fields—scroll sections or use tabs if your workspace splits them.',
        icon: 'file-text',
      },
      {
        id: 'record-inline-edit',
        title: 'Click fields to update',
        body: 'Many lists and statuses save as you choose them—pick a value once and it should refresh on screen right away. Text fields typically save shortly after you stop typing.',
        icon: 'pencil-line',
      },
      {
        id: 'record-connected-family',
        title: 'Link family & household records',
        body: 'In Connected Records, use Link Record to search globally (Mom’s lead vs. Kid’s membership, different modules). Pick a relationship like parent/guardian, dependent, spouse, sibling, or same household—you can open either record from your workspace.',
        icon: 'users',
      },
    ],
  },

  // ── Learn hub ──
  '/crm/learn': {
    pageLabel: 'Learn',
    tips: [
      {
        id: 'learn-structure',
        title: 'Guides for every major area',
        body: 'Use the sidebar topics to drill into onboarding, contacts, campaigns, workflows, automation, analytics, FAQs, changelog, and more—paired with videos where we have them.',
        icon: 'book-open',
      },
      {
        id: 'learn-gizmo',
        title: 'Prefer bite-sized?',
        body: 'Gizmo (the teal light bulb) delivers short contextual tips inside the CRM. Learn is where you land for full walkthroughs and reference.',
        icon: 'lightbulb',
      },
    ],
  },

  // ── Profile ──
  '/crm/profile': {
    pageLabel: 'Profile',
    tips: [
      {
        id: 'profile-self',
        title: 'Your account',
        body: 'Update display name, email preferences, signatures, or security options here—you’re editing your own profile, not the whole organization.',
        icon: 'user',
      },
    ],
  },

  // ── Global search ──
  '/crm/search': {
    pageLabel: 'Search',
    tips: [
      {
        id: 'search-wide',
        title: 'Jump across modules',
        body: 'This search spans the record types your team can access. Refine filters from the toolbar and open anything in one click.',
        icon: 'search',
      },
    ],
  },

  // ── Communications (email + SMS tabs) ──
  '/crm/communications': {
    pageLabel: 'Communications',
    tips: [
      {
        id: 'communications-tabs',
        title: 'SMS and outbound email',
        body: 'Use the tabs to switch channels or conversation types. Compose from templates where available and keep transcripts tied to CRM records.',
        icon: 'message-square',
      },
    ],
  },

  // ── Playbooks ──
  '/crm/playbooks': {
    pageLabel: 'Playbooks',
    tips: [
      {
        id: 'playbooks-intro',
        title: 'Repeatable plays',
        body: 'Build or follow guided steps your team trusts for outreach, onboarding, or handoffs—so everyone runs the same winning sequence.',
        icon: 'book-open',
      },
    ],
  },

  // ── Enrollment ──
  '/crm/enrollment': {
    pageLabel: 'Enrollment',
    tips: [
      {
        id: 'enrollment-pipeline',
        title: 'Track enrollment journeys',
        body: 'Use this area to monitor applications, statuses, and follow-ups tied to enrollment—dig into rows for details just like other modules.',
        icon: 'clipboard-list',
      },
    ],
  },

  // ── Needs ──
  '/crm/needs': {
    pageLabel: 'Needs',
    tips: [
      {
        id: 'needs-command-center',
        title: 'Member or client needs',
        body: 'Work open needs from overview or command-center views—filter by owner, urgency, or type so nobody drops a request.',
        icon: 'heart-handshake',
      },
    ],
  },

  // ── Approvals ──
  '/crm/approvals': {
    pageLabel: 'Approvals',
    tips: [
      {
        id: 'approvals-queue',
        title: 'Approve or clarify fast',
        body: 'Open each request to see context, attachments, or policy notes. Clearing the queue promptly keeps commissions and payouts on schedule.',
        icon: 'check-circle',
      },
    ],
  },

  // ── Integrations ──
  '/crm/integrations': {
    pageLabel: 'Integrations',
    tips: [
      {
        id: 'integrations-catalog',
        title: 'Connections & diagnostics',
        body: 'Link email, calendars, carriers, APIs, webhooks, and more from here. Use logs pages when troubleshooting sync or delivery failures.',
        icon: 'link',
      },
    ],
  },

  // ── Commissions ──
  '/crm/commissions': {
    pageLabel: 'Commissions',
    tips: [
      {
        id: 'commissions-snapshot',
        title: 'Performance pay in one view',
        body: 'Use filters or period switches to reconcile payouts versus deals or enrollments—you can export snapshots when Finance needs receipts.',
        icon: 'wallet',
      },
    ],
  },

  // ── Vendors ──
  '/crm/vendors': {
    pageLabel: 'Vendors',
    tips: [
      {
        id: 'vendors-connectors',
        title: 'External data vendors',
        body: 'Connect third-party feeds, monitors, or data jobs from here. Change logs and connectors help admins prove what synced and when.',
        icon: 'building-2',
      },
    ],
  },

  // ── Automations hub (narrower match than bare /crm/settings) ──
  '/crm/settings/automations': {
    pageLabel: 'Automations',
    tips: [
      {
        id: 'automations-suite',
        title: 'Flows, macros, SLA, approvals',
        body: 'This hub holds workflows, triggers, SLA timers, approvals, macros, cadences, and related tools—bookmark it if you tweak automation weekly.',
        icon: 'workflow',
      },
    ],
  },

  // ── Duplicates ──
  '/crm/duplicates': {
    pageLabel: 'Duplicates',
    tips: [
      {
        id: 'duplicates-merge',
        title: 'Merge with confidence',
        body: 'Compare potential dupes side by side—choose the surviving record carefully so timelines, payouts, and compliance stay unified.',
        icon: 'copy',
      },
    ],
  },

  // ── Imports (plural legacy path sometimes linked) ──
  '/crm/imports': {
    pageLabel: 'Imports',
    tips: [
      {
        id: 'imports-batch',
        title: 'Inbound file jobs',
        body: 'Track upload batches here—resume failed rows after fixing spreadsheets and keep admins informed with status summaries.',
        icon: 'upload',
      },
    ],
  },

  // ── Deal war rooms (URLs stay under /crm/deals/...) ──
  '/crm/deals/': {
    pageLabel: 'Deal workspace',
    tips: [
      {
        id: 'deals-war-room',
        title: 'Focused deal collaboration',
        body: 'War Room pulls the working deal team, next steps, and alerts into one tactical view. For the full record—including rich notes and linked people—open the main record from links in the header.',
        icon: 'target',
      },
    ],
  },

  // ── Forecasting ──
  '/crm/forecasting': {
    pageLabel: 'Forecasting',
    tips: [
      {
        id: 'forecasting-snapshot',
        title: 'Weighted pipeline outlook',
        body: 'Compare expected revenue, commit, and upside using the same deal data your reps maintain—drill into categories when leadership asks "what changed?"',
        icon: 'trending-up',
      },
    ],
  },

  // ── Operations ──
  '/crm/operations': {
    pageLabel: 'Operations',
    tips: [
      {
        id: 'operations-control',
        title: 'Internal run-the-business',
        body: "Operations views surface queues, SLAs, or back-office work your org tracks—pair it with Approvals and Tasks when you're closing the loop across teams.",
        icon: 'gauge',
      },
    ],
  },

  // ── Healthcare / networks (when enabled) ──
  '/crm/healthcare': {
    pageLabel: 'Healthcare',
    tips: [
      {
        id: 'healthcare-networks',
        title: 'Networks & directory',
        body: 'Explore provider or network records your team curates—many roll up to eligibility, referrals, or quoting tools elsewhere in the platform.',
        icon: 'heart-pulse',
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
