'use client';

import Link from 'next/link';
import {
  Mic,
  MicOff,
  Volume2,
  Navigation,
  Search,
  Plus,
  Settings,
  ArrowLeft,
  ChevronRight,
  Keyboard,
  MessageSquare,
  Zap,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';

const VOICE_COMMANDS = [
  {
    category: 'Navigation',
    icon: <Navigation className="w-5 h-5" />,
    commands: [
      { phrase: '"Show me leads"', action: 'Opens the Leads module' },
      { phrase: '"Go to pipeline"', action: 'Opens the Deal Pipeline' },
      { phrase: '"Open calendar"', action: 'Opens the Calendar' },
      { phrase: '"Take me to reports"', action: 'Opens Reports page' },
    ],
  },
  {
    category: 'Queries',
    icon: <Search className="w-5 h-5" />,
    commands: [
      { phrase: '"How many deals this week?"', action: 'Shows deal count for current week' },
      { phrase: '"What\'s my pipeline worth?"', action: 'Shows total pipeline value' },
      { phrase: '"Show today\'s summary"', action: 'Displays daily activity summary' },
      { phrase: '"Who\'s my hottest lead?"', action: 'Shows top-scoring lead' },
    ],
  },
  {
    category: 'Actions',
    icon: <Plus className="w-5 h-5" />,
    commands: [
      { phrase: '"Create a task for tomorrow"', action: 'Creates a new task due tomorrow' },
      { phrase: '"Add a note"', action: 'Adds a note to current record' },
      { phrase: '"Schedule a meeting with..."', action: 'Opens meeting scheduler' },
      { phrase: '"Mark deal as won"', action: 'Updates deal status to Won' },
    ],
  },
  {
    category: 'Communication',
    icon: <MessageSquare className="w-5 h-5" />,
    commands: [
      { phrase: '"Call John Smith"', action: 'Initiates a call' },
      { phrase: '"Email Sarah about..."', action: 'Opens email composer' },
      { phrase: '"Send text to..."', action: 'Opens SMS composer' },
    ],
  },
  {
    category: 'Control',
    icon: <Settings className="w-5 h-5" />,
    commands: [
      { phrase: '"Switch to dark mode"', action: 'Enables dark theme' },
      { phrase: '"Open terminal"', action: 'Opens Command Terminal' },
      { phrase: '"Help"', action: 'Shows available commands' },
    ],
  },
];

const RELATED_ARTICLES = [
  { title: 'Voice Navigation', href: '/crm/learn/voice/navigation', time: '4 min' },
  { title: 'Voice Queries & Actions', href: '/crm/learn/voice/commands', time: '5 min' },
  { title: 'Voice Settings', href: '/crm/learn/voice/settings', time: '2 min' },
];

export default function VoiceLearnPage() {
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
          <div className="p-3 rounded-xl bg-gradient-to-br from-rose-500/10 to-pink-500/10">
            <Mic className="w-8 h-8 text-rose-600 dark:text-rose-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              Voice Command Center
            </h1>
            <p className="text-slate-500 dark:text-slate-400">
              Control your CRM with natural voice commands
            </p>
          </div>
        </div>
      </div>

      {/* Introduction */}
      <div className="prose prose-slate dark:prose-invert max-w-none mb-12">
        <p className="text-lg text-slate-600 dark:text-slate-300">
          The Voice Command Center lets you control your CRM using natural speech. Navigate pages,
          query data, create records, and perform actions - all hands-free. It's designed to boost
          your productivity by letting you work faster without touching your keyboard.
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
              <h3 className="font-medium text-slate-900 dark:text-white mb-3">How to Activate</h3>
              <ol className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center text-xs font-medium">1</span>
                  <span>Click the <strong>microphone button</strong> in the bottom-right corner, or press <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs">Ctrl</kbd>+<kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs">Space</kbd></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center text-xs font-medium">2</span>
                  <span>Allow microphone access when prompted by your browser</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center text-xs font-medium">3</span>
                  <span>Speak naturally - say commands like "Show me leads" or "How many deals this week?"</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center text-xs font-medium">4</span>
                  <span>The system will process your command and respond with speech and on-screen feedback</span>
                </li>
              </ol>
            </div>
            <div>
              <h3 className="font-medium text-slate-900 dark:text-white mb-3">Keyboard Shortcuts</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <span className="text-slate-600 dark:text-slate-300">Open Voice Panel</span>
                  <kbd className="px-2 py-1 bg-white dark:bg-slate-600 rounded shadow-sm text-xs">Ctrl + Space</kbd>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <span className="text-slate-600 dark:text-slate-300">Close Voice Panel</span>
                  <kbd className="px-2 py-1 bg-white dark:bg-slate-600 rounded shadow-sm text-xs">Escape</kbd>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <span className="text-slate-600 dark:text-slate-300">Toggle Listening</span>
                  <kbd className="px-2 py-1 bg-white dark:bg-slate-600 rounded shadow-sm text-xs">Space</kbd>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Command Reference */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-500" />
          Command Reference
        </h2>
        <div className="space-y-6">
          {VOICE_COMMANDS.map((category) => (
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
                    <code className="text-sm font-mono text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 px-2 py-1 rounded">
                      {cmd.phrase}
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
                  <li>Speak clearly at a normal pace</li>
                  <li>Use natural phrases like "show me" or "go to"</li>
                  <li>Wait for the listening indicator before speaking</li>
                  <li>Check the transcript to verify what was heard</li>
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
                  <li>Speaking too fast or too slow</li>
                  <li>Background noise during commands</li>
                  <li>Speaking before the panel is ready</li>
                  <li>Very long or complex sentences</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Browser Support */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
          Browser Support
        </h2>
        <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl p-4 border border-amber-200 dark:border-amber-500/20">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Voice commands use the Web Speech API and work best in <strong>Google Chrome</strong> and <strong>Microsoft Edge</strong>.
            Safari has limited support. Firefox does not currently support the Web Speech API.
          </p>
        </div>
      </section>

      {/* Related Articles */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
          Related Articles
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
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
      <div className="bg-gradient-to-r from-rose-500 to-pink-500 rounded-2xl p-8 text-center text-white">
        <h2 className="text-2xl font-bold mb-2">Ready to Try Voice Commands?</h2>
        <p className="text-rose-100 mb-6">
          Press <kbd className="px-2 py-1 bg-white/20 rounded">Ctrl + Space</kbd> anywhere in the CRM to get started
        </p>
        <Link href="/crm">
          <Button variant="secondary" size="lg" className="gap-2">
            <Mic className="w-4 h-4" /> Go to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
