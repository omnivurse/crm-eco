'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  ArrowLeft,
  HelpCircle,
  ChevronDown,
  Search,
  Users,
  Target,
  Mail,
  Workflow,
  BarChart3,
  Settings,
} from 'lucide-react';

interface FAQ {
  question: string;
  answer: string;
  category: string;
}

const FAQS: FAQ[] = [
  // Getting Started
  {
    category: 'Getting Started',
    question: 'How do I reset my password?',
    answer: 'Click on your profile icon in the top right, select "Settings", then go to "Security". Click "Change Password" and follow the prompts. You\'ll receive a confirmation email once complete.',
  },
  {
    category: 'Getting Started',
    question: 'Can I use CRM Eco on mobile?',
    answer: 'Yes! CRM Eco is fully responsive and works on any mobile browser. Simply visit the same URL on your phone or tablet. We also have native iOS and Android apps available in their respective app stores.',
  },
  {
    category: 'Getting Started',
    question: 'How do I invite team members?',
    answer: 'Go to Settings → Team Members → Invite. Enter their email address and select a role. They\'ll receive an invitation email to join your workspace. You can manage permissions in the same section.',
  },
  // Contacts
  {
    category: 'Contacts',
    question: 'What\'s the difference between contacts and leads?',
    answer: 'Leads are unqualified prospects you\'re still evaluating. Contacts are qualified individuals you have a relationship with. When a lead is qualified, you can convert them to a contact, optionally creating a deal at the same time.',
  },
  {
    category: 'Contacts',
    question: 'How do I merge duplicate contacts?',
    answer: 'Go to Contacts, select the duplicate records (use checkboxes), then click "Merge" in the actions menu. Choose which record should be the master, review the merged data, and confirm. All activities will be combined.',
  },
  {
    category: 'Contacts',
    question: 'Can I import contacts from a spreadsheet?',
    answer: 'Yes! Go to Contacts → Import. Upload a CSV file, map your columns to CRM fields, review the preview, and click Import. We support up to 10,000 contacts per import. Duplicates are handled based on email address.',
  },
  // Deals
  {
    category: 'Deals',
    question: 'How do I customize my pipeline stages?',
    answer: 'Go to Settings → Modules → Deals → Pipeline Stages. You can add, remove, reorder, and rename stages. Each stage has a probability percentage used for forecasting. Changes apply to all users in your organization.',
  },
  {
    category: 'Deals',
    question: 'How is the forecast calculated?',
    answer: 'The weighted forecast is calculated as: Deal Value × Stage Probability. For example, a $10,000 deal at 50% probability contributes $5,000 to your forecast. The total forecast is the sum of all weighted values.',
  },
  {
    category: 'Deals',
    question: 'Can I track multiple products in a deal?',
    answer: 'Yes! When editing a deal, scroll to the "Products" section. You can add multiple products with quantities and prices. The deal value automatically updates based on the product total.',
  },
  // Campaigns
  {
    category: 'Campaigns',
    question: 'Why are my emails going to spam?',
    answer: 'Common reasons include: using spam trigger words (FREE, URGENT), sending to old lists, no unsubscribe link, or domain not verified. Verify your sending domain in Settings → Email Domains and warm up new domains gradually.',
  },
  {
    category: 'Campaigns',
    question: 'How do I track email opens and clicks?',
    answer: 'Open and click tracking is automatic. View stats on the campaign detail page. Opens are tracked via a tiny invisible pixel, clicks via link redirects. Note: some email clients block tracking pixels, so actual opens may be higher.',
  },
  {
    category: 'Campaigns',
    question: 'What\'s the best time to send emails?',
    answer: 'For B2B: Tuesday-Thursday between 10am-2pm recipient local time. For B2C: test weekends and evenings. Use the scheduling feature to send at optimal times, and A/B test different send times to find what works for your audience.',
  },
  // Sequences
  {
    category: 'Sequences',
    question: 'What happens if someone replies to a sequence email?',
    answer: 'If you\'ve set up exit conditions (recommended), the contact automatically exits the sequence when they reply. This prevents awkward follow-ups after someone has already responded.',
  },
  {
    category: 'Sequences',
    question: 'Can I edit a sequence that has active enrollments?',
    answer: 'Yes, but be careful. Changes only affect new enrollments and contacts who haven\'t reached the modified step yet. Contacts already past an edited step won\'t see those changes.',
  },
  // Workflows
  {
    category: 'Workflows',
    question: 'My workflow isn\'t triggering. What\'s wrong?',
    answer: 'Check: 1) Is the workflow Active (not Draft)? 2) Does the record meet all conditions? 3) Was the trigger event correct? 4) Check the workflow execution log for errors. Also ensure the trigger isn\'t set for a different module.',
  },
  {
    category: 'Workflows',
    question: 'Can workflows run on existing records?',
    answer: 'Workflows only run when their trigger event occurs. They don\'t retroactively process existing records. To apply actions to existing records, use bulk actions or create a report and take action from there.',
  },
  // Reports
  {
    category: 'Reports',
    question: 'How do I schedule a report to be emailed?',
    answer: 'Open the report, click "Schedule" in the top right. Choose frequency (daily, weekly, monthly), time, and recipients. The report will be generated and emailed as a PDF or CSV attachment at the scheduled time.',
  },
  {
    category: 'Reports',
    question: 'Can I export data to Excel?',
    answer: 'Yes! From any report, click "Export" and choose CSV. CSV files open directly in Excel. For formatted reports with charts, export as PDF. You can also export individual module data from list views.',
  },
];

const CATEGORIES = [
  { id: 'all', label: 'All Questions', icon: <HelpCircle className="w-4 h-4" /> },
  { id: 'Getting Started', label: 'Getting Started', icon: <Settings className="w-4 h-4" /> },
  { id: 'Contacts', label: 'Contacts', icon: <Users className="w-4 h-4" /> },
  { id: 'Deals', label: 'Deals', icon: <Target className="w-4 h-4" /> },
  { id: 'Campaigns', label: 'Campaigns', icon: <Mail className="w-4 h-4" /> },
  { id: 'Sequences', label: 'Sequences', icon: <Workflow className="w-4 h-4" /> },
  { id: 'Workflows', label: 'Workflows', icon: <Workflow className="w-4 h-4" /> },
  { id: 'Reports', label: 'Reports', icon: <BarChart3 className="w-4 h-4" /> },
];

function FAQItem({ faq, isOpen, onToggle }: { faq: FAQ; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-5 text-left bg-white dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <span className="font-medium text-slate-900 dark:text-white pr-4">
          {faq.question}
        </span>
        <ChevronDown
          className={cn(
            'w-5 h-5 text-slate-400 transition-transform flex-shrink-0',
            isOpen && 'rotate-180'
          )}
        />
      </button>
      {isOpen && (
        <div className="px-5 pb-5 bg-white dark:bg-slate-900/50">
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            {faq.answer}
          </p>
        </div>
      )}
    </div>
  );
}

export default function FAQPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [openItems, setOpenItems] = useState<Set<number>>(new Set());

  const filteredFAQs = FAQS.filter((faq) => {
    const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory;
    const matchesSearch = !searchQuery ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const toggleItem = (index: number) => {
    const newOpen = new Set(openItems);
    if (newOpen.has(index)) {
      newOpen.delete(index);
    } else {
      newOpen.add(index);
    }
    setOpenItems(newOpen);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/crm/learn" className="text-slate-500 hover:text-teal-600 transition-colors">
          Learning Center
        </Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-900 dark:text-white font-medium">Frequently Asked Questions</span>
      </div>

      {/* Header */}
      <div className="text-center">
        <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 mb-6">
          <HelpCircle className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
          Frequently Asked Questions
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          Find answers to common questions about CRM Eco. Can't find what you're looking for?
          Contact our support team.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-xl mx-auto">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search questions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
        />
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap justify-center gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors',
              selectedCategory === cat.id
                ? 'bg-teal-500 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            )}
          >
            {cat.icon}
            {cat.label}
          </button>
        ))}
      </div>

      {/* FAQ List */}
      <div className="space-y-4">
        {filteredFAQs.length === 0 ? (
          <div className="text-center py-12">
            <HelpCircle className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-slate-400">
              No questions found matching your search.
            </p>
          </div>
        ) : (
          filteredFAQs.map((faq, index) => (
            <FAQItem
              key={index}
              faq={faq}
              isOpen={openItems.has(index)}
              onToggle={() => toggleItem(index)}
            />
          ))
        )}
      </div>

      {/* Still Need Help */}
      <div className="bg-slate-900 dark:bg-slate-800 rounded-2xl p-8 text-center">
        <h2 className="text-2xl font-bold text-white mb-3">
          Still need help?
        </h2>
        <p className="text-slate-400 mb-6 max-w-lg mx-auto">
          Our support team is here to help you succeed. Reach out and we'll get back
          to you within 24 hours.
        </p>
        <div className="flex items-center justify-center gap-4">
          <a href="mailto:support@crmeco.com">
            <Button variant="outline" className="border-slate-600 text-white hover:bg-slate-800">
              <Mail className="w-4 h-4 mr-2" />
              Email Support
            </Button>
          </a>
          <Link href="/crm/learn">
            <Button className="bg-teal-500 hover:bg-teal-600">
              Browse Guides
            </Button>
          </Link>
        </div>
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
