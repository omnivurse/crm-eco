'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import {
  ArrowLeft,
  PlayCircle,
  Clock,
  Users,
  Target,
  Mail,
  Zap,
  GitBranch,
  BarChart3,
  Rocket,
} from 'lucide-react';

const VIDEOS = [
  {
    title: 'Getting Started with CRM Eco',
    description: 'A complete walkthrough of setting up your account and navigating the CRM.',
    duration: '8 min',
    category: 'Getting Started',
    icon: <Rocket className="w-5 h-5" />,
    thumbnail: 'bg-gradient-to-br from-teal-500 to-emerald-500',
  },
  {
    title: 'Managing Contacts & Companies',
    description: 'Learn how to add, organize, and manage your contact database effectively.',
    duration: '12 min',
    category: 'Contacts',
    icon: <Users className="w-5 h-5" />,
    thumbnail: 'bg-gradient-to-br from-blue-500 to-cyan-500',
  },
  {
    title: 'Mastering the Sales Pipeline',
    description: 'Drag-and-drop deals, customize stages, and track your sales process.',
    duration: '15 min',
    category: 'Deals',
    icon: <Target className="w-5 h-5" />,
    thumbnail: 'bg-gradient-to-br from-emerald-500 to-teal-500',
  },
  {
    title: 'Email Campaigns Deep Dive',
    description: 'Create, send, and analyze mass email campaigns with tracking.',
    duration: '18 min',
    category: 'Campaigns',
    icon: <Mail className="w-5 h-5" />,
    thumbnail: 'bg-gradient-to-br from-amber-500 to-orange-500',
  },
  {
    title: 'Building Email Sequences',
    description: 'Set up automated multi-step email sequences for lead nurturing.',
    duration: '14 min',
    category: 'Sequences',
    icon: <Zap className="w-5 h-5" />,
    thumbnail: 'bg-gradient-to-br from-rose-500 to-pink-500',
  },
  {
    title: 'Workflow Automation Masterclass',
    description: 'Automate repetitive tasks with triggers, conditions, and actions.',
    duration: '20 min',
    category: 'Workflows',
    icon: <GitBranch className="w-5 h-5" />,
    thumbnail: 'bg-gradient-to-br from-violet-500 to-purple-500',
  },
  {
    title: 'Reports & Analytics',
    description: 'Build custom reports, schedule delivery, and export your data.',
    duration: '16 min',
    category: 'Reports',
    icon: <BarChart3 className="w-5 h-5" />,
    thumbnail: 'bg-gradient-to-br from-blue-500 to-indigo-500',
  },
];

export default function VideosPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/crm/learn" className="text-slate-500 hover:text-teal-600 transition-colors">
          Learning Center
        </Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-900 dark:text-white font-medium">Video Tutorials</span>
      </div>

      {/* Header */}
      <div className="text-center">
        <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-500 mb-6">
          <PlayCircle className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
          Video Tutorials
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          Learn CRM Eco through step-by-step video guides. Watch at your own pace
          and follow along.
        </p>
      </div>

      {/* Video Grid */}
      <div className="grid gap-6">
        {VIDEOS.map((video) => (
          <div
            key={video.title}
            className="group flex flex-col sm:flex-row gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 hover:border-teal-500/50 hover:shadow-lg transition-all cursor-pointer"
          >
            {/* Thumbnail */}
            <div className={`relative flex-shrink-0 w-full sm:w-48 h-32 rounded-xl ${video.thumbnail} flex items-center justify-center`}>
              <div className="absolute inset-0 bg-black/20 rounded-xl" />
              <PlayCircle className="w-12 h-12 text-white relative z-10 group-hover:scale-110 transition-transform" />
              <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/60 text-white text-xs">
                {video.duration}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-medium">
                  {video.icon}
                  {video.category}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                {video.title}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {video.description}
              </p>
              <div className="flex items-center gap-4 mt-3 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {video.duration}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Coming Soon */}
      <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-center">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
          More Videos Coming Soon
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          We're constantly adding new tutorials. Have a topic you'd like us to cover?
        </p>
        <a href="mailto:support@crmeco.com">
          <Button variant="outline">
            Request a Tutorial
          </Button>
        </a>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-center border-t border-slate-200 dark:border-slate-700 pt-8">
        <Link href="/crm/learn">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Learning Center
          </Button>
        </Link>
      </div>
    </div>
  );
}
