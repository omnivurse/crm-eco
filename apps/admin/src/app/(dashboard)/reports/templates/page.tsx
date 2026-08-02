'use client';

import { ArrowUpRight, Calendar, ChartBar, CurrencyDollar, FileText, GearSix, Lightning, MagnifyingGlass, SquaresFour, Target, TrendUp, Users, Wallet } from '@phosphor-icons/react';
import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Tabs, TabsList, TabsTrigger } from '@crm-eco/ui/components/tabs';
import {
  TEMPLATE_CATEGORIES,
  REPORT_TEMPLATES,
  getTemplatesByCategory,
  type TemplateCategory,
} from '@crm-eco/shared';
import { PageHeader } from '@/components/ui/PageHeader';

const categoryIcons: Record<string, React.ElementType> = {
  all: SquaresFour,
  sales: CurrencyDollar,
  marketing: Target,
  team: Users,
  operations: GearSix,
  finance: Wallet,
  productivity: Lightning,
};

const categoryColors: Record<string, string> = {
  sales: 'from-emerald-500 to-green-600',
  marketing: 'from-violet-500 to-purple-600',
  team: 'from-blue-500 to-cyan-600',
  operations: 'from-amber-500 to-orange-600',
  finance: 'from-[#0891b2] to-[#06b6d4]',
  productivity: 'from-orange-500 to-red-500',
};

const iconMap: Record<string, React.ElementType> = {
  CurrencyDollar,
  Target,
  Users,
  GearSix,
  Wallet,
  Lightning,
  ChartBar,
  TrendUp,
  Calendar,
  FileText,
  MapPin: Target,
  Activity: TrendUp,
  UserCheck: Users,
  Award: Target,
  Trophy: Target,
  Map: Target,
  GitBranch: Users,
  Package: Wallet,
  Plus: Lightning,
  Clock: Calendar,
  PieChart: ChartBar,
  Globe: Target,
  RefreshCw: TrendUp,
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
  const IconComponent = icon ? (iconMap[icon] || ChartBar) : ChartBar;
  const gradient = categoryColors[category] || 'from-slate-500 to-slate-600';
  const categoryLabel = TEMPLATE_CATEGORIES.find((c) => c.id === category)?.label || category;

  return (
    <Link
      href={`/reports/templates/${id}`}
      className="bg-white rounded-xl p-5 border border-slate-200 hover:border-[#0891b2]/30 hover:shadow-lg transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-xl bg-gradient-to-br ${gradient}`}>
          <IconComponent className="w-5 h-5 text-white" />
        </div>
        <ArrowUpRight weight="light" className="w-4 h-4 text-slate-400 group-hover:text-[#0891b2] transition-colors" />
      </div>
      <h3 className="text-slate-900 font-semibold mb-1 group-hover:text-[#0891b2] transition-colors">
        {name}
      </h3>
      <p className="text-slate-500 text-sm line-clamp-2 mb-3">{description}</p>
      <div className="flex items-center gap-2">
        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
          {categoryLabel}
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-[#0891b2]/10 text-[#0891b2]">
          {dataSource}
        </span>
      </div>
    </Link>
  );
}

export default function AdminTemplatesPage() {
  const [activeCategory, setActiveCategory] = useState<TemplateCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTemplates = getTemplatesByCategory(activeCategory).filter(
    (template) =>
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/reports"
        backLabel="Reports"
        title="Report templates"
        description="Browse and run pre-built report templates"
        icon={<ChartBar weight="light" className="h-6 w-6" />}
        actions={
          <div className="relative">
            <MagnifyingGlass weight="light" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" aria-hidden />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-72"
            />
          </div>
        }
      />

      {/* Category Tabs */}
      <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as TemplateCategory)}>
        <TabsList className="bg-slate-100 p-1 h-auto flex-wrap">
          {TEMPLATE_CATEGORIES.map((cat) => {
            const IconComponent = categoryIcons[cat.id] || SquaresFour;
            const count =
              cat.id === 'all'
                ? REPORT_TEMPLATES.length
                : REPORT_TEMPLATES.filter((t) => t.category === cat.id).length;
            return (
              <TabsTrigger
                key={cat.id}
                value={cat.id}
                className="data-[state=active]:bg-white px-3 py-1.5 text-sm"
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
        <p className="text-sm text-slate-600">
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
          <ChartBar weight="light" className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-1">No templates found</h3>
          <p className="text-slate-500">
            Try adjusting your search or browse a different category
          </p>
        </div>
      )}
    </div>
  );
}
