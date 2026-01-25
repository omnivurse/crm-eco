// Intent Parser - Converts natural language to structured intents

import type { Intent, IntentCategory, VoicePattern, VoiceContext, NAVIGATION_DESTINATIONS } from './types';

// Navigation patterns
const navigationPatterns: VoicePattern[] = [
  {
    pattern: /^(?:show\s+(?:me\s+)?|open\s+(?:the\s+)?|go\s+to\s+(?:the\s+)?|take\s+me\s+to\s+(?:the\s+)?|navigate\s+to\s+(?:the\s+)?)(.+)$/i,
    intent: { category: 'navigation', action: 'navigate' },
    extract: (match) => ({ destination: match[1].trim().toLowerCase() }),
    examples: ['Show me leads', 'Open the pipeline', 'Go to dashboard', 'Take me to contacts'],
  },
  {
    pattern: /^(?:today'?s?\s+)?priorities?$/i,
    intent: { category: 'navigation', action: 'priorities' },
    extract: () => ({ date: 'today' }),
    examples: ["Today's priorities", 'Priorities'],
  },
];

// Query patterns
const queryPatterns: VoicePattern[] = [
  {
    pattern: /^how\s+many\s+(.+?)\s+(?:came\s+in\s+|this\s+|today|yesterday|last\s+)(.+)?$/i,
    intent: { category: 'query', action: 'count' },
    extract: (match) => ({
      type: normalizeEntityType(match[1]),
      period: normalizePeriod(match[2] || 'today'),
    }),
    examples: ['How many leads came in this week', 'How many deals this month'],
  },
  {
    pattern: /^what(?:'s|s|\s+is)\s+(?:my\s+)?(?:the\s+)?(?:total\s+)?pipeline\s+(?:value|worth)?\??$/i,
    intent: { category: 'query', action: 'pipeline_value' },
    extract: () => ({}),
    examples: ["What's my pipeline worth?", "What's the pipeline value"],
  },
  {
    pattern: /^what(?:'s|s|\s+is)\s+closing\s+(?:this\s+)?(.+)$/i,
    intent: { category: 'query', action: 'closing' },
    extract: (match) => ({ period: normalizePeriod(match[1]) }),
    examples: ["What's closing this week?", "What's closing this month?"],
  },
  {
    pattern: /^who(?:'s|s|\s+is)\s+(?:my\s+)?(?:the\s+)?(?:hottest|top|best)\s+(.+)$/i,
    intent: { category: 'query', action: 'top' },
    extract: (match) => ({ type: normalizeEntityType(match[1]), sort: 'score' }),
    examples: ["Who's my hottest lead?", "Who's the top advisor?"],
  },
  {
    pattern: /^(?:give\s+me\s+)?(?:a\s+)?summary\s+(?:of\s+)?(?:today(?:'s)?)?(?:\s+activities?)?$/i,
    intent: { category: 'query', action: 'summary' },
    extract: () => ({ period: 'today' }),
    examples: ['Give me a summary of today', "Today's summary"],
  },
  {
    pattern: /^how\s+(?:am\s+i|are\s+we)\s+(?:doing|tracking|performing)\s*(?:this\s+)?(.+)?$/i,
    intent: { category: 'query', action: 'performance' },
    extract: (match) => ({ period: normalizePeriod(match[1] || 'this month') }),
    examples: ['How am I tracking this quarter?', 'How are we doing this month?'],
  },
];

// Create patterns
const createPatterns: VoicePattern[] = [
  {
    pattern: /^(?:create|add|make|new)\s+(?:a\s+)?task\s+(?:to\s+)?(?:for\s+)?(.+?)(?:\s+(?:for|on|by)\s+(.+))?$/i,
    intent: { category: 'create', action: 'task' },
    extract: (match) => ({
      description: match[1].trim(),
      due: match[2] ? parseRelativeDate(match[2]) : null,
    }),
    examples: ['Create a task to follow up with Acme Corp', 'Add task for tomorrow'],
  },
  {
    pattern: /^(?:create|add|make|new)\s+(?:a\s+)?note\s+(?:that\s+)?(.+)$/i,
    intent: { category: 'create', action: 'note' },
    extract: (match) => ({ content: match[1].trim() }),
    examples: ['Add a note that they are interested in premium', 'Create note about the meeting'],
  },
  {
    pattern: /^(?:schedule|book|set\s+up)\s+(?:a\s+)?(?:demo|meeting|call)\s+(?:for\s+|with\s+)?(.+?)(?:\s+(?:at|on|for)\s+(.+))?$/i,
    intent: { category: 'schedule', action: 'meeting' },
    extract: (match) => ({
      with: match[1].trim(),
      when: match[2] ? parseRelativeDate(match[2]) : null,
    }),
    examples: ['Schedule a demo for next Tuesday at 2pm', 'Book a call with John'],
  },
];

// Communication patterns
const communicationPatterns: VoicePattern[] = [
  {
    pattern: /^(?:call|phone|ring|dial)\s+(.+)$/i,
    intent: { category: 'communicate', action: 'call' },
    extract: (match) => ({ contact: match[1].trim() }),
    examples: ['Call John Smith', 'Phone Sarah'],
  },
  {
    pattern: /^(?:send|write|compose)\s+(?:an?\s+)?email\s+(?:to\s+)?(.+?)(?:\s+about\s+(.+))?$/i,
    intent: { category: 'communicate', action: 'email' },
    extract: (match) => ({
      recipient: match[1].trim(),
      subject: match[2]?.trim() || null,
    }),
    examples: ['Send email to Sarah about the proposal', 'Write an email to John'],
  },
  {
    pattern: /^(?:text|sms|message)\s+(.+?)(?:\s+(?:that|saying)\s+(.+))?$/i,
    intent: { category: 'communicate', action: 'sms' },
    extract: (match) => ({
      recipient: match[1].trim(),
      message: match[2]?.trim() || null,
    }),
    examples: ['Text the client that I am running late', 'Message John'],
  },
];

// Update patterns
const updatePatterns: VoicePattern[] = [
  {
    pattern: /^(?:mark|set)\s+(?:the\s+)?(.+?)\s+(?:deal\s+)?(?:as\s+)?(?:won|closed[\s-]?won)$/i,
    intent: { category: 'update', action: 'close_deal_won' },
    extract: (match) => ({ deal: match[1].trim() }),
    examples: ['Mark the Acme deal as won', 'Set that deal as closed won'],
  },
  {
    pattern: /^(?:mark|set)\s+(?:the\s+)?(.+?)\s+(?:deal\s+)?(?:as\s+)?(?:lost|closed[\s-]?lost)$/i,
    intent: { category: 'update', action: 'close_deal_lost' },
    extract: (match) => ({ deal: match[1].trim() }),
    examples: ['Mark the deal as lost'],
  },
  {
    pattern: /^(?:move|change)\s+(?:that\s+)?(?:lead|the\s+lead)\s+to\s+(.+)$/i,
    intent: { category: 'update', action: 'move_lead' },
    extract: (match) => ({ stage: match[1].trim() }),
    examples: ['Move that lead to qualified', 'Change the lead to contacted'],
  },
  {
    pattern: /^(?:add|set)\s+\$?([\d,]+(?:\.\d{2})?)\s*k?\s+(?:to\s+)?(?:the\s+)?(?:deal\s+)?(?:value|amount)?$/i,
    intent: { category: 'update', action: 'update_deal_value' },
    extract: (match) => {
      let value = parseFloat(match[1].replace(/,/g, ''));
      if (match[0].toLowerCase().includes('k')) value *= 1000;
      return { value };
    },
    examples: ['Add $50k to the deal value', 'Set $100,000 to the deal'],
  },
  {
    pattern: /^(?:set|change)\s+(?:the\s+)?close\s+date\s+to\s+(.+)$/i,
    intent: { category: 'update', action: 'set_close_date' },
    extract: (match) => ({ date: parseRelativeDate(match[1]) }),
    examples: ['Set the close date to next Friday', 'Change close date to March 15'],
  },
];

// Search patterns
const searchPatterns: VoicePattern[] = [
  {
    pattern: /^(?:find|search\s+(?:for)?|look\s+(?:up|for))\s+(.+?)(?:\s+(?:over|under|above|below|worth\s+(?:more|less)\s+than)\s+\$?([\d,]+)k?)?$/i,
    intent: { category: 'search', action: 'search' },
    extract: (match) => ({
      query: match[1].trim(),
      valueFilter: match[2] ? parseFloat(match[2].replace(/,/g, '')) * (match[0].includes('k') ? 1000 : 1) : null,
      valueComparison: match[0].match(/over|above|more/) ? 'gt' : match[0].match(/under|below|less/) ? 'lt' : null,
    }),
    examples: ['Find deals over 50k', 'Search for Acme', 'Look up John Smith'],
  },
];

// Control patterns
const controlPatterns: VoicePattern[] = [
  {
    pattern: /^(?:switch\s+to\s+|enable\s+|turn\s+on\s+)?dark\s+mode$/i,
    intent: { category: 'control', action: 'dark_mode' },
    extract: () => ({ enabled: true }),
    examples: ['Switch to dark mode', 'Enable dark mode'],
  },
  {
    pattern: /^(?:switch\s+to\s+|enable\s+|turn\s+on\s+)?light\s+mode$/i,
    intent: { category: 'control', action: 'light_mode' },
    extract: () => ({ enabled: true }),
    examples: ['Switch to light mode', 'Enable light mode'],
  },
  {
    pattern: /^(?:mute|silence|disable)\s+notifications?$/i,
    intent: { category: 'control', action: 'mute_notifications' },
    extract: () => ({ muted: true }),
    examples: ['Mute notifications', 'Silence notifications'],
  },
  {
    pattern: /^(?:log\s*out|sign\s*out)$/i,
    intent: { category: 'control', action: 'logout' },
    extract: () => ({}),
    examples: ['Log out', 'Sign out'],
  },
  {
    pattern: /^(?:open\s+)?(?:the\s+)?terminal$/i,
    intent: { category: 'control', action: 'open_terminal' },
    extract: () => ({}),
    examples: ['Open terminal', 'Terminal'],
  },
  {
    pattern: /^(?:help|what\s+can\s+(?:you|i)\s+(?:do|say))$/i,
    intent: { category: 'control', action: 'help' },
    extract: () => ({}),
    examples: ['Help', 'What can I say?'],
  },
];

// All patterns combined
const allPatterns: VoicePattern[] = [
  ...navigationPatterns,
  ...queryPatterns,
  ...createPatterns,
  ...communicationPatterns,
  ...updatePatterns,
  ...searchPatterns,
  ...controlPatterns,
];

// Helper functions
function normalizeEntityType(input: string): string {
  const normalized = input.toLowerCase().trim();
  const mappings: Record<string, string> = {
    'lead': 'leads',
    'leads': 'leads',
    'deal': 'deals',
    'deals': 'deals',
    'contact': 'contacts',
    'contacts': 'contacts',
    'task': 'tasks',
    'tasks': 'tasks',
    'member': 'members',
    'members': 'members',
    'advisor': 'advisors',
    'advisors': 'advisors',
    'enrollment': 'enrollments',
    'enrollments': 'enrollments',
    'ticket': 'tickets',
    'tickets': 'tickets',
  };
  return mappings[normalized] || normalized;
}

function normalizePeriod(input: string): string {
  if (!input) return 'today';
  const normalized = input.toLowerCase().trim();

  const mappings: Record<string, string> = {
    'today': 'today',
    'yesterday': 'yesterday',
    'week': 'this_week',
    'this week': 'this_week',
    'last week': 'last_week',
    'month': 'this_month',
    'this month': 'this_month',
    'last month': 'last_month',
    'quarter': 'this_quarter',
    'this quarter': 'this_quarter',
    'last quarter': 'last_quarter',
    'year': 'this_year',
    'this year': 'this_year',
    'last year': 'last_year',
  };

  return mappings[normalized] || normalized;
}

function parseRelativeDate(input: string): Date | string {
  const normalized = input.toLowerCase().trim();
  const now = new Date();

  // Today/Tomorrow/Yesterday
  if (normalized === 'today') return now;
  if (normalized === 'tomorrow') {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }
  if (normalized === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  }

  // Next weekday (e.g., "next Tuesday")
  const nextDayMatch = normalized.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
  if (nextDayMatch) {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const targetDay = dayNames.indexOf(nextDayMatch[1].toLowerCase());
    const currentDay = now.getDay();
    let daysUntil = targetDay - currentDay;
    if (daysUntil <= 0) daysUntil += 7;
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + daysUntil);
    return targetDate;
  }

  // In X days/weeks
  const inMatch = normalized.match(/in\s+(\d+)\s+(day|week|month)s?/i);
  if (inMatch) {
    const amount = parseInt(inMatch[1]);
    const unit = inMatch[2].toLowerCase();
    const targetDate = new Date(now);
    if (unit === 'day') targetDate.setDate(targetDate.getDate() + amount);
    else if (unit === 'week') targetDate.setDate(targetDate.getDate() + amount * 7);
    else if (unit === 'month') targetDate.setMonth(targetDate.getMonth() + amount);
    return targetDate;
  }

  // Return as string if we can't parse it
  return input;
}

// Resolve pronouns using context
function resolvePronouns(
  transcript: string,
  context: VoiceContext
): string {
  let resolved = transcript;

  // Resolve "it", "that", "this" to selected record
  if (context.selectedRecord && /\b(it|that|this)\b/i.test(transcript)) {
    resolved = resolved.replace(/\b(it|that|this)\b/gi, context.selectedRecord.name);
  }

  // Resolve "them", "they" to recent contact/entity
  const recentContact = context.recentEntities.find(e =>
    e.type === 'contact' || e.type === 'lead' || e.type === 'member'
  );
  if (recentContact && /\b(them|they)\b/i.test(transcript)) {
    resolved = resolved.replace(/\b(them|they)\b/gi, recentContact.name);
  }

  return resolved;
}

// Main parsing function
export function parseIntent(
  transcript: string,
  context?: VoiceContext
): Intent {
  // Clean up transcript
  let cleanTranscript = transcript.trim().replace(/\s+/g, ' ');

  // Resolve pronouns if context provided
  if (context) {
    cleanTranscript = resolvePronouns(cleanTranscript, context);
  }

  // Try pattern matching
  for (const patternDef of allPatterns) {
    const match = cleanTranscript.match(patternDef.pattern);
    if (match) {
      return {
        category: patternDef.intent.category,
        action: patternDef.intent.action,
        entities: patternDef.extract(match),
        confidence: 0.9, // High confidence for pattern matches
        raw: transcript,
      };
    }
  }

  // Fall back to search intent
  return {
    category: 'search',
    action: 'search',
    entities: { query: cleanTranscript },
    confidence: 0.5, // Low confidence for fallback
    raw: transcript,
  };
}

// Get suggestions for current context
export function getSuggestions(context?: VoiceContext): string[] {
  const suggestions: string[] = [];

  // Always available
  suggestions.push(
    "Show me today's priorities",
    "What's closing this week?",
    "How am I tracking this month?"
  );

  // Context-specific
  if (context?.currentPage?.includes('deals') || context?.currentPage?.includes('pipeline')) {
    suggestions.push(
      "What's my pipeline worth?",
      "Find deals over $50k",
      "Who's my hottest lead?"
    );
  }

  if (context?.currentPage?.includes('tasks')) {
    suggestions.push(
      "Create a task for tomorrow",
      "Show me overdue tasks",
      "Mark this task as complete"
    );
  }

  if (context?.selectedRecord) {
    suggestions.push(
      `Call ${context.selectedRecord.name}`,
      `Send email to ${context.selectedRecord.name}`,
      `Create a task for ${context.selectedRecord.name}`
    );
  }

  return suggestions.slice(0, 5);
}

// Export patterns for testing/documentation
export { allPatterns };
