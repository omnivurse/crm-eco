'use client';

import { useState } from 'react';
import { ArticleLayout } from '@/components/learn/LearnComponents';
import { cn } from '@crm-eco/ui';
import { ChevronDown } from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQCategory {
  title: string;
  items: FAQItem[];
}

const FAQ_DATA: FAQCategory[] = [
  {
    title: 'General',
    items: [
      {
        question: 'What is the Admin Portal?',
        answer: 'The Admin Portal is a comprehensive management platform for health sharing organizations. It allows administrators to manage members, process enrollments, handle billing, track commissions, and communicate with members — all from one central location.',
      },
      {
        question: 'Who can access the Admin Portal?',
        answer: 'Access is restricted to users with admin roles: Owner, Admin, and Staff. Each role has different permission levels. The system enforces role-based access at the middleware, API, and database (RLS) levels.',
      },
      {
        question: 'How do I reset my password?',
        answer: 'Use the "Forgot Password" link on the login page. You will receive an email with a password reset link. If you are unable to reset your password, contact your system administrator.',
      },
      {
        question: 'Is the system HIPAA compliant?',
        answer: 'Yes. The Admin Portal is built with HIPAA compliance in mind. Data is encrypted at rest and in transit, access is logged, and row-level security ensures users only see data they are authorized to access.',
      },
    ],
  },
  {
    title: 'Members & Enrollments',
    items: [
      {
        question: 'How do I add a new member?',
        answer: 'Navigate to Members → Add Member, or type "new member" in the Command Center. Fill in the required fields (name, email, phone, date of birth) and save the profile.',
      },
      {
        question: 'Can I import members in bulk?',
        answer: 'Yes. Go to Members → Import to upload a CSV file. The system supports smart field mapping, duplicate detection, and preview before importing.',
      },
      {
        question: 'How do enrollment statuses work?',
        answer: 'Enrollments follow a lifecycle: Pending → Approved → Active → (optionally) Terminated or Cancelled. Each status change is logged with timestamp and the user who made the change.',
      },
      {
        question: 'How do I add dependents to an enrollment?',
        answer: 'Open the member\'s profile and go to the Dependents tab. Add each dependent with their relationship type (spouse/child), date of birth, and coverage role. Dependents can be included or excluded from specific enrollments.',
      },
    ],
  },
  {
    title: 'Billing & Commissions',
    items: [
      {
        question: 'What payment methods are supported?',
        answer: 'The system supports credit cards and ACH/eCheck payments through Authorize.Net integration. Payment card data is tokenized and never stored locally for PCI compliance.',
      },
      {
        question: 'How are commissions calculated?',
        answer: 'Commissions are calculated based on the agent\'s commission tier when an enrollment moves to active status. Each tier defines a rate (percentage or fixed amount) that is applied to the enrollment premium.',
      },
      {
        question: 'What happens when a payment fails?',
        answer: 'Failed payments are tracked in Billing → Failed Payments with the decline reason. You can update the payment method and retry the transaction from the same screen.',
      },
      {
        question: 'How do I process commission payouts?',
        answer: 'Navigate to Commissions → Payouts to see pending commission amounts per agent. You can process batch payouts or individual agent payouts from this screen.',
      },
    ],
  },
  {
    title: 'Command Center',
    items: [
      {
        question: 'How do I open the Command Center?',
        answer: 'Press Ctrl+K (or Cmd+K on Mac) to toggle the Command Center. You can also click the "Command Center" button at the bottom of the sidebar.',
      },
      {
        question: 'What can I search for?',
        answer: 'You can search for members, agents, vendors, products, enrollments, invoices, commissions, and sent emails. Use "search [query]" for global search or "search [type] [query]" for entity-specific search.',
      },
      {
        question: 'How does autocomplete work?',
        answer: 'Start typing a command and the system will suggest completions. Press Tab to accept a suggestion. Autocomplete works for command names, entity types (when using search/new/open), and navigation destinations.',
      },
      {
        question: 'Can I see my command history?',
        answer: 'Yes. Press the Up and Down arrow keys to navigate through your previously executed commands. The system stores up to 100 commands in your session history.',
      },
    ],
  },
];

function FAQAccordion({ item }: { item: FAQItem }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors"
      >
        <span className="font-medium text-slate-900 pr-4">{item.question}</span>
        <ChevronDown className={cn(
          'w-5 h-5 text-slate-400 flex-shrink-0 transition-transform duration-200',
          isOpen && 'rotate-180'
        )} />
      </button>
      <div className={cn(
        'overflow-hidden transition-all duration-300',
        isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
      )}>
        <div className="px-4 pb-4 text-sm text-slate-600 leading-relaxed">
          {item.answer}
        </div>
      </div>
    </div>
  );
}

export default function FAQPage() {
  return (
    <ArticleLayout
      title="Frequently Asked Questions"
      description="Quick answers to the most common questions about the Admin Portal."
    >
      {FAQ_DATA.map((category) => (
        <div key={category.title}>
          <h2 className="text-xl font-bold text-slate-900 mb-4">{category.title}</h2>
          <div className="space-y-3">
            {category.items.map((item) => (
              <FAQAccordion key={item.question} item={item} />
            ))}
          </div>
        </div>
      ))}
    </ArticleLayout>
  );
}
