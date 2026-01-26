'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  Search,
  Plus,
  Edit,
  Phone,
  Mail,
  Calendar,
  ChevronRight,
  MessageSquare,
  Zap,
} from 'lucide-react';

const QUERY_COMMANDS = [
  {
    category: 'Counting & Stats',
    commands: [
      { phrase: '"How many leads today?"', result: 'Returns count of leads created today' },
      { phrase: '"How many deals this week?"', result: 'Returns count of deals for current week' },
      { phrase: '"How many contacts this month?"', result: 'Returns contact count for current month' },
      { phrase: '"Show my task count"', result: 'Returns number of open tasks' },
    ],
  },
  {
    category: 'Pipeline & Revenue',
    commands: [
      { phrase: '"What\'s my pipeline worth?"', result: 'Returns total pipeline value' },
      { phrase: '"What\'s closing this week?"', result: 'Shows deals closing this week with value' },
      { phrase: '"How\'s my performance this month?"', result: 'Shows monthly metrics summary' },
    ],
  },
  {
    category: 'Top Records',
    commands: [
      { phrase: '"Who\'s my hottest lead?"', result: 'Shows highest-scoring lead' },
      { phrase: '"What\'s my biggest deal?"', result: 'Shows largest deal by value' },
      { phrase: '"Show today\'s summary"', result: 'Daily activity and metrics overview' },
    ],
  },
];

const CREATE_COMMANDS = [
  {
    category: 'Tasks',
    commands: [
      { phrase: '"Create a task for tomorrow"', result: 'Creates task due tomorrow', fields: 'Opens task editor' },
      { phrase: '"Add a task: Call John"', result: 'Creates task with title', fields: 'Title: "Call John"' },
      { phrase: '"Remind me to follow up Friday"', result: 'Creates follow-up task', fields: 'Due: Friday' },
    ],
  },
  {
    category: 'Notes',
    commands: [
      { phrase: '"Add a note"', result: 'Adds note to current record', fields: 'Opens note editor' },
      { phrase: '"Note: Customer interested in upgrade"', result: 'Creates note with content', fields: 'Auto-fills content' },
    ],
  },
];

const UPDATE_COMMANDS = [
  {
    category: 'Deal Updates',
    commands: [
      { phrase: '"Mark this deal as won"', result: 'Updates deal status to Won' },
      { phrase: '"Mark deal as lost"', result: 'Updates deal status to Lost' },
      { phrase: '"Move lead to qualified"', result: 'Updates lead stage' },
      { phrase: '"Update deal value to 50k"', result: 'Changes deal amount' },
    ],
  },
];

const COMMUNICATION_COMMANDS = [
  {
    category: 'Calls & Messages',
    commands: [
      { phrase: '"Call John Smith"', result: 'Initiates call to contact', icon: <Phone className="w-4 h-4" /> },
      { phrase: '"Email Sarah about the proposal"', result: 'Opens email composer', icon: <Mail className="w-4 h-4" /> },
      { phrase: '"Send text to Mike"', result: 'Opens SMS composer', icon: <MessageSquare className="w-4 h-4" /> },
    ],
  },
  {
    category: 'Meetings',
    commands: [
      { phrase: '"Schedule a meeting with Lisa"', result: 'Opens meeting scheduler', icon: <Calendar className="w-4 h-4" /> },
      { phrase: '"Book a call with the team"', result: 'Creates calendar event', icon: <Calendar className="w-4 h-4" /> },
    ],
  },
];

export default function VoiceCommandsPage() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/crm/learn/voice"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Voice Commands
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-500/10">
            <Zap className="w-8 h-8 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              Voice Queries & Actions
            </h1>
            <p className="text-slate-500 dark:text-slate-400">
              Query data and perform actions with voice commands
            </p>
          </div>
        </div>
      </div>

      {/* Introduction */}
      <div className="prose prose-slate dark:prose-invert max-w-none mb-12">
        <p className="text-lg text-slate-600 dark:text-slate-300">
          Beyond navigation, you can query your CRM data, create new records, update existing ones,
          and initiate communications - all through voice commands.
        </p>
      </div>

      {/* Query Commands */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Search className="w-5 h-5 text-blue-500" />
          Query Commands
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-4">
          Ask questions about your data and get instant answers:
        </p>
        <div className="space-y-6">
          {QUERY_COMMANDS.map((section) => (
            <div
              key={section.category}
              className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
            >
              <div className="px-4 py-3 bg-blue-50 dark:bg-blue-500/10 border-b border-slate-200 dark:border-slate-600">
                <h3 className="font-medium text-blue-900 dark:text-blue-100">{section.category}</h3>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {section.commands.map((cmd, idx) => (
                  <div key={idx} className="px-4 py-3 flex items-center justify-between gap-4">
                    <code className="text-sm font-mono text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 px-2 py-1 rounded flex-shrink-0">
                      {cmd.phrase}
                    </code>
                    <span className="text-sm text-slate-500 dark:text-slate-400 text-right">{cmd.result}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Create Commands */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-emerald-500" />
          Create Commands
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-4">
          Create new records with voice:
        </p>
        <div className="space-y-6">
          {CREATE_COMMANDS.map((section) => (
            <div
              key={section.category}
              className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
            >
              <div className="px-4 py-3 bg-emerald-50 dark:bg-emerald-500/10 border-b border-slate-200 dark:border-slate-600">
                <h3 className="font-medium text-emerald-900 dark:text-emerald-100">{section.category}</h3>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {section.commands.map((cmd, idx) => (
                  <div key={idx} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-4 mb-1">
                      <code className="text-sm font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded">
                        {cmd.phrase}
                      </code>
                      <span className="text-sm text-slate-500 dark:text-slate-400">{cmd.result}</span>
                    </div>
                    <div className="text-xs text-slate-400 ml-1">{cmd.fields}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Update Commands */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Edit className="w-5 h-5 text-amber-500" />
          Update Commands
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-4">
          Update existing records:
        </p>
        <div className="space-y-6">
          {UPDATE_COMMANDS.map((section) => (
            <div
              key={section.category}
              className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
            >
              <div className="px-4 py-3 bg-amber-50 dark:bg-amber-500/10 border-b border-slate-200 dark:border-slate-600">
                <h3 className="font-medium text-amber-900 dark:text-amber-100">{section.category}</h3>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {section.commands.map((cmd, idx) => (
                  <div key={idx} className="px-4 py-3 flex items-center justify-between gap-4">
                    <code className="text-sm font-mono text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded">
                      {cmd.phrase}
                    </code>
                    <span className="text-sm text-slate-500 dark:text-slate-400">{cmd.result}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Communication Commands */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Phone className="w-5 h-5 text-rose-500" />
          Communication Commands
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-4">
          Initiate calls, emails, and meetings:
        </p>
        <div className="space-y-6">
          {COMMUNICATION_COMMANDS.map((section) => (
            <div
              key={section.category}
              className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
            >
              <div className="px-4 py-3 bg-rose-50 dark:bg-rose-500/10 border-b border-slate-200 dark:border-slate-600">
                <h3 className="font-medium text-rose-900 dark:text-rose-100">{section.category}</h3>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {section.commands.map((cmd, idx) => (
                  <div key={idx} className="px-4 py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">{cmd.icon}</span>
                      <code className="text-sm font-mono text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 px-2 py-1 rounded">
                        {cmd.phrase}
                      </code>
                    </div>
                    <span className="text-sm text-slate-500 dark:text-slate-400">{cmd.result}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Context Awareness */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
          Context Awareness
        </h2>
        <div className="bg-violet-50 dark:bg-violet-500/10 rounded-xl p-6 border border-violet-200 dark:border-violet-500/20">
          <p className="text-violet-800 dark:text-violet-200 mb-4">
            Voice commands understand context. When viewing a record, you can use pronouns:
          </p>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="bg-white dark:bg-slate-800/50 rounded-lg p-3">
              <div className="font-medium text-slate-700 dark:text-slate-300 mb-2">While viewing a contact:</div>
              <ul className="space-y-1 text-slate-600 dark:text-slate-400">
                <li>"Call <strong>them</strong>" → Calls the contact</li>
                <li>"Email <strong>this person</strong>" → Emails the contact</li>
                <li>"Add a note to <strong>this contact</strong>"</li>
              </ul>
            </div>
            <div className="bg-white dark:bg-slate-800/50 rounded-lg p-3">
              <div className="font-medium text-slate-700 dark:text-slate-300 mb-2">While viewing a deal:</div>
              <ul className="space-y-1 text-slate-600 dark:text-slate-400">
                <li>"Mark <strong>this</strong> as won"</li>
                <li>"Update <strong>the deal</strong> value"</li>
                <li>"Close <strong>it</strong>"</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Related */}
      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
        <div>
          <div className="text-sm text-slate-500">Next article</div>
          <div className="font-medium text-slate-900 dark:text-white">Voice Settings</div>
        </div>
        <Link href="/crm/learn/voice/settings">
          <button className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2">
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        </Link>
      </div>
    </div>
  );
}
