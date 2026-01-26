'use client';

import Link from 'next/link';
import {
  Terminal,
  ArrowLeft,
  ChevronRight,
  Keyboard,
  Zap,
  Search,
  Settings,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  Command,
  CornerDownLeft,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';

const COMMAND_TYPES = [
  {
    category: 'Navigation',
    icon: <Command className="w-5 h-5" />,
    commands: [
      { command: '/leads', action: 'Navigate to Leads module' },
      { command: '/contacts', action: 'Navigate to Contacts module' },
      { command: '/deals', action: 'Navigate to Deals module' },
      { command: '/calendar', action: 'Navigate to Calendar' },
    ],
  },
  {
    category: 'Quick Actions',
    icon: <Zap className="w-5 h-5" />,
    commands: [
      { command: '/new lead', action: 'Create a new lead' },
      { command: '/new contact', action: 'Create a new contact' },
      { command: '/new task', action: 'Create a new task' },
      { command: '/new deal', action: 'Create a new deal' },
    ],
  },
  {
    category: 'Search',
    icon: <Search className="w-5 h-5" />,
    commands: [
      { command: '/search [query]', action: 'Global search for records' },
      { command: '/find [name]', action: 'Find contact or lead by name' },
    ],
  },
  {
    category: 'Settings',
    icon: <Settings className="w-5 h-5" />,
    commands: [
      { command: '/theme dark', action: 'Switch to dark mode' },
      { command: '/theme light', action: 'Switch to light mode' },
      { command: '/help', action: 'Show available commands' },
    ],
  },
];

const RELATED_ARTICLES = [
  { title: 'Available Commands', href: '/crm/learn/terminal/commands', time: '5 min' },
  { title: 'Keyboard Shortcuts', href: '/crm/learn/terminal/shortcuts', time: '3 min' },
];

export default function TerminalLearnPage() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/crm/learn"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Learning Center
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-slate-500/10 to-gray-500/10">
            <Terminal className="w-8 h-8 text-slate-600 dark:text-slate-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              Command Terminal
            </h1>
            <p className="text-slate-500 dark:text-slate-400">
              Power-user interface for rapid CRM operations
            </p>
          </div>
        </div>
      </div>

      {/* Introduction */}
      <div className="prose prose-slate dark:prose-invert max-w-none mb-12">
        <p className="text-lg text-slate-600 dark:text-slate-300">
          The Command Terminal is a fast, keyboard-driven interface for power users. Execute commands,
          navigate instantly, and perform actions without taking your hands off the keyboard.
          It's designed for efficiency and speed.
        </p>
      </div>

      {/* Getting Started */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-500" />
          Getting Started
        </h2>
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-slate-900 dark:text-white mb-3">How to Open</h3>
              <ol className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center text-xs font-medium">1</span>
                  <span>Press <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs">Ctrl</kbd>+<kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs">K</kbd> (or <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs">Cmd</kbd>+<kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs">K</kbd> on Mac)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center text-xs font-medium">2</span>
                  <span>Or click the <strong>Terminal</strong> button in the header</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center text-xs font-medium">3</span>
                  <span>Type a command starting with <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs">/</code> and press Enter</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center text-xs font-medium">4</span>
                  <span>Press <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs">Escape</kbd> to close the terminal</span>
                </li>
              </ol>
            </div>
            <div>
              <h3 className="font-medium text-slate-900 dark:text-white mb-3">Keyboard Shortcuts</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <span className="text-slate-600 dark:text-slate-300">Open Terminal</span>
                  <kbd className="px-2 py-1 bg-white dark:bg-slate-600 rounded shadow-sm text-xs">Ctrl + K</kbd>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <span className="text-slate-600 dark:text-slate-300">Close Terminal</span>
                  <kbd className="px-2 py-1 bg-white dark:bg-slate-600 rounded shadow-sm text-xs">Escape</kbd>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <span className="text-slate-600 dark:text-slate-300">Execute Command</span>
                  <kbd className="px-2 py-1 bg-white dark:bg-slate-600 rounded shadow-sm text-xs">Enter</kbd>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <span className="text-slate-600 dark:text-slate-300">Previous Command</span>
                  <kbd className="px-2 py-1 bg-white dark:bg-slate-600 rounded shadow-sm text-xs">Arrow Up</kbd>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Command Reference */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <CornerDownLeft className="w-5 h-5 text-blue-500" />
          Quick Command Reference
        </h2>
        <div className="space-y-6">
          {COMMAND_TYPES.map((category) => (
            <div
              key={category.category}
              className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
            >
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-600 flex items-center gap-2">
                <span className="text-slate-600 dark:text-slate-300">{category.icon}</span>
                <h3 className="font-medium text-slate-900 dark:text-white">{category.category}</h3>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {category.commands.map((cmd, idx) => (
                  <div key={idx} className="px-4 py-3 flex items-center justify-between">
                    <code className="text-sm font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                      {cmd.command}
                    </code>
                    <span className="text-sm text-slate-500 dark:text-slate-400">{cmd.action}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tips */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-amber-500" />
          Tips for Best Results
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-4 border border-emerald-200 dark:border-emerald-500/20">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-emerald-900 dark:text-emerald-100 mb-1">Do</h4>
                <ul className="text-sm text-emerald-700 dark:text-emerald-300 space-y-1">
                  <li>Use tab completion for faster typing</li>
                  <li>Use arrow keys to navigate command history</li>
                  <li>Start commands with / for clarity</li>
                  <li>Try abbreviated commands like /l for /leads</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="bg-red-50 dark:bg-red-500/10 rounded-xl p-4 border border-red-200 dark:border-red-500/20">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-red-900 dark:text-red-100 mb-1">Avoid</h4>
                <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                  <li>Typing full URLs (use navigation commands)</li>
                  <li>Forgetting the slash at the start</li>
                  <li>Using special characters in search queries</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Autocomplete */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
          Autocomplete
        </h2>
        <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-6 border border-blue-200 dark:border-blue-500/20">
          <p className="text-blue-800 dark:text-blue-200 mb-4">
            As you type, the terminal shows suggestions. Use the arrow keys to navigate suggestions and press Tab or Enter to select.
          </p>
          <div className="bg-white dark:bg-slate-800/50 rounded-lg p-4 font-mono text-sm">
            <div className="text-slate-500 mb-2">$ /con<span className="animate-pulse">|</span></div>
            <div className="space-y-1">
              <div className="px-2 py-1 bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 rounded">/contacts</div>
              <div className="px-2 py-1 text-slate-600 dark:text-slate-400">/conversations</div>
            </div>
          </div>
        </div>
      </section>

      {/* Related Articles */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
          Related Articles
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {RELATED_ARTICLES.map((article) => (
            <Link
              key={article.href}
              href={article.href}
              className="group bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:border-teal-500/50 transition-colors"
            >
              <h3 className="font-medium text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 mb-1">
                {article.title}
              </h3>
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>{article.time} read</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <div className="bg-gradient-to-r from-slate-600 to-slate-700 rounded-2xl p-8 text-center text-white">
        <h2 className="text-2xl font-bold mb-2">Ready to Try the Terminal?</h2>
        <p className="text-slate-300 mb-6">
          Press <kbd className="px-2 py-1 bg-white/20 rounded">Ctrl + K</kbd> anywhere in the CRM to open the command terminal
        </p>
        <Link href="/crm">
          <Button variant="secondary" size="lg" className="gap-2">
            <Terminal className="w-4 h-4" /> Go to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
