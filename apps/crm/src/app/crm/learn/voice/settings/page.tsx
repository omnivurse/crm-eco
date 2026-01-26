'use client';

import Link from 'next/link';
import { ArrowLeft, Settings, Volume2, VolumeX, Mic, Globe, ChevronRight, Sliders } from 'lucide-react';

const SETTINGS = [
  {
    name: 'Speak Responses',
    description: 'When enabled, the system will read responses aloud using text-to-speech',
    icon: <Volume2 className="w-5 h-5" />,
    type: 'toggle',
    default: 'Enabled',
  },
  {
    name: 'Show Transcript',
    description: 'Display what the system heard in real-time as you speak',
    icon: <Mic className="w-5 h-5" />,
    type: 'toggle',
    default: 'Enabled',
  },
  {
    name: 'Language',
    description: 'The language for speech recognition and responses',
    icon: <Globe className="w-5 h-5" />,
    type: 'select',
    default: 'English (US)',
    options: ['English (US)', 'English (UK)', 'Spanish', 'French', 'German'],
  },
  {
    name: 'Confidence Threshold',
    description: 'Minimum confidence level required to execute commands (higher = more accurate)',
    icon: <Sliders className="w-5 h-5" />,
    type: 'slider',
    default: '70%',
    range: '50% - 95%',
  },
  {
    name: 'Activation Method',
    description: 'How to activate voice listening',
    icon: <Mic className="w-5 h-5" />,
    type: 'select',
    default: 'Toggle (click to start/stop)',
    options: ['Toggle (click to start/stop)', 'Hold to speak'],
  },
  {
    name: 'Continuous Listening',
    description: 'Keep listening for commands after each response (experimental)',
    icon: <Mic className="w-5 h-5" />,
    type: 'toggle',
    default: 'Disabled',
  },
];

export default function VoiceSettingsPage() {
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
          <div className="p-3 rounded-xl bg-gradient-to-br from-slate-500/10 to-gray-500/10">
            <Settings className="w-8 h-8 text-slate-600 dark:text-slate-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              Voice Settings
            </h1>
            <p className="text-slate-500 dark:text-slate-400">
              Customize your voice command experience
            </p>
          </div>
        </div>
      </div>

      {/* Introduction */}
      <div className="prose prose-slate dark:prose-invert max-w-none mb-12">
        <p className="text-lg text-slate-600 dark:text-slate-300">
          Customize how voice commands work for your workflow. Access these settings from the
          Voice Command Center panel by clicking the settings icon.
        </p>
      </div>

      {/* Settings Reference */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
          Available Settings
        </h2>
        <div className="space-y-4">
          {SETTINGS.map((setting) => (
            <div
              key={setting.name}
              className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4"
            >
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400">
                  {setting.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-medium text-slate-900 dark:text-white">{setting.name}</h3>
                    <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-400">
                      {setting.type}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                    {setting.description}
                  </p>
                  <div className="text-sm">
                    <span className="text-slate-400">Default:</span>{' '}
                    <span className="text-teal-600 dark:text-teal-400">{setting.default}</span>
                    {setting.options && (
                      <span className="text-slate-400 ml-2">
                        | Options: {setting.options.join(', ')}
                      </span>
                    )}
                    {setting.range && (
                      <span className="text-slate-400 ml-2">| Range: {setting.range}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Accessing Settings */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
          How to Access Settings
        </h2>
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <ol className="space-y-4">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center text-sm font-medium">1</span>
              <span className="text-slate-600 dark:text-slate-300">
                Open the Voice Command Center by clicking the mic button or pressing{' '}
                <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs">Ctrl</kbd>+
                <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs">Space</kbd>
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center text-sm font-medium">2</span>
              <span className="text-slate-600 dark:text-slate-300">
                Click the <strong>speaker icon</strong> in the header to toggle audio responses on/off quickly
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center text-sm font-medium">3</span>
              <span className="text-slate-600 dark:text-slate-300">
                For full settings access, go to <strong>Settings → Voice Commands</strong> in the CRM
              </span>
            </li>
          </ol>
        </div>
      </section>

      {/* Troubleshooting */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
          Troubleshooting
        </h2>
        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl p-4 border border-amber-200 dark:border-amber-500/20">
            <h3 className="font-medium text-amber-900 dark:text-amber-100 mb-2">Microphone not working?</h3>
            <ul className="text-sm text-amber-800 dark:text-amber-200 space-y-1">
              <li>• Check that your browser has microphone permission for this site</li>
              <li>• Ensure your microphone is not muted at the system level</li>
              <li>• Try a different browser (Chrome or Edge work best)</li>
            </ul>
          </div>
          <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl p-4 border border-amber-200 dark:border-amber-500/20">
            <h3 className="font-medium text-amber-900 dark:text-amber-100 mb-2">Commands not recognized?</h3>
            <ul className="text-sm text-amber-800 dark:text-amber-200 space-y-1">
              <li>• Try speaking more clearly and at a moderate pace</li>
              <li>• Reduce background noise</li>
              <li>• Lower the confidence threshold in settings</li>
              <li>• Check the transcript to see what was heard</li>
            </ul>
          </div>
          <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl p-4 border border-amber-200 dark:border-amber-500/20">
            <h3 className="font-medium text-amber-900 dark:text-amber-100 mb-2">No audio responses?</h3>
            <ul className="text-sm text-amber-800 dark:text-amber-200 space-y-1">
              <li>• Make sure "Speak Responses" is enabled</li>
              <li>• Check that your system volume is not muted</li>
              <li>• Some browsers may require user interaction before playing audio</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Related Links */}
      <div className="grid md:grid-cols-2 gap-4">
        <Link
          href="/crm/learn/voice"
          className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors flex items-center justify-between"
        >
          <div>
            <div className="text-sm text-slate-500">Back to</div>
            <div className="font-medium text-slate-900 dark:text-white">Voice Overview</div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400" />
        </Link>
        <Link
          href="/crm/learn/terminal"
          className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors flex items-center justify-between"
        >
          <div>
            <div className="text-sm text-slate-500">Next topic</div>
            <div className="font-medium text-slate-900 dark:text-white">Command Terminal</div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400" />
        </Link>
      </div>
    </div>
  );
}
