// Action Executor - Maps intents to CRM actions

import type { Intent, VoiceResponse, VoiceContext, NAVIGATION_DESTINATIONS } from './types';

interface ActionContext {
  navigate: (path: string) => void;
  openTerminal: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  supabase?: unknown;
  profile?: { id: string; organization_id: string };
}

// Navigation destination resolver
const navigationDestinations: Record<string, string> = {
  'dashboard': '/crm',
  'home': '/crm',
  'leads': '/crm/modules/leads',
  'lead': '/crm/modules/leads',
  'contacts': '/crm/modules/contacts',
  'contact': '/crm/modules/contacts',
  'deals': '/crm/modules/deals',
  'deal': '/crm/modules/deals',
  'pipeline': '/crm/pipeline',
  'calendar': '/crm/calendar',
  'tasks': '/crm/tasks',
  'task': '/crm/tasks',
  'inbox': '/crm/inbox',
  'reports': '/crm/reports',
  'report': '/crm/reports',
  'analytics': '/crm/analytics',
  'settings': '/crm/settings',
  'members': '/crm/modules/members',
  'member': '/crm/modules/members',
  'advisors': '/crm/modules/advisors',
  'advisor': '/crm/modules/advisors',
  'enrollments': '/crm/modules/enrollments',
  'enrollment': '/crm/modules/enrollments',
  'commissions': '/crm/commissions',
  'commission': '/crm/commissions',
  'communications': '/crm/communications',
  'communication': '/crm/communications',
  'campaigns': '/crm/campaigns',
  'campaign': '/crm/campaigns',
  'tickets': '/crm/tickets',
  'ticket': '/crm/tickets',
  'approvals': '/crm/approval',
  'approval': '/crm/approval',
  'priorities': '/crm/tasks',
  'today': '/crm',
  'templates': '/crm/reports/templates',
  'saved reports': '/crm/reports/saved',
};

// Resolve fuzzy navigation destinations
function resolveDestination(input: string): string | null {
  const normalized = input.toLowerCase().trim();

  // Direct match
  if (navigationDestinations[normalized]) {
    return navigationDestinations[normalized];
  }

  // Fuzzy match - check if input contains key
  for (const [key, path] of Object.entries(navigationDestinations)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return path;
    }
  }

  // Check for possessive forms (e.g., "today's priorities")
  const withoutPossessive = normalized.replace(/'s\s*/g, ' ').trim();
  if (navigationDestinations[withoutPossessive]) {
    return navigationDestinations[withoutPossessive];
  }

  return null;
}

// Format numbers for speech
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)} million`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(0)}k`;
  }
  return num.toString();
}

// Format currency for speech
function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)} million`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}k`;
  }
  return `$${amount.toFixed(0)}`;
}

// Period to human readable
function formatPeriod(period: string): string {
  const mappings: Record<string, string> = {
    'today': 'today',
    'yesterday': 'yesterday',
    'this_week': 'this week',
    'last_week': 'last week',
    'this_month': 'this month',
    'last_month': 'last month',
    'this_quarter': 'this quarter',
    'last_quarter': 'last quarter',
    'this_year': 'this year',
    'last_year': 'last year',
  };
  return mappings[period] || period;
}

// Main execution function
export async function executeIntent(
  intent: Intent,
  actionContext: ActionContext,
  voiceContext?: VoiceContext
): Promise<VoiceResponse> {
  const { category, action, entities } = intent;

  try {
    switch (category) {
      case 'navigation':
        return handleNavigation(action, entities, actionContext);

      case 'query':
        return await handleQuery(action, entities, actionContext);

      case 'create':
        return await handleCreate(action, entities, actionContext);

      case 'update':
        return await handleUpdate(action, entities, actionContext, voiceContext);

      case 'communicate':
        return handleCommunicate(action, entities, actionContext);

      case 'schedule':
        return await handleSchedule(action, entities, actionContext);

      case 'search':
        return handleSearch(action, entities, actionContext);

      case 'control':
        return handleControl(action, entities, actionContext);

      case 'report':
        return await handleReport(action, entities, actionContext);

      default:
        return {
          type: 'error',
          message: "I'm not sure how to help with that. Try saying 'help' for suggestions.",
          speak: true,
        };
    }
  } catch (error) {
    console.error('Voice action error:', error);
    return {
      type: 'error',
      message: 'Something went wrong. Please try again.',
      speak: true,
    };
  }
}

// Navigation handler
function handleNavigation(
  action: string,
  entities: Record<string, unknown>,
  context: ActionContext
): VoiceResponse {
  if (action === 'navigate') {
    const destination = entities.destination as string;
    const path = resolveDestination(destination);

    if (path) {
      context.navigate(path);
      const pageName = destination.charAt(0).toUpperCase() + destination.slice(1);
      return {
        type: 'success',
        message: `Opening ${pageName}`,
        speak: true,
      };
    }

    return {
      type: 'error',
      message: `I couldn't find "${destination}". Try saying "show me leads" or "go to pipeline".`,
      speak: true,
    };
  }

  if (action === 'priorities') {
    context.navigate('/crm/tasks?filter=priority');
    return {
      type: 'success',
      message: "Showing today's priority tasks",
      speak: true,
    };
  }

  return {
    type: 'info',
    message: 'Navigation command not recognized.',
    speak: false,
  };
}

// Query handler
async function handleQuery(
  action: string,
  entities: Record<string, unknown>,
  context: ActionContext
): Promise<VoiceResponse> {
  const period = formatPeriod(entities.period as string || 'today');

  switch (action) {
    case 'count': {
      const entityType = entities.type as string;
      // In a real implementation, this would query the database
      // For now, return a mock response
      const count = Math.floor(Math.random() * 50) + 5;
      return {
        type: 'result',
        message: `You have ${count} ${entityType} ${period}`,
        speak: true,
        data: { count, type: entityType, period },
      };
    }

    case 'pipeline_value': {
      // Mock pipeline value
      const value = Math.floor(Math.random() * 500000) + 100000;
      return {
        type: 'result',
        message: `Your pipeline is worth ${formatCurrency(value)}`,
        speak: true,
        data: { value },
      };
    }

    case 'closing': {
      // Mock closing deals
      const count = Math.floor(Math.random() * 10) + 1;
      const value = Math.floor(Math.random() * 200000) + 50000;
      return {
        type: 'result',
        message: `You have ${count} deals closing ${period} worth ${formatCurrency(value)}`,
        speak: true,
        data: { count, value, period },
        actions: [
          { label: 'View Deals', action: 'navigate:/crm/pipeline?filter=closing' },
        ],
      };
    }

    case 'top': {
      const entityType = entities.type as string;
      // Mock top entity
      return {
        type: 'result',
        message: `Your hottest ${entityType} is Acme Corporation with a score of 92`,
        speak: true,
        data: { name: 'Acme Corporation', score: 92 },
        actions: [
          { label: 'View Details', action: 'navigate:/crm/modules/leads/acme' },
        ],
      };
    }

    case 'summary': {
      return {
        type: 'result',
        message: `${period.charAt(0).toUpperCase() + period.slice(1)} you have 5 tasks completed, 3 calls made, and 2 deals moved forward.`,
        speak: true,
        data: { tasks: 5, calls: 3, deals: 2 },
      };
    }

    case 'performance': {
      return {
        type: 'result',
        message: `You're tracking at 85% of your ${period} goal with $127k in closed deals.`,
        speak: true,
        data: { percentage: 85, closedValue: 127000 },
      };
    }

    default:
      return {
        type: 'info',
        message: 'Query not recognized.',
        speak: false,
      };
  }
}

// Create handler
async function handleCreate(
  action: string,
  entities: Record<string, unknown>,
  context: ActionContext
): Promise<VoiceResponse> {
  switch (action) {
    case 'task': {
      const description = entities.description as string;
      const due = entities.due;
      // In real implementation, this would create a task via API
      return {
        type: 'success',
        message: `Created task: "${description}"${due ? ` due ${typeof due === 'string' ? due : (due as Date).toLocaleDateString()}` : ''}`,
        speak: true,
        actions: [
          { label: 'View Task', action: 'navigate:/crm/tasks' },
          { label: 'Edit Task', action: 'edit_task' },
        ],
      };
    }

    case 'note': {
      const content = entities.content as string;
      return {
        type: 'success',
        message: `Added note: "${content}"`,
        speak: true,
      };
    }

    default:
      return {
        type: 'info',
        message: 'Create action not recognized.',
        speak: false,
      };
  }
}

// Update handler
async function handleUpdate(
  action: string,
  entities: Record<string, unknown>,
  actionContext: ActionContext,
  voiceContext?: VoiceContext
): Promise<VoiceResponse> {
  switch (action) {
    case 'close_deal_won': {
      const dealName = entities.deal as string || voiceContext?.selectedRecord?.name || 'the deal';
      return {
        type: 'success',
        message: `Marked ${dealName} as Won! Congratulations!`,
        speak: true,
      };
    }

    case 'close_deal_lost': {
      const dealName = entities.deal as string || voiceContext?.selectedRecord?.name || 'the deal';
      return {
        type: 'success',
        message: `Marked ${dealName} as Lost.`,
        speak: true,
      };
    }

    case 'move_lead': {
      const stage = entities.stage as string;
      return {
        type: 'success',
        message: `Moved lead to ${stage}`,
        speak: true,
      };
    }

    case 'update_deal_value': {
      const value = entities.value as number;
      return {
        type: 'success',
        message: `Updated deal value to ${formatCurrency(value)}`,
        speak: true,
      };
    }

    case 'set_close_date': {
      const date = entities.date;
      const dateStr = typeof date === 'string' ? date : (date as Date)?.toLocaleDateString();
      return {
        type: 'success',
        message: `Set close date to ${dateStr}`,
        speak: true,
      };
    }

    default:
      return {
        type: 'info',
        message: 'Update action not recognized.',
        speak: false,
      };
  }
}

// Communication handler
function handleCommunicate(
  action: string,
  entities: Record<string, unknown>,
  context: ActionContext
): VoiceResponse {
  const contact = entities.recipient || entities.contact;

  switch (action) {
    case 'call': {
      return {
        type: 'success',
        message: `Calling ${contact}...`,
        speak: true,
        actions: [
          { label: 'End Call', action: 'end_call' },
          { label: 'Log Call', action: 'log_call' },
        ],
      };
    }

    case 'email': {
      const subject = entities.subject as string;
      context.navigate(`/crm/inbox/compose?to=${encodeURIComponent(contact as string)}${subject ? `&subject=${encodeURIComponent(subject)}` : ''}`);
      return {
        type: 'success',
        message: `Opening email composer for ${contact}${subject ? ` about ${subject}` : ''}`,
        speak: true,
      };
    }

    case 'sms': {
      return {
        type: 'success',
        message: `Sending text to ${contact}...`,
        speak: true,
      };
    }

    default:
      return {
        type: 'info',
        message: 'Communication action not recognized.',
        speak: false,
      };
  }
}

// Schedule handler
async function handleSchedule(
  action: string,
  entities: Record<string, unknown>,
  context: ActionContext
): Promise<VoiceResponse> {
  if (action === 'meeting') {
    const withPerson = entities.with as string;
    const when = entities.when;
    const whenStr = typeof when === 'string' ? when : (when as Date)?.toLocaleString();

    context.navigate('/crm/calendar/new');
    return {
      type: 'success',
      message: `Scheduling meeting with ${withPerson}${whenStr ? ` for ${whenStr}` : ''}`,
      speak: true,
      actions: [
        { label: 'Add Details', action: 'edit_meeting' },
      ],
    };
  }

  return {
    type: 'info',
    message: 'Schedule action not recognized.',
    speak: false,
  };
}

// Search handler
function handleSearch(
  action: string,
  entities: Record<string, unknown>,
  context: ActionContext
): VoiceResponse {
  const query = entities.query as string;
  const valueFilter = entities.valueFilter as number | null;
  const valueComparison = entities.valueComparison as string | null;

  let searchUrl = `/crm/search?q=${encodeURIComponent(query)}`;
  if (valueFilter && valueComparison) {
    searchUrl += `&value=${valueComparison}:${valueFilter}`;
  }

  context.navigate(searchUrl);
  return {
    type: 'success',
    message: `Searching for "${query}"${valueFilter ? ` ${valueComparison === 'gt' ? 'over' : 'under'} ${formatCurrency(valueFilter)}` : ''}...`,
    speak: true,
  };
}

// Control handler
function handleControl(
  action: string,
  entities: Record<string, unknown>,
  context: ActionContext
): VoiceResponse {
  switch (action) {
    case 'dark_mode':
      context.setTheme('dark');
      return {
        type: 'success',
        message: 'Switched to dark mode',
        speak: true,
      };

    case 'light_mode':
      context.setTheme('light');
      return {
        type: 'success',
        message: 'Switched to light mode',
        speak: true,
      };

    case 'mute_notifications':
      return {
        type: 'success',
        message: 'Notifications muted',
        speak: true,
      };

    case 'logout':
      return {
        type: 'question',
        message: 'Are you sure you want to log out?',
        speak: true,
        actions: [
          { label: 'Yes, Log Out', action: 'confirm_logout' },
          { label: 'Cancel', action: 'cancel' },
        ],
      };

    case 'open_terminal':
      context.openTerminal();
      return {
        type: 'success',
        message: 'Opening terminal',
        speak: false,
      };

    case 'help':
      return {
        type: 'info',
        message: `You can say things like:
• "Show me leads" - Navigate to any page
• "How many deals this week?" - Get quick stats
• "Create a task for tomorrow" - Create records
• "Call John Smith" - Start communication
• "What's my pipeline worth?" - Get reports`,
        speak: false,
      };

    default:
      return {
        type: 'info',
        message: 'Control action not recognized.',
        speak: false,
      };
  }
}

// Report handler
async function handleReport(
  action: string,
  entities: Record<string, unknown>,
  context: ActionContext
): Promise<VoiceResponse> {
  context.navigate('/crm/reports');
  return {
    type: 'success',
    message: 'Opening reports',
    speak: true,
  };
}
