'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  Keyboard,
  ChevronRight,
  Terminal,
  Navigation,
  Search,
  Edit,
  Eye,
  Command,
} from 'lucide-react';

const GLOBAL_SHORTCUTS = [
  { keys: ['Ctrl', 'K'], mac: ['Cmd', 'K'], action: 'Open Command Terminal' },
  { keys: ['Ctrl', 'Space'], mac: ['Cmd', 'Space'], action: 'Open Voice Command Center' },
  { keys: ['Ctrl', '/'], mac: ['Cmd', '/'], action: 'Open Global Search' },
  { keys: ['Escape'], mac: ['Escape'], action: 'Close modal / Cancel action' },
  { keys: ['Ctrl', 'Shift', 'D'], mac: ['Cmd', 'Shift', 'D'], action: 'Toggle dark mode' },
];

const NAVIGATION_SHORTCUTS = [
  { keys: ['G', 'H'], mac: ['G', 'H'], action: 'Go to Home / Dashboard' },
  { keys: ['G', 'L'], mac: ['G', 'L'], action: 'Go to Leads' },
  { keys: ['G', 'C'], mac: ['G', 'C'], action: 'Go to Contacts' },
  { keys: ['G', 'D'], mac: ['G', 'D'], action: 'Go to Deals' },
  { keys: ['G', 'P'], mac: ['G', 'P'], action: 'Go to Pipeline' },
  { keys: ['G', 'T'], mac: ['G', 'T'], action: 'Go to Tasks' },
  { keys: ['G', 'R'], mac: ['G', 'R'], action: 'Go to Reports' },
  { keys: ['G', 'S'], mac: ['G', 'S'], action: 'Go to Settings' },
];

const LIST_SHORTCUTS = [
  { keys: ['J'], mac: ['J'], action: 'Move down in list' },
  { keys: ['K'], mac: ['K'], action: 'Move up in list' },
  { keys: ['Enter'], mac: ['Enter'], action: 'Open selected item' },
  { keys: ['X'], mac: ['X'], action: 'Select / deselect item' },
  { keys: ['Shift', 'A'], mac: ['Shift', 'A'], action: 'Select all' },
  { keys: ['Shift', 'N'], mac: ['Shift', 'N'], action: 'Deselect all' },
];

const RECORD_SHORTCUTS = [
  { keys: ['E'], mac: ['E'], action: 'Edit current record' },
  { keys: ['D'], mac: ['D'], action: 'Delete current record' },
  { keys: ['C'], mac: ['C'], action: 'Clone / duplicate record' },
  { keys: ['N'], mac: ['N'], action: 'Add note to record' },
  { keys: ['T'], mac: ['T'], action: 'Add task for record' },
  { keys: ['M'], mac: ['M'], action: 'Send email to record' },
];

const TERMINAL_SHORTCUTS = [
  { keys: ['Enter'], mac: ['Enter'], action: 'Execute command' },
  { keys: ['Tab'], mac: ['Tab'], action: 'Autocomplete suggestion' },
  { keys: ['Arrow Up'], mac: ['Arrow Up'], action: 'Previous command in history' },
  { keys: ['Arrow Down'], mac: ['Arrow Down'], action: 'Next command in history' },
  { keys: ['Ctrl', 'C'], mac: ['Cmd', 'C'], action: 'Cancel current input' },
  { keys: ['Ctrl', 'L'], mac: ['Cmd', 'L'], action: 'Clear terminal' },
];

function ShortcutKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-2 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded shadow-sm text-xs font-mono text-slate-700 dark:text-slate-300">
      {children}
    </kbd>
  );
}

function ShortcutRow({ keys, mac, action }: { keys: string[]; mac?: string[]; action: string }) {
  return (
    <div className="px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          {keys.map((key, idx) => (
            <span key={idx} className="flex items-center gap-1">
              {idx > 0 && <span className="text-slate-400 text-xs">+</span>}
              <ShortcutKey>{key}</ShortcutKey>
            </span>
          ))}
        </div>
        {mac && mac.join('') !== keys.join('') && (
          <span className="text-slate-400 text-xs ml-2">
            (Mac: {mac.map((k, i) => (
              <span key={i}>{i > 0 && '+'}{k}</span>
            ))})
          </span>
        )}
      </div>
      <span className="text-sm text-slate-600 dark:text-slate-300">{action}</span>
    </div>
  );
}

export default function TerminalShortcutsPage() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/crm/learn/terminal"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Terminal Basics
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-500/10">
            <Keyboard className="w-8 h-8 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              Keyboard Shortcuts
            </h1>
            <p className="text-slate-500 dark:text-slate-400">
              Master the keyboard for maximum productivity
            </p>
          </div>
        </div>
      </div>

      {/* Introduction */}
      <div className="prose prose-slate dark:prose-invert max-w-none mb-12">
        <p className="text-lg text-slate-600 dark:text-slate-300">
          CRM Eco supports extensive keyboard shortcuts to help you work faster.
          These shortcuts work throughout the application and can significantly
          speed up your workflow.
        </p>
      </div>

      {/* Global Shortcuts */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Command className="w-5 h-5 text-blue-500" />
          Global Shortcuts
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-4">
          These work anywhere in the application:
        </p>
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
          {GLOBAL_SHORTCUTS.map((shortcut, idx) => (
            <ShortcutRow key={idx} {...shortcut} />
          ))}
        </div>
      </section>

      {/* Navigation Shortcuts */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Navigation className="w-5 h-5 text-emerald-500" />
          Quick Navigation (G + Key)
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-4">
          Press <ShortcutKey>G</ShortcutKey> followed by another key to navigate:
        </p>
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
          {NAVIGATION_SHORTCUTS.map((shortcut, idx) => (
            <ShortcutRow key={idx} {...shortcut} />
          ))}
        </div>
      </section>

      {/* List Shortcuts */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Eye className="w-5 h-5 text-amber-500" />
          List Navigation
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-4">
          Navigate and select items in lists and tables:
        </p>
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
          {LIST_SHORTCUTS.map((shortcut, idx) => (
            <ShortcutRow key={idx} {...shortcut} />
          ))}
        </div>
      </section>

      {/* Record Shortcuts */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Edit className="w-5 h-5 text-rose-500" />
          Record Actions
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-4">
          Actions for the currently viewed or selected record:
        </p>
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
          {RECORD_SHORTCUTS.map((shortcut, idx) => (
            <ShortcutRow key={idx} {...shortcut} />
          ))}
        </div>
      </section>

      {/* Terminal Shortcuts */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Terminal className="w-5 h-5 text-slate-500" />
          Terminal-Specific
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-4">
          When the Command Terminal is open:
        </p>
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
          {TERMINAL_SHORTCUTS.map((shortcut, idx) => (
            <ShortcutRow key={idx} {...shortcut} />
          ))}
        </div>
      </section>

      {/* Customization Note */}
      <section className="mb-12">
        <div className="bg-violet-50 dark:bg-violet-500/10 rounded-xl p-6 border border-violet-200 dark:border-violet-500/20">
          <h3 className="font-medium text-violet-900 dark:text-violet-100 mb-2">Customizing Shortcuts</h3>
          <p className="text-violet-800 dark:text-violet-200">
            You can customize keyboard shortcuts in{' '}
            <Link href="/crm/settings" className="underline hover:text-violet-600 dark:hover:text-violet-300">
              Settings → Keyboard Shortcuts
            </Link>
            . Create your own combinations or modify existing ones to match your workflow.
          </p>
        </div>
      </section>

      {/* Cheat Sheet */}
      <section className="mb-12">
        <div className="bg-slate-900 dark:bg-slate-800 rounded-xl p-6">
          <h3 className="font-medium text-white mb-4">Quick Reference Cheat Sheet</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="bg-slate-800 dark:bg-slate-700 rounded-lg p-4">
              <h4 className="text-slate-400 mb-2 text-xs uppercase tracking-wider">Essential</h4>
              <div className="space-y-2 text-slate-300">
                <div className="flex justify-between">
                  <span>Open Terminal</span>
                  <span className="text-slate-400">Ctrl+K</span>
                </div>
                <div className="flex justify-between">
                  <span>Open Voice</span>
                  <span className="text-slate-400">Ctrl+Space</span>
                </div>
                <div className="flex justify-between">
                  <span>Search</span>
                  <span className="text-slate-400">Ctrl+/</span>
                </div>
              </div>
            </div>
            <div className="bg-slate-800 dark:bg-slate-700 rounded-lg p-4">
              <h4 className="text-slate-400 mb-2 text-xs uppercase tracking-wider">Navigation</h4>
              <div className="space-y-2 text-slate-300">
                <div className="flex justify-between">
                  <span>Go to Home</span>
                  <span className="text-slate-400">G H</span>
                </div>
                <div className="flex justify-between">
                  <span>Go to Leads</span>
                  <span className="text-slate-400">G L</span>
                </div>
                <div className="flex justify-between">
                  <span>Go to Deals</span>
                  <span className="text-slate-400">G D</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Related Links */}
      <div className="grid md:grid-cols-2 gap-4">
        <Link
          href="/crm/learn/terminal"
          className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors flex items-center justify-between"
        >
          <div>
            <div className="text-sm text-slate-500">Back to</div>
            <div className="font-medium text-slate-900 dark:text-white">Terminal Basics</div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400" />
        </Link>
        <Link
          href="/crm/learn/voice"
          className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors flex items-center justify-between"
        >
          <div>
            <div className="text-sm text-slate-500">Related topic</div>
            <div className="font-medium text-slate-900 dark:text-white">Voice Commands</div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400" />
        </Link>
      </div>
    </div>
  );
}
