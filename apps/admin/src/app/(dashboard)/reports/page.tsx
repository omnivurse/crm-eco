'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  TrendingUp,
  Users,
  DollarSign,
  Target,
  Calendar,
  ArrowUpRight,
  Download,
  RefreshCw,
  LayoutGrid,
  Settings,
  Wallet,
  Zap,
  FileText,
  Star,
  Clock,
  Play,
  Plus,
  ChevronRight,
  Search,
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

function QuickStatCard({
  title,
  value,
  icon: Icon,
  color,
  href,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  color: 'teal' | 'violet' | 'emerald' | 'amber';
  href?: string;
}) {
  const colorClasses = {
    teal: { bg: 'bg-[#047474]/10', text: 'text-[#047474]', border: 'border-[#047474]/20' },
    violet: { bg: 'bg-purple-500/10', text: 'text-purple-600', border: 'border-purple-500/20' },
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', border: 'border-emerald-500/20' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-600', border: 'border-amber-500/20' },
  };

  const colors = colorClasses[color];

  const content = (
    <div className={`bg-white rounded-xl p-4 border ${colors.border} hover:shadow-lg transition-all group cursor-pointer`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${colors.bg}`}>
            <Icon className={`w-4 h-4 ${colors.text}`} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-sm text-slate-500">{title}</p>
          </div>
        </div>
        {href && (
          <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
        )}
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

function ReportTemplateCard({
  id,
  name,
  description,
  category,
  icon,
}: {
  id: string;
  name: string;
  description: string;
  category: string;
  icon?: string;
}) {
  const categoryColors: Record<string, string> = {
    sales: 'from-emerald-500 to-green-600',
    marketing: 'from-violet-500 to-purple-600',
    team: 'from-blue-500 to-cyan-600',
    operations: 'from-amber-500 to-orange-600',
    finance: 'from-[#047474] to-[#069B9A]',
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
  };

  const IconComponent = icon ? (iconMap[icon] || BarChart3) : BarChart3;
  const gradient = categoryColors[category] || 'from-slate-500 to-slate-600';

  return (
    <Link
      href={`/reports/templates/${id}`}
      className="bg-white rounded-xl p-5 border border-slate-200 hover:border-[#047474]/30 hover:shadow-lg transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-xl bg-gradient-to-br ${gradient}`}>
          <IconComponent className="w-5 h-5 text-white" />
        </div>
        <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-[#047474] transition-colors" />
      </div>
      <h3 className="text-slate-900 font-semibold mb-1 group-hover:text-[#047474] transition-colors">
        {name}
      </h3>
      <p className="text-slate-500 text-sm line-clamp-2">{description}</p>
    </Link>
  );
}

function SavedReportCard({
  id,
  name,
  template,
  lastRun,
  isFavorite,
  onRun,
  onToggleFavorite,
}: {
  id: string;
  name: string;
  template?: string;
  lastRun?: string;
  isFavorite?: boolean;
  onRun?: () => void;
  onToggleFavorite?: () => void;
}) {
  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200 hover:border-[#047474]/20 hover:shadow-lg transition-all group">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <Link
            href={`/reports/saved/${id}`}
            className="text-slate-900 font-semibold hover:text-[#047474] transition-colors truncate block"
          >
            {name}
          </Link>
          {template && (
            <p className="text-xs text-slate-500 mt-0.5">{template}</p>
          )}
        </div>
        <button
          onClick={onToggleFavorite}
          className={`p-1.5 rounded-lg transition-colors ${
            isFavorite
              ? 'text-amber-500 bg-amber-500/10'
              : 'text-slate-400 hover:text-amber-500 hover:bg-amber-500/10'
          }`}
        >
          <Star className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
        </button>
      </div>
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Clock className="w-3 h-3" />
          <span>{lastRun || 'Never run'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onRun}>
            <Play className="w-3 h-3 mr-1" />
            Run
          </Button>
          <Link href={`/reports/saved/${id}`}>
            <Button size="sm" variant="outline" className="h-7 px-2">
              View
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

const categoryIcons: Record<string, React.ElementType> = {
  all: LayoutGrid,
  sales: DollarSign,
  marketing: Target,
  team: Users,
  operations: Settings,
  finance: Wallet,
  productivity: Zap,
};

export default function AdminReportsPage() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<TemplateCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [savedReports, setSavedReports] = useState<Array<{
    id: string;
    name: string;
    template?: string;
    lastRun?: string;
    isFavorite?: boolean;
  }>>([]);
  const [stats, setStats] = useState({
    totalReports: 0,
    scheduledReports: 0,
    reportsThisMonth: 0,
    totalExports: 0,
  });

  const filteredTemplates = getTemplatesByCategory(activeCategory).filter(
    (template) =>
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    async function fetchReports() {
      try {
        const res = await fetch('/api/reports');
        if (res.ok) {
          const data = await res.json();
          setSavedReports(
            (data.reports || []).map((r: {
              id: string;
              name: string;
              data_source?: string;
              last_run_at?: string;
              is_favorite?: boolean;
            }) => ({
              id: r.id,
              name: r.name,
              template: r.data_source,
              lastRun: r.last_run_at
                ? new Date(r.last_run_at).toLocaleDateString()
                : undefined,
              isFavorite: r.is_favorite,
            }))
          );
          setStats((prev) => ({ ...prev, totalReports: data.reports?.length || 0 }));
        }
      } catch (error) {
        console.error('Failed to fetch reports:', error);
      }
    }
    fetchReports();
  }, []);

  const handleRunReport = async (reportId: string) => {
    router.push(`/reports/saved/${reportId}?run=true`);
  };

  const handleToggleFavorite = async (reportId: string) => {
    try {
      await fetch(`/api/reports/${reportId}/favorite`, { method: 'PATCH' });
      setSavedReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, isFavorite: !r.isFavorite } : r))
      );
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports & Analytics</h1>
          <p className="text-slate-600 mt-0.5">
            Run reports, analyze data, and export insights
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/reports/new">
            <Button className="bg-[#047474] hover:bg-[#035f5f] text-white">
              <Plus className="w-4 h-4 mr-2" />
              Create Report
            </Button>
          </Link>
          <Button variant="outline">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <QuickStatCard
          title="Total Reports"
          value={stats.totalReports}
          icon={FileText}
          color="teal"
          href="/reports/saved"
        />
        <QuickStatCard
          title="Scheduled"
          value={stats.scheduledReports}
          icon={Calendar}
          color="violet"
        />
        <QuickStatCard
          title="Run This Month"
          value={stats.reportsThisMonth}
          icon={TrendingUp}
          color="emerald"
        />
        <QuickStatCard
          title="Total Exports"
          value={stats.totalExports}
          icon={Download}
          color="amber"
        />
      </div>

      {/* Report Templates Section */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Report Templates</h2>
            <span className="text-sm text-slate-500">
              ({REPORT_TEMPLATES.length} available)
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <Link href="/reports/templates">
              <Button variant="outline" size="sm">
                View All
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Category Tabs */}
        <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as TemplateCategory)}>
          <TabsList className="bg-slate-100 p-1 h-auto flex-wrap">
            {TEMPLATE_CATEGORIES.map((cat) => {
              const IconComponent = categoryIcons[cat.id] || LayoutGrid;
              return (
                <TabsTrigger
                  key={cat.id}
                  value={cat.id}
                  className="data-[state=active]:bg-white px-3 py-1.5 text-sm"
                >
                  <IconComponent className="w-4 h-4 mr-1.5" />
                  {cat.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTemplates.slice(0, 8).map((template) => (
            <ReportTemplateCard
              key={template.id}
              id={template.id}
              name={template.name}
              description={template.description}
              category={template.category}
              icon={template.icon}
            />
          ))}
        </div>

        {filteredTemplates.length > 8 && (
          <div className="text-center">
            <Link href="/reports/templates">
              <Button variant="outline">
                View All {filteredTemplates.length} Templates
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Saved Reports Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Saved Reports</h2>
            <span className="text-sm text-slate-500">({savedReports.length})</span>
          </div>
          <Link href="/reports/saved">
            <Button variant="ghost" size="sm">
              View All
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>

        {savedReports.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedReports.slice(0, 6).map((report) => (
              <SavedReportCard
                key={report.id}
                id={report.id}
                name={report.name}
                template={report.template}
                lastRun={report.lastRun}
                isFavorite={report.isFavorite}
                onRun={() => handleRunReport(report.id)}
                onToggleFavorite={() => handleToggleFavorite(report.id)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl p-8 border border-slate-200 text-center">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-slate-900 font-semibold mb-1">No saved reports yet</h3>
            <p className="text-slate-500 text-sm mb-4">
              Create your first report from a template
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/reports/templates">
                <Button variant="outline">Browse Templates</Button>
              </Link>
              <Link href="/reports/new">
                <Button className="bg-[#047474] hover:bg-[#035f5f] text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Report
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
