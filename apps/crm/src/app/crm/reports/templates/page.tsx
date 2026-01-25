'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  ArrowLeft,
  Search,
  LayoutGrid,
  DollarSign,
  Target,
  Users,
  Settings,
  Wallet,
  Zap,
  TrendingUp,
  Calendar,
  FileText,
  ArrowUpRight,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Tabs, TabsList, TabsTrigger } from '@crm-eco/ui/components/tabs';
import {
  TEMPLATE_CATEGORIES,
  REPORT_TEMPLATES,
  getTemplatesByCategory,
  type TemplateCategory,
} from '@crm-eco/shared';

const categoryIcons: Record<string, React.ElementType> = {
  all: LayoutGrid,
  sales: DollarSign,
  marketing: Target,
  team: Users,
  operations: Settings,
  finance: Wallet,
  productivity: Zap,
};

const categoryColors: Record<string, string> = {
  sales: 'from-emerald-500 to-green-600',
  marketing: 'from-violet-500 to-purple-600',
  team: 'from-blue-500 to-cyan-600',
  operations: 'from-amber-500 to-orange-600',
  finance: 'from-green-600 to-teal-600',
  productivity: 'from-orange-500 to-red-500',
};

const iconMap: Record<string, React.ElementType> = {
  DollarSign,
  Target,
  Users,
  Settings,
  Wallet,
  Zap,
  BarChart3,
  TrendingUp,
  Calendar,
  FileText,
  MapPin: Target,
  Activity: TrendingUp,
  UserCheck: Users,
  Award: Target,
  Trophy: Target,
  Map: Target,
  GitBranch: Users,
  Package: Wallet,
  Plus: Zap,
  Clock: Calendar,
  PieChart: BarChart3,
  Globe: Target,
  RefreshCw: TrendingUp,
};

function ReportTemplateCard({
  id,
  name,
  description,
  category,
  icon,
  dataSource,
}: {
  id: string;
  name: string;
  description: string;
  category: string;
  icon?: string;
  dataSource: string;
}) {
  const IconComponent = icon ? (iconMap[icon] || BarChart3) : BarChart3;
  const gradient = categoryColors[category] || 'from-slate-500 to-slate-600';
  const categoryLabel = TEMPLATE_CATEGORIES.find((c) => c.id === category)?.label || category;

  return (
    <Link
      href={`/crm/reports/templates/${id}`}
      className="glass-card rounded-xl p-5 border border-slate-200 dark:border-white/10 hover:border-teal-500/30 transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-xl bg-gradient-to-br ${gradient}`}>
          <IconComponent className="w-5 h-5 text-white" />
        </div>
        <ArrowUpRight className="w-4 h-4 text-slate-400 dark:text-slate-600 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors" />
      </div>
      <h3 className="text-slate-900 dark:text-white font-semibold mb-1 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
        {name}
      </h3>
      <p className="text-slate-500 text-sm line-clamp-2 mb-3">{description}</p>
      <div className="flex items-center gap-2">
        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
          {categoryLabel}
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400">
          {dataSource}
        </span>
      </div>
    </Link>
  );
}

export default function TemplatesPage() {
  const [activeCategory, setActiveCategory] = useState<TemplateCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTemplates = getTemplatesByCategory(activeCategory).filter(
    (template) =>
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <Link
            href="/crm/reports"
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Reports
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Report Templates
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-0.5">
            Browse and run pre-built report templates
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 w-72"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as TemplateCategory)}>
        <TabsList className="bg-slate-100 dark:bg-slate-800/50 p-1 h-auto flex-wrap">
          {TEMPLATE_CATEGORIES.map((cat) => {
            const IconComponent = categoryIcons[cat.id] || LayoutGrid;
            const count =
              cat.id === 'all'
                ? REPORT_TEMPLATES.length
                : REPORT_TEMPLATES.filter((t) => t.category === cat.id).length;
            return (
              <TabsTrigger
                key={cat.id}
                value={cat.id}
                className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 px-3 py-1.5 text-sm"
              >
                <IconComponent className="w-4 h-4 mr-1.5" />
                {cat.label}
                <span className="ml-1.5 text-xs text-slate-400">({count})</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Showing {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''}
          {searchQuery && ` matching "${searchQuery}"`}
        </p>
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTemplates.map((template) => (
            <ReportTemplateCard
              key={template.id}
              id={template.id}
              name={template.name}
              description={template.description}
              category={template.category}
              icon={template.icon}
              dataSource={template.dataSource}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <BarChart3 className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
            No templates found
          </h3>
          <p className="text-slate-500 dark:text-slate-400">
            Try adjusting your search or browse a different category
          </p>
        </div>
      )}
    </div>
  );
}
