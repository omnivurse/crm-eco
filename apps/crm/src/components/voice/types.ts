// Voice Command Center Types

export type IntentCategory =
  | 'navigation'    // "Show me leads", "Go to pipeline"
  | 'query'         // "How many deals close this week?"
  | 'create'        // "Create a task for John"
  | 'update'        // "Mark that deal as won"
  | 'communicate'   // "Call Sarah", "Send email to..."
  | 'schedule'      // "Schedule a follow-up for tomorrow"
  | 'report'        // "What's my pipeline value?"
  | 'search'        // "Find deals over 50k"
  | 'control';      // "Switch to dark mode", "Mute notifications"

export interface Intent {
  category: IntentCategory;
  action: string;
  entities: Record<string, string | number | Date | boolean | null>;
  confidence: number;
  raw: string;
}

export type VoiceError =
  | 'not-supported'
  | 'permission-denied'
  | 'no-speech'
  | 'network-error'
  | 'aborted'
  | 'audio-capture'
  | 'service-not-allowed';

export interface VoiceResponse {
  type: 'success' | 'error' | 'info' | 'question' | 'result';
  message: string;
  data?: unknown;
  actions?: QuickAction[];
  speak?: boolean;
}

export interface QuickAction {
  label: string;
  action: string;
  icon?: string;
}

export interface VoiceSettings {
  enabled: boolean;
  language: string;
  speakResponses: boolean;
  showTranscript: boolean;
  activationMethod: 'hold' | 'toggle';
  continuousListening: boolean;
  confidenceThreshold: number;
}

export interface VoiceContext {
  currentPage: string;
  currentModule: 'crm' | 'communications' | 'revenue' | 'operations' | 'analytics' | 'integrations' | 'settings';
  selectedRecord: { type: string; id: string; name: string } | null;
  recentEntities: Entity[];
  timezone: string;
}

export interface Entity {
  type: 'contact' | 'deal' | 'lead' | 'task' | 'account' | 'member' | 'advisor';
  id: string;
  name: string;
  mentionedAt: Date;
}

export type VoiceAction =
  | { type: 'SET_LISTENING'; payload: boolean }
  | { type: 'SET_PROCESSING'; payload: boolean }
  | { type: 'SET_TRANSCRIPT'; payload: string }
  | { type: 'SET_INTERIM_TRANSCRIPT'; payload: string }
  | { type: 'SET_RESPONSE'; payload: VoiceResponse | null }
  | { type: 'SET_ERROR'; payload: VoiceError | null }
  | { type: 'SET_CONFIDENCE'; payload: number }
  | { type: 'TOGGLE_OPEN' }
  | { type: 'SET_OPEN'; payload: boolean }
  | { type: 'ADD_TO_HISTORY'; payload: { transcript: string; response: VoiceResponse } }
  | { type: 'CLEAR_HISTORY' }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<VoiceSettings> }
  | { type: 'SET_CONTEXT'; payload: Partial<VoiceContext> }
  | { type: 'ADD_ENTITY'; payload: Entity }
  | { type: 'RESET' };

export interface VoiceState {
  isSupported: boolean;
  isOpen: boolean;
  isListening: boolean;
  isProcessing: boolean;
  transcript: string;
  interimTranscript: string;
  confidence: number;
  response: VoiceResponse | null;
  error: VoiceError | null;
  history: Array<{ transcript: string; response: VoiceResponse; timestamp: Date }>;
  settings: VoiceSettings;
  context: VoiceContext;
}

export interface VoiceContextValue {
  state: VoiceState;

  // Controls
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  cancelCommand: () => void;
  toggleOpen: () => void;

  // Manual execution
  executeCommand: (text: string) => Promise<void>;

  // Settings
  updateSettings: (settings: Partial<VoiceSettings>) => void;

  // Context updates
  updateContext: (context: Partial<VoiceContext>) => void;
  addRecentEntity: (entity: Entity) => void;

  // Speech synthesis
  speak: (text: string) => void;
  stopSpeaking: () => void;
}

// Pattern matching types
export interface VoicePattern {
  pattern: RegExp;
  intent: { category: IntentCategory; action: string };
  extract: (match: RegExpMatchArray) => Record<string, string | number | Date | boolean | null>;
  examples?: string[];
}

// Navigation destinations
export const NAVIGATION_DESTINATIONS: Record<string, string> = {
  'dashboard': '/crm',
  'home': '/crm',
  'leads': '/crm/modules/leads',
  'contacts': '/crm/modules/contacts',
  'deals': '/crm/modules/deals',
  'pipeline': '/crm/pipeline',
  'calendar': '/crm/calendar',
  'tasks': '/crm/tasks',
  'inbox': '/crm/inbox',
  'reports': '/crm/reports',
  'analytics': '/crm/analytics',
  'settings': '/crm/settings',
  'members': '/crm/modules/members',
  'advisors': '/crm/modules/advisors',
  'enrollments': '/crm/modules/enrollments',
  'commissions': '/crm/commissions',
  'communications': '/crm/communications',
  'campaigns': '/crm/campaigns',
  'tickets': '/crm/tickets',
  'approvals': '/crm/approval',
};
