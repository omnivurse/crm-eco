'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Input } from '@crm-eco/ui/components/input';
import { Button } from '@crm-eco/ui/components/button';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  Search,
  BookOpen,
  Rocket,
  Users,
  UserPlus,
  DollarSign,
  Mail,
  Zap,
  GitBranch,
  BarChart3,
  Calendar,
  Settings,
  HelpCircle,
  PlayCircle,
  ChevronRight,
  Sparkles,
  Target,
  MessageCircle,
  Clock,
  CheckCircle,
  ArrowRight,
  Mic,
  Terminal,
} from 'lucide-react';
import { FeatureCard } from '@/components/learn/AnimatedDemo';

// Feature categories with articles
const CATEGORIES = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    description: 'Learn the basics and set up your CRM',
    icon: <Rocket className="w-6 h-6" />,
    color: 'teal',
    articles: [
      { title: 'Quick Start Guide', href: '/crm/learn/getting-started', time: '5 min' },
      { title: 'Understanding the Dashboard', href: '/crm/learn/getting-started/dashboard', time: '3 min' },
      { title: 'Setting Up Your Profile', href: '/crm/learn/getting-started/profile', time: '2 min' },
      { title: 'Navigating the CRM', href: '/crm/learn/getting-started/navigation', time: '4 min' },
    ],
  },
  {
    id: 'contacts',
    title: 'Managing Contacts',
    description: 'Organize and track your relationships',
    icon: <Users className="w-6 h-6" />,
    color: 'blue',
    articles: [
      { title: 'Creating Contacts', href: '/crm/learn/contacts/creating', time: '3 min' },
      { title: 'Importing Contacts', href: '/crm/learn/contacts/importing', time: '4 min' },
      { title: 'Contact Fields & Custom Fields', href: '/crm/learn/contacts/fields', time: '5 min' },
      { title: 'Merging Duplicate Contacts', href: '/crm/learn/contacts/merging', time: '3 min' },
    ],
  },
  {
    id: 'leads',
    title: 'Lead Management',
    description: 'Capture and qualify potential customers',
    icon: <UserPlus className="w-6 h-6" />,
    color: 'violet',
    articles: [
      { title: 'Understanding Leads', href: '/crm/learn/leads/overview', time: '4 min' },
      { title: 'Lead Scoring', href: '/crm/learn/leads/scoring', time: '5 min' },
      { title: 'Converting Leads', href: '/crm/learn/leads/converting', time: '3 min' },
      { title: 'Lead Assignment Rules', href: '/crm/learn/leads/assignment', time: '4 min' },
    ],
  },
  {
    id: 'deals',
    title: 'Deals & Pipeline',
    description: 'Track opportunities and close sales',
    icon: <DollarSign className="w-6 h-6" />,
    color: 'emerald',
    articles: [
      { title: 'Pipeline Overview', href: '/crm/learn/deals/pipeline', time: '4 min' },
      { title: 'Creating Deals', href: '/crm/learn/deals/creating', time: '3 min' },
      { title: 'Managing Deal Stages', href: '/crm/learn/deals/stages', time: '4 min' },
      { title: 'Forecasting Sales', href: '/crm/learn/deals/forecasting', time: '5 min' },
    ],
  },
  {
    id: 'campaigns',
    title: 'Email Campaigns',
    description: 'Send mass emails and track engagement',
    icon: <Mail className="w-6 h-6" />,
    color: 'amber',
    articles: [
      { title: 'Creating a Campaign', href: '/crm/learn/campaigns/creating', time: '5 min' },
      { title: 'Selecting Recipients', href: '/crm/learn/campaigns/recipients', time: '4 min' },
      { title: 'Email Templates', href: '/crm/learn/campaigns/templates', time: '4 min' },
      { title: 'Tracking & Analytics', href: '/crm/learn/campaigns/analytics', time: '5 min' },
    ],
  },
  {
    id: 'sequences',
    title: 'Email Sequences',
    description: 'Automate multi-step email nurturing',
    icon: <Zap className="w-6 h-6" />,
    color: 'rose',
    articles: [
      { title: 'What are Sequences?', href: '/crm/learn/sequences/overview', time: '3 min' },
      { title: 'Building a Sequence', href: '/crm/learn/sequences/building', time: '6 min' },
      { title: 'Enrolling Contacts', href: '/crm/learn/sequences/enrolling', time: '3 min' },
      { title: 'Sequence Analytics', href: '/crm/learn/sequences/analytics', time: '4 min' },
    ],
  },
  {
    id: 'workflows',
    title: 'Workflow Automation',
    description: 'Automate repetitive tasks',
    icon: <GitBranch className="w-6 h-6" />,
    color: 'violet',
    articles: [
      { title: 'Workflow Basics', href: '/crm/learn/workflows/basics', time: '4 min' },
      { title: 'Creating Workflows', href: '/crm/learn/workflows/creating', time: '6 min' },
      { title: 'Triggers & Actions', href: '/crm/learn/workflows/triggers', time: '5 min' },
      { title: 'Testing Workflows', href: '/crm/learn/workflows/testing', time: '3 min' },
    ],
  },
  {
    id: 'reports',
    title: 'Reports & Analytics',
    description: 'Gain insights from your data',
    icon: <BarChart3 className="w-6 h-6" />,
    color: 'blue',
    articles: [
      { title: 'Reports Overview', href: '/crm/learn/reports', time: '3 min' },
      { title: 'Using Report Templates', href: '/crm/learn/reports/templates', time: '5 min' },
      { title: 'Building Custom Reports', href: '/crm/learn/reports/custom', time: '6 min' },
      { title: 'Exporting Data', href: '/crm/learn/reports/exporting', time: '3 min' },
    ],
  },
  {
    id: 'voice',
    title: 'Voice Commands',
    description: 'Control your CRM with your voice',
    icon: <Mic className="w-6 h-6" />,
    color: 'rose',
    articles: [
      { title: 'Getting Started with Voice', href: '/crm/learn/voice', time: '3 min' },
      { title: 'Voice Navigation', href: '/crm/learn/voice/navigation', time: '4 min' },
      { title: 'Voice Queries & Actions', href: '/crm/learn/voice/commands', time: '5 min' },
      { title: 'Voice Settings', href: '/crm/learn/voice/settings', time: '2 min' },
    ],
  },
  {
    id: 'terminal',
    title: 'Command Terminal',
    description: 'Power-user keyboard shortcuts',
    icon: <Terminal className="w-6 h-6" />,
    color: 'slate',
    articles: [
      { title: 'Terminal Basics', href: '/crm/learn/terminal', time: '3 min' },
      { title: 'Available Commands', href: '/crm/learn/terminal/commands', time: '5 min' },
      { title: 'Keyboard Shortcuts', href: '/crm/learn/terminal/shortcuts', time: '3 min' },
    ],
  },
];

const QUICK_LINKS = [
  { title: 'Video Tutorials', icon: <PlayCircle className="w-5 h-5" />, href: '/crm/learn/videos' },
  { title: 'FAQs', icon: <HelpCircle className="w-5 h-5" />, href: '/crm/learn/faq' },
  { title: 'What\'s New', icon: <Sparkles className="w-5 h-5" />, href: '/crm/learn/changelog' },
  { title: 'Contact Support', icon: <MessageCircle className="w-5 h-5" />, href: 'mailto:support@crmeco.com' },
];

export default function LearnPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Filter categories based on search
  const filteredCategories = CATEGORIES.filter(cat => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      cat.title.toLowerCase().includes(query) ||
      cat.description.toLowerCase().includes(query) ||
      cat.articles.some(a => a.title.toLowerCase().includes(query))
    );
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-500 via-emerald-500 to-cyan-500 p-8 md:p-12">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-white/10 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-8 h-8 text-white" />
            <span className="text-white/80 font-medium">Learning Center</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Master CRM Eco
          </h1>
          <p className="text-lg text-white/80 max-w-2xl mb-8">
            Learn how to get the most out of your CRM with step-by-step tutorials,
            animated demos, and expert tips.
          </p>

          {/* Search Bar */}
          <div className="relative max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              placeholder="Search tutorials, guides, and features..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-14 text-lg bg-white/95 dark:bg-slate-900/95 border-0 shadow-xl"
            />
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.title}
            href={link.href}
            className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 hover:border-teal-500/50 hover:shadow-md transition-all group"
          >
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 group-hover:bg-teal-500/10 group-hover:text-teal-500 transition-colors">
              {link.icon}
            </div>
            <span className="font-medium text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
              {link.title}
            </span>
          </Link>
        ))}
      </div>

      {/* Getting Started Banner */}
      <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 dark:from-violet-500/20 dark:to-purple-500/20 border border-violet-200 dark:border-violet-500/30 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500">
          <Rocket className="w-10 h-10 text-white" />
        </div>
        <div className="flex-1 text-center md:text-left">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            New to CRM Eco?
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            Start with our 5-minute quick start guide and learn the essentials to get up and running.
          </p>
        </div>
        <Link href="/crm/learn/getting-started">
          <Button size="lg" className="gap-2">
            Get Started
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>

      {/* Feature Categories */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
          Browse by Feature
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(
                selectedCategory === category.id ? null : category.id
              )}
              className={cn(
                'text-left p-5 rounded-2xl border transition-all',
                selectedCategory === category.id
                  ? 'bg-teal-50 dark:bg-teal-500/10 border-teal-500'
                  : 'bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              )}
            >
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center mb-3',
                category.color === 'teal' && 'bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400',
                category.color === 'blue' && 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
                category.color === 'violet' && 'bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400',
                category.color === 'emerald' && 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
                category.color === 'amber' && 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400',
                category.color === 'rose' && 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400',
                category.color === 'slate' && 'bg-slate-200 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400',
              )}>
                {category.icon}
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                {category.title}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {category.articles.length} articles
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Selected Category Articles */}
      {selectedCategory && (
        <div className="animate-fade-in-up">
          {(() => {
            const category = CATEGORIES.find(c => c.id === selectedCategory);
            if (!category) return null;

            return (
              <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center',
                      category.color === 'teal' && 'bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400',
                      category.color === 'blue' && 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
                      category.color === 'violet' && 'bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400',
                      category.color === 'emerald' && 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
                      category.color === 'amber' && 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400',
                      category.color === 'rose' && 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400',
                      category.color === 'slate' && 'bg-slate-200 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400',
                    )}>
                      {category.icon}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                        {category.title}
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {category.description}
                      </p>
                    </div>
                  </div>
                  <Link href={`/crm/learn/${category.id}`}>
                    <Button variant="outline" size="sm">
                      View All
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                </div>

                <div className="grid gap-3">
                  {category.articles.map((article) => (
                    <Link
                      key={article.href}
                      href={article.href}
                      className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-teal-500 transition-colors" />
                        <span className="font-medium text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                          {article.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Clock className="w-4 h-4" />
                        {article.time}
                        <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Popular Articles */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
          Popular Articles
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              title: 'Setting Up Your Sales Pipeline',
              category: 'Deals',
              time: '5 min',
              href: '/crm/learn/deals/pipeline',
              icon: <Target className="w-5 h-5" />,
            },
            {
              title: 'Importing Contacts from CSV',
              category: 'Contacts',
              time: '4 min',
              href: '/crm/learn/contacts/importing',
              icon: <Users className="w-5 h-5" />,
            },
            {
              title: 'Creating Your First Email Campaign',
              category: 'Campaigns',
              time: '6 min',
              href: '/crm/learn/campaigns/creating',
              icon: <Mail className="w-5 h-5" />,
            },
          ].map((article) => (
            <Link
              key={article.href}
              href={article.href}
              className="group p-5 rounded-2xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 hover:border-teal-500/50 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {article.icon}
                </div>
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  {article.category}
                </span>
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-2 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                {article.title}
              </h3>
              <div className="flex items-center gap-1 text-sm text-slate-500">
                <Clock className="w-4 h-4" />
                {article.time} read
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Need Help Banner */}
      <div className="bg-slate-900 dark:bg-slate-800 rounded-2xl p-8 text-center">
        <h2 className="text-2xl font-bold text-white mb-3">
          Still have questions?
        </h2>
        <p className="text-slate-400 mb-6 max-w-lg mx-auto">
          Our support team is here to help. Reach out and we'll get back to you within 24 hours.
        </p>
        <div className="flex items-center justify-center gap-4">
          <a href="mailto:support@crmeco.com">
            <Button variant="outline" className="border-slate-600 text-white hover:bg-slate-800">
              <Mail className="w-4 h-4 mr-2" />
              Email Support
            </Button>
          </a>
          <Link href="/crm/learn/faq">
            <Button className="bg-teal-500 hover:bg-teal-600">
              <HelpCircle className="w-4 h-4 mr-2" />
              Browse FAQs
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
