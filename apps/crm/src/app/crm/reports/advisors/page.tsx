'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  ArrowUpRight,
  UserCheck,
  Users,
  UserMinus,
  DollarSign,
} from 'lucide-react';
import { getTemplatesByCategory } from '@/lib/reports';

const templateIcons: Record<string, React.ElementType> = {
  'advisor-enrollments': UserCheck,
  'advisor-active-members': Users,
  'advisor-cancellations': UserMinus,
  'advisor-revenue': DollarSign,
};

const templateGradients: Record<string, string> = {
  'advisor-enrollments': 'from-cyan-500 to-teal-600',
  'advisor-active-members': 'from-blue-500 to-indigo-600',
  'advisor-cancellations': 'from-amber-500 to-orange-600',
  'advisor-revenue': 'from-emerald-500 to-green-600',
};

export default function AdvisorReportsPage() {
  const templates = getTemplatesByCategory('advisors');

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/crm/reports"
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Reports
        </Link>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600">
            <UserCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Advisor Reports
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-0.5">
              Track advisor performance, enrollments, and revenue
            </p>
          </div>
        </div>
      </div>

      {/* Template Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((template) => {
          const Icon = templateIcons[template.id] || UserCheck;
          const gradient = templateGradients[template.id] || 'from-cyan-500 to-teal-600';

          return (
            <Link
              key={template.id}
              href={`/crm/reports/advisors/${template.id}`}
              className="glass-card rounded-xl p-5 border border-slate-200 dark:border-white/10 hover:border-teal-500/30 transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${gradient}`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-400 dark:text-slate-600 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors" />
              </div>
              <h3 className="text-slate-900 dark:text-white font-semibold mb-1 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                {template.name}
              </h3>
              <p className="text-slate-500 text-sm line-clamp-2 mb-3">
                {template.description}
              </p>
              {template.metrics && (
                <div className="flex flex-wrap gap-1.5">
                  {template.metrics.map((metric) => (
                    <span
                      key={metric}
                      className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                    >
                      {metric}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
