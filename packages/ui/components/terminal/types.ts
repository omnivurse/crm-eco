// Terminal Types - Starship Command Center
import type { SupabaseClient } from '@supabase/supabase-js';

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
  supabase: SupabaseClient;
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

// Panel Data Types
export interface MetricItem {
  label: string;
  value: string | number;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
}

export interface AlertItem {
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  action?: string;
}

export interface QuickAction {
  label: string;
  command: string;
  shortcut?: string;
}

export interface BridgePanelData {
  metrics: MetricItem[];
  alerts: AlertItem[];
  quickActions: QuickAction[];
  systemStatus: 'online' | 'degraded' | 'offline';
}

export interface DealsPanelData {
  deals: Array<{
    id: string;
    name: string;
    value: number;
    stage: string;
    probability: number;
    closeDate?: string;
    isHot?: boolean;
    isAtRisk?: boolean;
  }>;
  filter?: string;
  summary?: {
    totalValue: number;
    totalDeals: number;
    avgProbability: number;
  };
}

export interface TasksPanelData {
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    dueDate?: string;
    assignee?: string;
  }>;
  filter?: string;
}

export interface StatusPanelData {
  services: Array<{
    name: string;
    status: 'operational' | 'degraded' | 'down';
    latency?: number;
  }>;
  uptime: string;
  lastChecked: string;
}

export interface TableData {
  headers: string[];
  rows: (string | number)[][];
}
