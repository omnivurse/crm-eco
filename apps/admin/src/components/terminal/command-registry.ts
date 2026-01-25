// Command Registry - Starship Command Center
import type { Command, CommandContext, CommandResult } from './types';

const commandMap = new Map<string, Command>();
const aliasMap = new Map<string, string>();

// NAVIGATION COMMANDS
const bridgeCommand: Command = {
  name: 'bridge',
  aliases: ['b', 'home', 'dashboard'],
  description: 'Show command bridge (dashboard overview)',
  category: 'navigation',
  handler: async (_args, context) => {
    context.setPanel('bridge');
    return {
      type: 'panel',
      panel: 'bridge',
      message: '◈ BRIDGE SYSTEMS ONLINE ◈',
    };
  },
};

const gotoCommand: Command = {
  name: 'goto',
  aliases: ['go', 'nav', 'navigate'],
  description: 'Navigate to any route',
  usage: 'goto [path]',
  category: 'navigation',
  handler: (_args, context) => {
    const path = _args[0];
    if (!path) {
      return { type: 'error', message: 'Usage: goto [path] - Specify a destination' };
    }
    const fullPath = path.startsWith('/') ? path : `/${path}`;
    context.navigate(fullPath);
    return { type: 'success', message: `◈ NAVIGATING TO ${fullPath.toUpperCase()} ◈` };
  },
};

const ticketsCommand: Command = {
  name: 'tickets',
  aliases: ['t', 'ticket'],
  description: 'Navigate to tickets module',
  category: 'navigation',
  handler: async (args, context) => {
    if (args[0] === 'new') {
      context.navigate('/tickets/new');
      return { type: 'success', message: '◈ OPENING NEW TICKET FORM ◈' };
    }
    context.setPanel('tickets');
    context.navigate('/tickets');
    return { type: 'success', message: '◈ TICKETS MODULE ACTIVATED ◈' };
  },
};

const tasksCommand: Command = {
  name: 'tasks',
  aliases: ['task', 'todo'],
  description: 'Show tasks panel or navigate to tasks',
  category: 'navigation',
  handler: async (args, context) => {
    if (args[0]) {
      context.setPanel('tasks');
      return { type: 'panel', panel: 'tasks', message: '◈ TASKS DISPLAY ACTIVE ◈' };
    }
    context.navigate('/desk/tasks');
    return { type: 'success', message: '◈ NAVIGATING TO TASKS ◈' };
  },
};

const dealsCommand: Command = {
  name: 'deals',
  aliases: ['d', 'pipeline'],
  description: 'Show deals pipeline',
  category: 'navigation',
  handler: async (args, context) => {
    if (args[0] === 'hot') {
      context.setPanel('deals');
      return {
        type: 'panel',
        panel: 'deals',
        data: { filter: 'hot' },
        message: '◈ HOT DEALS DISPLAY ◈'
      };
    }
    context.setPanel('deals');
    return { type: 'panel', panel: 'deals', message: '◈ DEALS PIPELINE ACTIVE ◈' };
  },
};

const analyticsCommand: Command = {
  name: 'analytics',
  aliases: ['stats', 'metrics', 'reports'],
  description: 'Show analytics dashboard',
  category: 'navigation',
  handler: async (_args, context) => {
    context.setPanel('analytics');
    context.navigate('/analytics');
    return { type: 'success', message: '◈ ANALYTICS MODULE ONLINE ◈' };
  },
};

const kbCommand: Command = {
  name: 'kb',
  aliases: ['knowledge', 'docs'],
  description: 'Navigate to knowledge base',
  category: 'navigation',
  handler: (_args, context) => {
    context.navigate('/kb');
    return { type: 'success', message: '◈ KNOWLEDGE BASE ACCESSED ◈' };
  },
};

const deskCommand: Command = {
  name: 'desk',
  aliases: ['workspace', 'mywork'],
  description: 'Navigate to personal workspace',
  category: 'navigation',
  handler: (_args, context) => {
    context.navigate('/desk');
    return { type: 'success', message: '◈ WORKSPACE ACTIVATED ◈' };
  },
};

// ACTION COMMANDS
const newCommand: Command = {
  name: 'new',
  aliases: ['n', 'create', 'add'],
  description: 'Create new record',
  usage: 'new [type] - Types: ticket, task, note, request',
  category: 'actions',
  handler: (args, context) => {
    const type = args[0]?.toLowerCase();
    const routes: Record<string, string> = {
      ticket: '/tickets/new',
      task: '/desk/tasks',
      note: '/desk/notes',
      request: '/requests/new',
      problem: '/problems/new',
    };

    if (!type) {
      return {
        type: 'info',
        message: 'Available types: ticket, task, note, request, problem\nUsage: new [type]'
      };
    }

    const route = routes[type];
    if (!route) {
      return { type: 'error', message: `Unknown type: ${type}. Try: ticket, task, note, request, problem` };
    }

    context.navigate(route);
    return { type: 'success', message: `◈ CREATING NEW ${type.toUpperCase()} ◈` };
  },
};

const searchCommand: Command = {
  name: 'search',
  aliases: ['s', 'find', 'query'],
  description: 'Global search',
  usage: 'search [query]',
  category: 'actions',
  handler: async (args, context) => {
    const query = args.join(' ');
    if (!query) {
      return { type: 'error', message: 'Usage: search [query] - Enter search terms' };
    }

    // Trigger search - could integrate with existing search
    context.navigate(`/search?q=${encodeURIComponent(query)}`);
    return { type: 'success', message: `◈ SEARCHING: "${query}" ◈` };
  },
};

const openCommand: Command = {
  name: 'open',
  aliases: ['o', 'view'],
  description: 'Open record by ID',
  usage: 'open [type] [id]',
  category: 'actions',
  handler: (args, context) => {
    const [type, id] = args;
    if (!type || !id) {
      return { type: 'error', message: 'Usage: open [type] [id] - Example: open ticket 123' };
    }

    const routes: Record<string, string> = {
      ticket: `/tickets/${id}`,
      task: `/desk/tasks/${id}`,
      request: `/requests/${id}`,
      problem: `/problems/${id}`,
    };

    const route = routes[type.toLowerCase()];
    if (!route) {
      return { type: 'error', message: `Unknown type: ${type}` };
    }

    context.navigate(route);
    return { type: 'success', message: `◈ OPENING ${type.toUpperCase()} #${id} ◈` };
  },
};

// DATA DISPLAY COMMANDS
const statusCommand: Command = {
  name: 'status',
  aliases: ['sys', 'system'],
  description: 'System status panel',
  category: 'data',
  handler: async (_args, context) => {
    context.setPanel('status');
    return {
      type: 'panel',
      panel: 'status',
      message: '◈ SYSTEM STATUS ◈'
    };
  },
};

const forecastCommand: Command = {
  name: 'forecast',
  aliases: ['revenue', 'pipeline-forecast'],
  description: 'Pipeline/revenue forecast',
  category: 'data',
  handler: async (_args, context) => {
    context.setPanel('forecast');
    return {
      type: 'panel',
      panel: 'forecast',
      message: '◈ FORECAST PROJECTION ◈'
    };
  },
};

const hotCommand: Command = {
  name: 'hot',
  aliases: ['priority', 'urgent'],
  description: 'Show hot/priority items',
  category: 'data',
  handler: async (_args, context) => {
    context.setPanel('deals');
    return {
      type: 'panel',
      panel: 'deals',
      data: { filter: 'hot' },
      message: '◈ PRIORITY ITEMS ◈'
    };
  },
};

const atRiskCommand: Command = {
  name: 'at-risk',
  aliases: ['risk', 'atrisk', 'danger'],
  description: 'At-risk items needing attention',
  category: 'data',
  handler: async (_args, context) => {
    context.setPanel('deals');
    return {
      type: 'panel',
      panel: 'deals',
      data: { filter: 'at-risk' },
      message: '◈ AT-RISK ITEMS DETECTED ◈'
    };
  },
};

// SYSTEM COMMANDS
const helpCommand: Command = {
  name: 'help',
  aliases: ['h', '?', 'commands'],
  description: 'Show available commands',
  category: 'system',
  handler: (_args, context) => {
    context.setPanel('help');
    return {
      type: 'panel',
      panel: 'help',
      message: '◈ COMMAND REFERENCE ◈'
    };
  },
};

const clearCommand: Command = {
  name: 'clear',
  aliases: ['cls', 'reset'],
  description: 'Clear terminal output',
  category: 'system',
  handler: (_args, context) => {
    context.clearOutput();
    return { type: 'info', message: '◈ TERMINAL CLEARED ◈' };
  },
};

const themeCommand: Command = {
  name: 'theme',
  aliases: ['mode', 'dark', 'light'],
  description: 'Toggle dark/light mode',
  usage: 'theme [dark|light]',
  category: 'system',
  handler: (args, context) => {
    const mode = args[0]?.toLowerCase();
    if (mode && mode !== 'dark' && mode !== 'light') {
      return { type: 'error', message: 'Usage: theme [dark|light]' };
    }
    context.toggleTheme();
    return { type: 'success', message: `◈ THEME TOGGLED ◈` };
  },
};

const logoutCommand: Command = {
  name: 'logout',
  aliases: ['signout', 'exit'],
  description: 'Sign out of the system',
  category: 'system',
  handler: (_args, context) => {
    context.navigate('/auth/login');
    return { type: 'warning', message: '◈ INITIATING LOGOUT SEQUENCE ◈' };
  },
};

const echoCommand: Command = {
  name: 'echo',
  aliases: ['print', 'say'],
  description: 'Echo text back',
  category: 'system',
  handler: (args) => {
    return { type: 'info', message: args.join(' ') || '...' };
  },
};

const dateCommand: Command = {
  name: 'stardate',
  aliases: ['date', 'time', 'now'],
  description: 'Show current stardate',
  category: 'system',
  handler: () => {
    const now = new Date();
    const stardate = (now.getFullYear() - 2000) * 1000 +
      Math.floor((now.getMonth() * 30 + now.getDate()) / 365 * 1000);
    return {
      type: 'info',
      message: `◈ STARDATE ${stardate.toFixed(1)} ◈\n${now.toLocaleString()}`
    };
  },
};

// Register all built-in commands
const builtInCommands: Command[] = [
  // Navigation
  bridgeCommand,
  gotoCommand,
  ticketsCommand,
  tasksCommand,
  dealsCommand,
  analyticsCommand,
  kbCommand,
  deskCommand,
  // Actions
  newCommand,
  searchCommand,
  openCommand,
  // Data
  statusCommand,
  forecastCommand,
  hotCommand,
  atRiskCommand,
  // System
  helpCommand,
  clearCommand,
  themeCommand,
  logoutCommand,
  echoCommand,
  dateCommand,
];

// Initialize command registry
builtInCommands.forEach(cmd => {
  commandMap.set(cmd.name, cmd);
  cmd.aliases?.forEach(alias => aliasMap.set(alias, cmd.name));
});

// Public API
export function getCommand(name: string): Command | undefined {
  const normalizedName = name.toLowerCase();
  const actualName = aliasMap.get(normalizedName) || normalizedName;
  return commandMap.get(actualName);
}

export function getAllCommands(): Command[] {
  return Array.from(commandMap.values());
}

export function getCommandNames(): string[] {
  const names = Array.from(commandMap.keys());
  const aliases = Array.from(aliasMap.keys());
  return [...names, ...aliases].sort();
}

export function registerCommands(commands: Command[]): void {
  commands.forEach(cmd => {
    commandMap.set(cmd.name, cmd);
    cmd.aliases?.forEach(alias => aliasMap.set(alias, cmd.name));
  });
}

export function unregisterCommand(name: string): boolean {
  const cmd = commandMap.get(name);
  if (cmd) {
    commandMap.delete(name);
    cmd.aliases?.forEach(alias => aliasMap.delete(alias));
    return true;
  }
  return false;
}

export async function executeCommand(
  input: string,
  context: CommandContext
): Promise<CommandResult> {
  const trimmed = input.trim();
  if (!trimmed) {
    return { type: 'info', message: '' };
  }

  const [commandName, ...args] = trimmed.split(/\s+/);
  const command = getCommand(commandName);

  if (!command) {
    return {
      type: 'error',
      message: `Unknown command: ${commandName}\nType 'help' for available commands.`,
    };
  }

  try {
    const result = await command.handler(args, context);
    return { ...result, timestamp: Date.now() };
  } catch (error) {
    return {
      type: 'error',
      message: `Command failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: Date.now(),
    };
  }
}

export function getSuggestions(input: string): string[] {
  if (!input) return [];
  const lower = input.toLowerCase();
  const allNames = getCommandNames();
  return allNames
    .filter(name => name.startsWith(lower))
    .slice(0, 8);
}
