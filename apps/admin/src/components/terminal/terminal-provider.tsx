'use client';

// Terminal Provider - Starship Command Center (Portable Version)
import React, { createContext, useContext, useCallback, useReducer, useEffect } from 'react';
import type { TerminalContextValue, TerminalState, CommandResult, PanelType } from './types';
import { executeCommand, getSuggestions as getCommandSuggestions } from './command-registry';

const MAX_HISTORY = 100;
const MAX_OUTPUT = 200;

type TerminalAction =
  | { type: 'TOGGLE' }
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'SET_INPUT'; value: string }
  | { type: 'ADD_OUTPUT'; result: CommandResult }
  | { type: 'CLEAR_OUTPUT' }
  | { type: 'SET_PANEL'; panel: PanelType | null }
  | { type: 'ADD_HISTORY'; command: string }
  | { type: 'NAVIGATE_HISTORY'; direction: 'up' | 'down' }
  | { type: 'SET_EXECUTING'; value: boolean }
  | { type: 'RESET_HISTORY_INDEX' };

const initialState: TerminalState = {
  isOpen: false,
  history: [],
  historyIndex: -1,
  output: [],
  currentPanel: null,
  isExecuting: false,
  inputValue: '',
};

function terminalReducer(state: TerminalState, action: TerminalAction): TerminalState {
  switch (action.type) {
    case 'TOGGLE':
      return { ...state, isOpen: !state.isOpen };
    case 'OPEN':
      return { ...state, isOpen: true };
    case 'CLOSE':
      return { ...state, isOpen: false, currentPanel: null };
    case 'SET_INPUT':
      return { ...state, inputValue: action.value };
    case 'ADD_OUTPUT':
      return {
        ...state,
        output: [...state.output, action.result].slice(-MAX_OUTPUT),
      };
    case 'CLEAR_OUTPUT':
      return { ...state, output: [], currentPanel: null };
    case 'SET_PANEL':
      return { ...state, currentPanel: action.panel };
    case 'ADD_HISTORY':
      const newHistory = [action.command, ...state.history.filter(h => h !== action.command)].slice(0, MAX_HISTORY);
      return { ...state, history: newHistory, historyIndex: -1 };
    case 'NAVIGATE_HISTORY': {
      const { history, historyIndex } = state;
      if (history.length === 0) return state;

      let newIndex: number;
      if (action.direction === 'up') {
        newIndex = Math.min(historyIndex + 1, history.length - 1);
      } else {
        newIndex = Math.max(historyIndex - 1, -1);
      }

      const newInputValue = newIndex === -1 ? '' : history[newIndex];
      return { ...state, historyIndex: newIndex, inputValue: newInputValue };
    }
    case 'SET_EXECUTING':
      return { ...state, isExecuting: action.value };
    case 'RESET_HISTORY_INDEX':
      return { ...state, historyIndex: -1 };
    default:
      return state;
  }
}

const TerminalContext = createContext<TerminalContextValue | null>(null);

interface TerminalProviderProps {
  children: React.ReactNode;
  navigate?: (path: string) => void;
  supabase?: any;
  profile?: {
    id?: string;
    tenant_id?: string;
    organization_id?: string;
    role?: string;
    full_name?: string;
  };
  theme?: 'dark' | 'light';
  toggleTheme?: () => void;
}

export function TerminalProvider({
  children,
  navigate,
  supabase,
  profile,
  theme = 'dark',
  toggleTheme,
}: TerminalProviderProps) {
  const [state, dispatch] = useReducer(terminalReducer, initialState);

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to toggle
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        dispatch({ type: 'TOGGLE' });
      }
      // Escape to close
      if (e.key === 'Escape' && state.isOpen) {
        dispatch({ type: 'CLOSE' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.isOpen]);

  const toggle = useCallback(() => dispatch({ type: 'TOGGLE' }), []);
  const open = useCallback(() => dispatch({ type: 'OPEN' }), []);
  const close = useCallback(() => dispatch({ type: 'CLOSE' }), []);
  const clearOutput = useCallback(() => dispatch({ type: 'CLEAR_OUTPUT' }), []);
  const setPanel = useCallback((panel: PanelType | null) => dispatch({ type: 'SET_PANEL', panel }), []);
  const setInputValue = useCallback((value: string) => dispatch({ type: 'SET_INPUT', value }), []);

  const navigateHistory = useCallback((direction: 'up' | 'down') => {
    dispatch({ type: 'NAVIGATE_HISTORY', direction });
  }, []);

  const getSuggestions = useCallback((input: string) => {
    return getCommandSuggestions(input);
  }, []);

  const handleToggleTheme = useCallback(() => {
    if (toggleTheme) {
      toggleTheme();
    }
  }, [toggleTheme]);

  const handleNavigate = useCallback((path: string) => {
    if (navigate) {
      navigate(path);
    } else if (typeof window !== 'undefined') {
      window.location.href = path;
    }
  }, [navigate]);

  const execute = useCallback(async (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return;

    dispatch({ type: 'SET_EXECUTING', value: true });
    dispatch({ type: 'ADD_HISTORY', command: trimmed });
    dispatch({ type: 'SET_INPUT', value: '' });

    // Add command echo to output
    dispatch({
      type: 'ADD_OUTPUT',
      result: {
        type: 'info',
        message: `> ${trimmed}`,
        timestamp: Date.now(),
      },
    });

    const context = {
      supabase,
      tenantId: profile?.tenant_id || profile?.organization_id,
      userId: profile?.id,
      userRole: profile?.role,
      navigate: handleNavigate,
      setPanel,
      clearOutput,
      theme: theme as 'dark' | 'light',
      toggleTheme: handleToggleTheme,
    };

    try {
      const result = await executeCommand(trimmed, context);
      dispatch({ type: 'ADD_OUTPUT', result });
    } catch (error) {
      dispatch({
        type: 'ADD_OUTPUT',
        result: {
          type: 'error',
          message: `Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: Date.now(),
        },
      });
    } finally {
      dispatch({ type: 'SET_EXECUTING', value: false });
    }
  }, [supabase, profile, handleNavigate, setPanel, clearOutput, theme, handleToggleTheme]);

  const value: TerminalContextValue = {
    ...state,
    toggle,
    open,
    close,
    execute,
    clearOutput,
    setPanel,
    setInputValue,
    navigateHistory,
    getSuggestions,
  };

  return (
    <TerminalContext.Provider value={value}>
      {children}
    </TerminalContext.Provider>
  );
}

export function useTerminal(): TerminalContextValue {
  const context = useContext(TerminalContext);
  if (!context) {
    throw new Error('useTerminal must be used within a TerminalProvider');
  }
  return context;
}
