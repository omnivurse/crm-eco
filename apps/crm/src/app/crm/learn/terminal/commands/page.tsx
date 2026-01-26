'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  Terminal,
  Navigation,
  Plus,
  Search,
  Settings,
  ChevronRight,
  Zap,
  Users,
  DollarSign,
  Calendar,
  FileText,
  Mail,
  BarChart3,
  UserPlus,
} from 'lucide-react';

const NAVIGATION_COMMANDS = [
  { command: '/home', alias: '/h', description: 'Go to main dashboard' },
  { command: '/leads', alias: '/l', description: 'Open Leads module' },
  { command: '/contacts', alias: '/c', description: 'Open Contacts module' },
  { command: '/deals', alias: '/d', description: 'Open Deals module' },
  { command: '/pipeline', alias: '/p', description: 'Open Deal Pipeline view' },
  { command: '/calendar', alias: '/cal', description: 'Open Calendar' },
  { command: '/tasks', alias: '/t', description: 'Open Tasks' },
  { command: '/inbox', alias: '/i', description: 'Open Email Inbox' },
  { command: '/campaigns', alias: null, description: 'Open Campaigns' },
  { command: '/reports', alias: '/r', description: 'Open Reports & Analytics' },
  { command: '/settings', alias: '/s', description: 'Open Settings' },
];

const CREATE_COMMANDS = [
  { command: '/new lead', alias: '/nl', description: 'Create a new lead', icon: <UserPlus className="w-4 h-4" /> },
  { command: '/new contact', alias: '/nc', description: 'Create a new contact', icon: <Users className="w-4 h-4" /> },
  { command: '/new deal', alias: '/nd', description: 'Create a new deal', icon: <DollarSign className="w-4 h-4" /> },
  { command: '/new task', alias: '/nt', description: 'Create a new task', icon: <FileText className="w-4 h-4" /> },
  { command: '/new event', alias: '/ne', description: 'Create a calendar event', icon: <Calendar className="w-4 h-4" /> },
  { command: '/new campaign', alias: null, description: 'Create a new campaign', icon: <Mail className="w-4 h-4" /> },
  { command: '/new note', alias: null, description: 'Add note to current record', icon: <FileText className="w-4 h-4" /> },
];

const SEARCH_COMMANDS = [
  { command: '/search [query]', description: 'Global search across all modules' },
  { command: '/find [name]', description: 'Find contact or lead by name' },
  { command: '/search leads [query]', description: 'Search only in leads' },
  { command: '/search contacts [query]', description: 'Search only in contacts' },
  { command: '/search deals [query]', description: 'Search only in deals' },
];

const ACTION_COMMANDS = [
  { command: '/call [name]', description: 'Initiate a call to contact' },
  { command: '/email [name]', description: 'Open email composer for contact' },
  { command: '/sms [name]', description: 'Open SMS composer for contact' },
  { command: '/schedule [name]', description: 'Schedule a meeting with contact' },
  { command: '/assign [record] [user]', description: 'Assign record to team member' },
  { command: '/status [status]', description: 'Update current record status' },
];

const UTILITY_COMMANDS = [
  { command: '/theme dark', description: 'Switch to dark mode' },
  { command: '/theme light', description: 'Switch to light mode' },
  { command: '/theme system', description: 'Use system theme preference' },
  { command: '/help', alias: '/?', description: 'Show available commands' },
  { command: '/clear', description: 'Clear terminal history' },
  { command: '/reload', description: 'Refresh current page' },
  { command: '/logout', description: 'Sign out of the CRM' },
];

export default function TerminalCommandsPage() {
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
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10">
            <Zap className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              Available Commands
            </h1>
            <p className="text-slate-500 dark:text-slate-400">
              Complete reference of all terminal commands
            </p>
          </div>
        </div>
      </div>

      {/* Introduction */}
      <div className="prose prose-slate dark:prose-invert max-w-none mb-12">
        <p className="text-lg text-slate-600 dark:text-slate-300">
          The terminal supports a wide range of commands for navigation, creating records,
          searching, and performing actions. Most commands have shorter aliases for faster typing.
        </p>
      </div>

      {/* Navigation Commands */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Navigation className="w-5 h-5 text-blue-500" />
          Navigation Commands
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-4">
          Navigate to any page in the CRM instantly:
        </p>
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-600">
                  <th className="px-4 py-3 text-left font-medium text-slate-900 dark:text-white">Command</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-900 dark:text-white">Alias</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-900 dark:text-white">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {NAVIGATION_COMMANDS.map((cmd, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="px-4 py-3">
                      <code className="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded">
                        {cmd.command}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      {cmd.alias ? (
                        <code className="text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                          {cmd.alias}
                        </code>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{cmd.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Create Commands */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-emerald-500" />
          Create Commands
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-4">
          Quickly create new records:
        </p>
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {CREATE_COMMANDS.map((cmd, idx) => (
              <div key={idx} className="px-4 py-3 flex items-center gap-4">
                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  {cmd.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded">
                      {cmd.command}
                    </code>
                    {cmd.alias && (
                      <code className="text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-xs">
                        {cmd.alias}
                      </code>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{cmd.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Search Commands */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Search className="w-5 h-5 text-violet-500" />
          Search Commands
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-4">
          Find records quickly:
        </p>
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
          {SEARCH_COMMANDS.map((cmd, idx) => (
            <div key={idx} className="px-4 py-3 flex items-center justify-between">
              <code className="text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 px-2 py-1 rounded">
                {cmd.command}
              </code>
              <span className="text-sm text-slate-500 dark:text-slate-400">{cmd.description}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Action Commands */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-500" />
          Action Commands
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-4">
          Perform actions on records:
        </p>
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
          {ACTION_COMMANDS.map((cmd, idx) => (
            <div key={idx} className="px-4 py-3 flex items-center justify-between">
              <code className="text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded">
                {cmd.command}
              </code>
              <span className="text-sm text-slate-500 dark:text-slate-400">{cmd.description}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Utility Commands */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-slate-500" />
          Utility Commands
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-4">
          Settings and system commands:
        </p>
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-600">
                  <th className="px-4 py-3 text-left font-medium text-slate-900 dark:text-white">Command</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-900 dark:text-white">Alias</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-900 dark:text-white">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {UTILITY_COMMANDS.map((cmd, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="px-4 py-3">
                      <code className="text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                        {cmd.command}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      {'alias' in cmd && cmd.alias ? (
                        <code className="text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                          {cmd.alias}
                        </code>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{cmd.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Chaining Note */}
      <section className="mb-12">
        <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-6 border border-blue-200 dark:border-blue-500/20">
          <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Pro Tip: Command Chaining</h3>
          <p className="text-blue-800 dark:text-blue-200 mb-4">
            You can chain some commands together for faster workflows:
          </p>
          <div className="bg-white dark:bg-slate-800/50 rounded-lg p-4 font-mono text-sm">
            <div className="text-slate-600 dark:text-slate-400 mb-2">
              <span className="text-slate-400">$</span> /new lead --name "John Smith" --email "john@example.com"
            </div>
            <div className="text-emerald-600 dark:text-emerald-400">
              Created lead: John Smith
            </div>
          </div>
        </div>
      </section>

      {/* Related */}
      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
        <div>
          <div className="text-sm text-slate-500">Next article</div>
          <div className="font-medium text-slate-900 dark:text-white">Keyboard Shortcuts</div>
        </div>
        <Link href="/crm/learn/terminal/shortcuts">
          <button className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2">
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        </Link>
      </div>
    </div>
  );
}
