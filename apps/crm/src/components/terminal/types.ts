// Terminal Types - Starship Command Center

export type PanelType =
  | 'bridge'
  | 'deals'
  | 'leads'
  | 'tasks'
  | 'tickets'
  | 'comms'
  | 'analytics'
  | 'status'
  | 'forecast'
  | 'help';

export type OutputType = 'success' | 'error' | 'info' | 'warning' | 'panel' | 'table';

export interface CommandResult {
  type: OutputType;
  message?: string;
  data?: unknown;
  panel?: PanelType;
  timestamp?: number;
}

export interface CommandContext {
  supabase?: any;
  tenantId?: string;
  userId?: string;
  userRole?: string;
  navigate: (path: string) => void;
  setPanel: (panel: PanelType | null) => void;
  clearOutput: () => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
}

export interface Command {
  name: string;
  aliases?: string[];
  description: string;
  usage?: string;
  category?: 'navigation' | 'actions' | 'data' | 'system';
  handler: (args: string[], context: CommandContext) => Promise<CommandResult> | CommandResult;
}

export interface TerminalState {
  isOpen: boolean;
  history: string[];
  historyIndex: number;
  output: CommandResult[];
  currentPanel: PanelType | null;
  isExecuting: boolean;
  inputValue: string;
}

export interface TerminalContextValue extends TerminalState {
  toggle: () => void;
  open: () => void;
  close: () => void;
  execute: (command: string) => Promise<void>;
  clearOutput: () => void;
  setPanel: (panel: PanelType | null) => void;
  setInputValue: (value: string) => void;
  navigateHistory: (direction: 'up' | 'down') => void;
  getSuggestions: (input: string) => string[];
}

export interface TableData {
  headers: string[];
  rows: (string | number)[][];
}
