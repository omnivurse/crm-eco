'use client';

import Link from 'next/link';
import { ArrowLeft, Navigation, ChevronRight, Mic, MapPin } from 'lucide-react';

const NAVIGATION_COMMANDS = [
  {
    section: 'CRM Core',
    destinations: [
      { phrase: '"Show me leads" / "Go to leads"', destination: 'Leads Module', path: '/crm/modules/leads' },
      { phrase: '"Show me contacts"', destination: 'Contacts Module', path: '/crm/modules/contacts' },
      { phrase: '"Go to deals" / "Open deals"', destination: 'Deals Module', path: '/crm/modules/deals' },
      { phrase: '"Show pipeline"', destination: 'Deal Pipeline', path: '/crm/pipeline' },
      { phrase: '"Open calendar"', destination: 'Calendar', path: '/crm/calendar' },
      { phrase: '"Show me tasks"', destination: 'Tasks', path: '/crm/tasks' },
    ],
  },
  {
    section: 'Communications',
    destinations: [
      { phrase: '"Go to inbox"', destination: 'Email Inbox', path: '/crm/inbox' },
      { phrase: '"Show campaigns"', destination: 'Campaigns', path: '/crm/campaigns' },
      { phrase: '"Open communications"', destination: 'Communications Hub', path: '/crm/communications' },
    ],
  },
  {
    section: 'Analytics',
    destinations: [
      { phrase: '"Show reports" / "Go to reports"', destination: 'Reports Dashboard', path: '/crm/reports' },
      { phrase: '"Open analytics"', destination: 'Analytics', path: '/crm/analytics' },
      { phrase: '"Show dashboard" / "Go home"', destination: 'Main Dashboard', path: '/crm' },
    ],
  },
  {
    section: 'Administration',
    destinations: [
      { phrase: '"Open settings"', destination: 'Settings', path: '/crm/settings' },
      { phrase: '"Show members"', destination: 'Members Module', path: '/crm/modules/members' },
      { phrase: '"Go to advisors"', destination: 'Advisors Module', path: '/crm/modules/advisors' },
      { phrase: '"Show commissions"', destination: 'Commissions', path: '/crm/commissions' },
    ],
  },
];

const PHRASE_PATTERNS = [
  { pattern: '"Show me [destination]"', example: 'Show me leads' },
  { pattern: '"Go to [destination]"', example: 'Go to pipeline' },
  { pattern: '"Open [destination]"', example: 'Open calendar' },
  { pattern: '"Take me to [destination]"', example: 'Take me to reports' },
  { pattern: '"Navigate to [destination]"', example: 'Navigate to settings' },
];

export default function VoiceNavigationPage() {
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
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10">
            <Navigation className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              Voice Navigation
            </h1>
            <p className="text-slate-500 dark:text-slate-400">
              Navigate anywhere in the CRM using voice commands
            </p>
          </div>
        </div>
      </div>

      {/* Introduction */}
      <div className="prose prose-slate dark:prose-invert max-w-none mb-12">
        <p className="text-lg text-slate-600 dark:text-slate-300">
          Voice navigation lets you move between pages instantly by speaking natural commands.
          The system understands multiple ways of expressing the same intent, so you can speak naturally.
        </p>
      </div>

      {/* Phrase Patterns */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
          Navigation Phrases
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-4">
          You can use any of these patterns to navigate:
        </p>
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
          {PHRASE_PATTERNS.map((item, idx) => (
            <div key={idx} className="px-4 py-3 flex items-center justify-between">
              <code className="text-sm font-mono text-slate-700 dark:text-slate-300">
                {item.pattern}
              </code>
              <span className="text-sm text-slate-500 italic">e.g., "{item.example}"</span>
            </div>
          ))}
        </div>
      </section>

      {/* Destinations by Section */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-rose-500" />
          Available Destinations
        </h2>
        <div className="space-y-6">
          {NAVIGATION_COMMANDS.map((section) => (
            <div
              key={section.section}
              className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
            >
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-600">
                <h3 className="font-medium text-slate-900 dark:text-white">{section.section}</h3>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {section.destinations.map((dest, idx) => (
                  <div key={idx} className="px-4 py-3 grid grid-cols-3 gap-4 items-center">
                    <code className="text-sm font-mono text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 px-2 py-1 rounded">
                      {dest.phrase}
                    </code>
                    <span className="text-sm text-slate-700 dark:text-slate-300">{dest.destination}</span>
                    <Link
                      href={dest.path}
                      className="text-sm text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 justify-end"
                    >
                      Try it <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Fuzzy Matching */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
          Smart Matching
        </h2>
        <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-6 border border-blue-200 dark:border-blue-500/20">
          <p className="text-blue-800 dark:text-blue-200 mb-4">
            The voice system uses fuzzy matching, so it understands variations:
          </p>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="bg-white dark:bg-slate-800/50 rounded-lg p-3">
              <div className="text-slate-500 mb-1">All of these work:</div>
              <ul className="space-y-1 text-slate-700 dark:text-slate-300">
                <li>"Show me <strong>lead</strong>" → Leads</li>
                <li>"Show me <strong>leads</strong>" → Leads</li>
                <li>"Go to <strong>the leads</strong>" → Leads</li>
              </ul>
            </div>
            <div className="bg-white dark:bg-slate-800/50 rounded-lg p-3">
              <div className="text-slate-500 mb-1">Singular/plural understood:</div>
              <ul className="space-y-1 text-slate-700 dark:text-slate-300">
                <li>"contact" = "contacts"</li>
                <li>"deal" = "deals"</li>
                <li>"report" = "reports"</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Related */}
      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
        <div>
          <div className="text-sm text-slate-500">Next article</div>
          <div className="font-medium text-slate-900 dark:text-white">Voice Queries & Actions</div>
        </div>
        <Link href="/crm/learn/voice/commands">
          <button className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2">
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        </Link>
      </div>
    </div>
  );
}
