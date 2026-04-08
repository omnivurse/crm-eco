'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Input } from '@crm-eco/ui/components/input';
import { Button } from '@crm-eco/ui/components/button';
import { cn } from '@crm-eco/ui';
import {
  Search,
  BookOpen,
  Rocket,
  Users,
  UserCog,
  CreditCard,
  Mail,
  Layers,
  FileText,
  Terminal,
  Settings,
  HelpCircle,
  PlayCircle,
  ChevronRight,
  Sparkles,
  MessageCircle,
  Clock,
  CheckCircle,
  ArrowRight,
} from 'lucide-react';

const CATEGORIES = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    description: 'Learn the basics and set up your workspace',
    icon: <Rocket className="w-6 h-6" />,
    color: 'teal',
    articles: [
      { title: 'Quick Start Guide', href: '/learn/getting-started', time: '5 min' },
      { title: 'Understanding the Dashboard', href: '/learn/getting-started#dashboard', time: '3 min' },
      { title: 'Navigating the Admin Portal', href: '/learn/getting-started#navigation', time: '4 min' },
      { title: 'Setting Up Your Profile', href: '/learn/getting-started#profile', time: '2 min' },
    ],
  },
  {
    id: 'members',
    title: 'Member Management',
    description: 'Create, edit, and manage member profiles',
    icon: <Users className="w-6 h-6" />,
    color: 'blue',
    articles: [
      { title: 'Creating Members', href: '/learn/members', time: '4 min' },
      { title: 'Managing Dependents', href: '/learn/members#dependents', time: '3 min' },
      { title: 'Importing Member Data', href: '/learn/members#import', time: '5 min' },
      { title: 'Member Search & Filters', href: '/learn/members#search', time: '3 min' },
    ],
  },
  {
    id: 'agents',
    title: 'Agent Management',
    description: 'Manage advisors, licensing, and branding',
    icon: <UserCog className="w-6 h-6" />,
    color: 'violet',
    articles: [
      { title: 'Agent Overview', href: '/learn/agents', time: '4 min' },
      { title: 'Adding New Agents', href: '/learn/agents#create', time: '3 min' },
      { title: 'Commission Tiers', href: '/learn/agents#commissions', time: '5 min' },
      { title: 'Agent Enrollment Links', href: '/learn/agents#links', time: '4 min' },
    ],
  },
  {
    id: 'enrollments',
    title: 'Enrollment Processing',
    description: 'Handle enrollments from application to activation',
    icon: <FileText className="w-6 h-6" />,
    color: 'emerald',
    articles: [
      { title: 'Enrollment Workflow', href: '/learn/enrollments', time: '5 min' },
      { title: 'Processing New Enrollments', href: '/learn/enrollments#processing', time: '4 min' },
      { title: 'Approval & Rejection', href: '/learn/enrollments#approval', time: '3 min' },
      { title: 'Enrollment Links & QR Codes', href: '/learn/enrollments#links', time: '4 min' },
    ],
  },
  {
    id: 'billing',
    title: 'Billing & Payments',
    description: 'Payment processing, invoices, and billing',
    icon: <CreditCard className="w-6 h-6" />,
    color: 'amber',
    articles: [
      { title: 'Billing Overview', href: '/learn/billing', time: '4 min' },
      { title: 'Processing Payments', href: '/learn/billing#payments', time: '5 min' },
      { title: 'Managing Invoices', href: '/learn/billing#invoices', time: '4 min' },
      { title: 'Handling Failed Payments', href: '/learn/billing#failures', time: '3 min' },
    ],
  },
  {
    id: 'commissions',
    title: 'Commissions',
    description: 'Commission tiers, tracking, and payouts',
    icon: <Layers className="w-6 h-6" />,
    color: 'rose',
    articles: [
      { title: 'Commission Engine Overview', href: '/learn/agents#commissions', time: '5 min' },
      { title: 'Setting Up Tiers', href: '/learn/agents#tiers', time: '4 min' },
      { title: 'Tracking Transactions', href: '/learn/agents#transactions', time: '3 min' },
    ],
  },
  {
    id: 'communications',
    title: 'Communications',
    description: 'Email templates and sending',
    icon: <Mail className="w-6 h-6" />,
    color: 'blue',
    articles: [
      { title: 'Email Templates', href: '/learn/enrollments#links', time: '4 min' },
      { title: 'Sending Emails', href: '/learn/enrollments#links', time: '3 min' },
      { title: 'Email History', href: '/learn/enrollments#links', time: '3 min' },
    ],
  },
  {
    id: 'settings',
    title: 'Settings & Security',
    description: 'Configure system, security, and automations',
    icon: <Settings className="w-6 h-6" />,
    color: 'slate',
    articles: [
      { title: 'General Settings', href: '/learn/getting-started#settings', time: '3 min' },
      { title: 'Security & Roles', href: '/learn/getting-started#security', time: '4 min' },
      { title: 'Audit Logs', href: '/learn/getting-started#audit', time: '3 min' },
    ],
  },
  {
    id: 'terminal',
    title: 'Command Center',
    description: 'Power-user terminal and keyboard shortcuts',
    icon: <Terminal className="w-6 h-6" />,
    color: 'slate',
    articles: [
      { title: 'Command Center Basics', href: '/learn/terminal', time: '4 min' },
      { title: 'Search Commands', href: '/learn/terminal#search', time: '5 min' },
      { title: 'Navigation Commands', href: '/learn/terminal#navigation', time: '3 min' },
      { title: 'Keyboard Shortcuts', href: '/learn/terminal#shortcuts', time: '2 min' },
    ],
  },
];

const QUICK_LINKS = [
  { title: 'Getting Started', icon: <PlayCircle className="w-5 h-5" />, href: '/learn/getting-started' },
  { title: 'FAQs', icon: <HelpCircle className="w-5 h-5" />, href: '/learn/faq' },
  { title: 'What\'s New', icon: <Sparkles className="w-5 h-5" />, href: '/learn/changelog' },
  { title: 'Contact Support', icon: <MessageCircle className="w-5 h-5" />, href: 'mailto:support@doublehelixhub.com'},
];

export default function LearnPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCategories = useMemo(() => {
    const searchLower = searchQuery.toLowerCase().trim();
    if (!searchLower) return CATEGORIES;
    return CATEGORIES.filter(cat => (
      cat.title.toLowerCase().includes(searchLower) ||
      cat.description.toLowerCase().includes(searchLower) ||
      cat.articles.some(a => a.title.toLowerCase().includes(searchLower))
    ));
  }, [searchQuery]);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#047474] via-[#069B9A] to-[#027343] p-8 md:p-12">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-white/10 rounded-full blur-2xl" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-8 h-8 text-white" />
            <span className="text-white/80 font-medium">Learning Center</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Master the Admin Portal
          </h1>
          <p className="text-lg text-white/80 max-w-2xl mb-8">
            Learn how to manage members, process enrollments, handle billing, and more with step-by-step guides and expert tips.
          </p>

          <div className="relative max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              placeholder="Search tutorials, guides, and features..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-14 text-lg bg-white/95 border-0 shadow-xl"
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
            className="flex items-center gap-3 p-4 rounded-xl bg-white border border-slate-200 hover:border-[#047474]/50 hover:shadow-md transition-all group"
          >
            <div className="p-2 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-[#047474]/10 group-hover:text-[#047474] transition-colors">
              {link.icon}
            </div>
            <span className="font-medium text-slate-900 group-hover:text-[#047474] transition-colors">
              {link.title}
            </span>
          </Link>
        ))}
      </div>

      {/* Getting Started Banner */}
      <div className="bg-gradient-to-r from-[#047474]/10 to-[#027343]/10 border border-[#047474]/20 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-[#047474] to-[#027343]">
          <Rocket className="w-10 h-10 text-white" />
        </div>
        <div className="flex-1 text-center md:text-left">
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            New to the Admin Portal?
          </h2>
          <p className="text-slate-600">
            Start with our 5-minute quick start guide and learn the essentials to get up and running.
          </p>
        </div>
        <Button size="lg" className="gap-2 bg-[#047474] hover:bg-[#035f5f]" asChild>
          <Link href="/learn/getting-started">
            Get Started
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>

      {/* Feature Categories */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-6">
          Browse by Feature
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(
                selectedCategory === category.id ? null : category.id
              )}
              className={cn(
                'text-left p-5 rounded-2xl border transition-all',
                selectedCategory === category.id
                  ? 'bg-[#047474]/5 border-[#047474]'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              )}
            >
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center mb-3',
                category.color === 'teal' && 'bg-teal-100 text-teal-600',
                category.color === 'blue' && 'bg-blue-100 text-blue-600',
                category.color === 'violet' && 'bg-violet-100 text-violet-600',
                category.color === 'emerald' && 'bg-emerald-100 text-emerald-600',
                category.color === 'amber' && 'bg-amber-100 text-amber-600',
                category.color === 'rose' && 'bg-rose-100 text-rose-600',
                category.color === 'slate' && 'bg-slate-200 text-slate-600',
              )}>
                {category.icon}
              </div>
              <h3 className="font-semibold text-slate-900 mb-1">
                {category.title}
              </h3>
              <p className="text-sm text-slate-500">
                {category.articles.length} articles
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Selected Category Articles */}
      {selectedCategory && (() => {
        const category = CATEGORIES.find(c => c.id === selectedCategory);
        if (!category) return null;

        return (
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center',
                  category.color === 'teal' && 'bg-teal-100 text-teal-600',
                  category.color === 'blue' && 'bg-blue-100 text-blue-600',
                  category.color === 'violet' && 'bg-violet-100 text-violet-600',
                  category.color === 'emerald' && 'bg-emerald-100 text-emerald-600',
                  category.color === 'amber' && 'bg-amber-100 text-amber-600',
                  category.color === 'rose' && 'bg-rose-100 text-rose-600',
                  category.color === 'slate' && 'bg-slate-200 text-slate-600',
                )}>
                  {category.icon}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">
                    {category.title}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {category.description}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              {category.articles.map((article) => (
                <Link
                  key={article.href + article.title}
                  href={article.href}
                  className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-slate-300 group-hover:text-[#047474] transition-colors" />
                    <span className="font-medium text-slate-900 group-hover:text-[#047474] transition-colors">
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

      {/* Popular Articles */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-6">
          Popular Articles
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              title: 'Getting Started with the Dashboard',
              category: 'Getting Started',
              time: '5 min',
              href: '/learn/getting-started',
              icon: <Rocket className="w-5 h-5" />,
            },
            {
              title: 'Processing Enrollments',
              category: 'Enrollments',
              time: '4 min',
              href: '/learn/enrollments',
              icon: <FileText className="w-5 h-5" />,
            },
            {
              title: 'Using the Command Center',
              category: 'Terminal',
              time: '4 min',
              href: '/learn/terminal',
              icon: <Terminal className="w-5 h-5" />,
            },
          ].map((article) => (
            <Link
              key={article.href}
              href={article.href}
              className="group p-5 rounded-2xl bg-white border border-slate-200 hover:border-[#047474]/50 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
                  {article.icon}
                </div>
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  {article.category}
                </span>
              </div>
              <h3 className="font-semibold text-slate-900 mb-2 group-hover:text-[#047474] transition-colors">
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
      <div className="bg-slate-900 rounded-2xl p-8 text-center">
        <h2 className="text-2xl font-bold text-white mb-3">
          Still have questions?
        </h2>
        <p className="text-slate-400 mb-6 max-w-lg mx-auto">
          Our support team is here to help. Reach out and we&apos;ll get back to you within 24 hours.
        </p>
        <div className="flex items-center justify-center gap-4">
          <a href="mailto:support@doublehelixhub.com">
            <Button variant="outline" className="border-slate-600 text-white hover:bg-slate-800">
              <Mail className="w-4 h-4 mr-2" />
              Email Support
            </Button>
          </a>
          <Button className="bg-[#047474] hover:bg-[#035f5f]" asChild>
            <Link href="/learn/faq">
              <HelpCircle className="w-4 h-4 mr-2" />
              Browse FAQs
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
