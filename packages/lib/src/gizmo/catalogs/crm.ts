import type { GizmoHowto, GizmoPlace } from '../types';

/** Static CRM aliases. Live adapter merges role-gated palette pages on top. */
export const CRM_PLACES: GizmoPlace[] = [
  { id: 'crm-home', title: 'CRM Home', href: '/crm', aliases: ['home', 'dashboard', 'start'] },
  { id: 'crm-inbox', title: 'Inbox', href: '/crm/inbox', aliases: ['mail', 'email', 'messages'] },
  { id: 'crm-workqueue', title: 'Workqueue', href: '/crm/workqueue', aliases: ['queue', 'tasks queue'] },
  { id: 'crm-reports', title: 'Reports', href: '/crm/reports', aliases: ['reporting', 'advisor reports'] },
  { id: 'crm-import', title: 'Import', href: '/crm/import', aliases: ['import contacts', 'csv', 'upload'] },
  { id: 'crm-members', title: 'Members', href: '/crm/modules/members', aliases: ['member list', 'sharing members'] },
  { id: 'crm-contacts', title: 'Contacts', href: '/crm/modules/contacts', aliases: ['people', 'contact list'] },
  { id: 'crm-leads', title: 'Leads', href: '/crm/modules/leads', aliases: ['prospects'] },
  { id: 'crm-deals', title: 'Deals', href: '/crm/modules/deals', aliases: ['pipeline', 'opportunities'] },
  { id: 'crm-accounts', title: 'Accounts', href: '/crm/modules/accounts', aliases: ['companies'] },
  { id: 'crm-tasks', title: 'Tasks', href: '/crm/tasks', aliases: ['to-dos', 'todo'] },
  { id: 'crm-calendar', title: 'Calendar', href: '/crm/calendar', aliases: ['schedule'] },
  { id: 'crm-settings', title: 'Settings', href: '/crm/settings', aliases: ['preferences', 'config'] },
  {
    id: 'crm-mfa',
    title: 'Multi-factor authentication',
    href: '/crm/settings/security',
    aliases: ['mfa', '2fa', 'two factor', 'authenticator', 'security'],
    group: 'settings',
  },
  {
    id: 'crm-security',
    title: 'Security settings',
    href: '/crm/settings/security',
    aliases: ['password', 'login security'],
    group: 'settings',
  },
  { id: 'crm-learn', title: 'Learn', href: '/crm/learn', aliases: ['help', 'docs', 'how to'] },
  { id: 'crm-search', title: 'Search', href: '/crm/search', aliases: ['find records', 'global search'] },
];

export const CRM_HOWTO: GizmoHowto[] = [
  {
    id: 'crm-howto-import',
    title: 'Import contacts',
    href: '/crm/learn/contacts/importing',
    aliases: ['import contacts', 'csv import', 'upload spreadsheet', 'import'],
    steps: [
      'Open Import from the CRM sidebar or ⌘K.',
      'Download the template for that module.',
      'Map columns, then run the import.',
    ],
  },
  {
    id: 'crm-howto-search',
    title: 'Find a record',
    href: '/crm/learn/getting-started/navigation',
    aliases: ['find someone', 'command palette', 'search records'],
    steps: [
      'Press ⌘K and type a name, phone, or member number.',
      'Or ask Gizmo — same search, with a link to open the record.',
    ],
  },
  {
    id: 'crm-howto-shortcuts',
    title: 'Keyboard shortcuts',
    href: '/crm/learn/terminal/shortcuts',
    aliases: ['hotkeys', 'keyboard', 'shortcut'],
    steps: ['⌘K opens the command palette.', 'Ctrl+Space opens Gizmo.', 'Escape closes panels.'],
  },
  {
    id: 'crm-howto-pipeline',
    title: 'Work the pipeline',
    href: '/crm/learn/deals/pipeline',
    aliases: ['deals', 'kanban', 'stages'],
    steps: ['Open Deals.', 'Drag a card to change stage.', 'Open a record for the full history.'],
  },
  {
    id: 'crm-howto-members',
    title: 'Work with members',
    href: '/crm/learn/contacts',
    aliases: ['sharing members', 'member record'],
    steps: [
      'Open Members.',
      'Use search or Gizmo to jump to a member.',
      'Sharing fields stay on the member record.',
    ],
  },
];
