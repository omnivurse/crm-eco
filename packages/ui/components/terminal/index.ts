// Terminal Exports - Starship Command Center
export { TerminalProvider, useTerminal } from './terminal-provider';
export { TerminalWindow } from './terminal-window';
export { CommandInput } from './command-input';
export { CommandOutput } from './command-output';

// Re-export types
export type {
  Command,
  CommandResult,
  CommandContext,
  PanelType,
  TerminalContextValue,
} from './types';

// Re-export registry functions for extensibility
export {
  registerCommands,
  unregisterCommand,
  getCommand,
  getAllCommands,
} from './command-registry';
