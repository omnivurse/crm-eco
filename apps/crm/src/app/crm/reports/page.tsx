'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
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
} from '@/lib/reports';

// ============================================================================
// Quick Stats Card Component
// ============================================================================

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
    teal: { bg: 'bg-teal-500/10', text: 'text-teal-600 dark:text-teal-400', border: 'border-teal-500/20' },
    violet: { bg: 'bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-500/20' },
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/20' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/20' },
  };

  const colors = colorClasses[color];

  const content = (
    <div className={`glass-card rounded-xl p-4 border ${colors.border} hover:border-opacity-50 transition-all group cursor-pointer`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${colors.bg}`}>
            <Icon className={`w-4 h-4 ${colors.text}`} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
          </div>
        </div>
        {href && (
          <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
        )}
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

// ============================================================================
// Report Template Card Component
// ============================================================================

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
  };

  const IconComponent = icon ? (iconMap[icon] || BarChart3) : BarChart3;
  const gradient = categoryColors[category] || 'from-slate-500 to-slate-600';

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
      <p className="text-slate-500 text-sm line-clamp-2">{description}</p>
    </Link>
  );
}

// ============================================================================
// Saved Report Card Component
// ============================================================================

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
    <div className="glass-card rounded-xl p-4 border border-slate-200 dark:border-white/10 hover:border-teal-500/20 transition-all group">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <Link
            href={`/crm/reports/saved/${id}`}
            className="text-slate-900 dark:text-white font-semibold hover:text-teal-600 dark:hover:text-teal-400 transition-colors truncate block"
          >
            {name}
          </Link>
          {template && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{template}</p>
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
        <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
          <Clock className="w-3 h-3" />
          <span>{lastRun || 'Never run'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onRun}>
            <Play className="w-3 h-3 mr-1" />
            Run
          </Button>
          <Link href={`/crm/reports/saved/${id}`}>
            <Button size="sm" variant="outline" className="h-7 px-2">
              View
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Category Icon Map
// ============================================================================

const categoryIcons: Record<string, React.ElementType> = {
  all: LayoutGrid,
  sales: DollarSign,
  marketing: Target,
  team: Users,
  operations: Settings,
  finance: Wallet,
  productivity: Zap,
};

// ============================================================================
// Main Reports Page Component
// ============================================================================

export default function ReportsPage() {
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

  // Get filtered templates
  const filteredTemplates = getTemplatesByCategory(activeCategory).filter(
    (template) =>
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Fetch saved reports
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
    router.push(`/crm/reports/saved/${reportId}?run=true`);
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
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20">
              <BarChart3 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            </div>
            <span className="text-violet-600 dark:text-violet-400 text-sm font-medium">
              Analytics
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Reports & Analytics
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-0.5">
            Run reports, analyze data, and export insights
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/crm/reports/new">
            <Button className="bg-teal-600 hover:bg-teal-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Create Report
            </Button>
          </Link>
          <Button
            variant="outline"
            className="border-slate-300 dark:border-white/10"
          >
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
          href="/crm/reports/saved"
        />
        <QuickStatCard
          title="Scheduled"
          value={stats.scheduledReports}
          icon={Calendar}
          color="violet"
          href="/crm/reports/scheduled"
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
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Report Templates
            </h2>
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
            <Link href="/crm/reports/templates">
              <Button variant="outline" size="sm">
                View All
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Category Tabs */}
        <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as TemplateCategory)}>
          <TabsList className="bg-slate-100 dark:bg-slate-800/50 p-1 h-auto flex-wrap">
            {TEMPLATE_CATEGORIES.map((cat) => {
              const IconComponent = categoryIcons[cat.id] || LayoutGrid;
              return (
                <TabsTrigger
                  key={cat.id}
                  value={cat.id}
                  className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 px-3 py-1.5 text-sm"
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
            <Link href="/crm/reports/templates">
              <Button variant="outline">
                View All {filteredTemplates.length} Templates
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        )}

        {filteredTemplates.length === 0 && (
          <div className="text-center py-12">
            <BarChart3 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400">
              No templates found matching your search
            </p>
          </div>
        )}
      </div>

      {/* Saved Reports Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Saved Reports
            </h2>
            <span className="text-sm text-slate-500">({savedReports.length})</span>
          </div>
          <Link href="/crm/reports/saved">
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
          <div className="glass-card rounded-xl p-8 border border-slate-200 dark:border-white/10 text-center">
            <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-slate-900 dark:text-white font-semibold mb-1">
              No saved reports yet
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
              Create your first report from a template or build a custom report
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/crm/reports/templates">
                <Button variant="outline">Browse Templates</Button>
              </Link>
              <Link href="/crm/reports/new">
                <Button className="bg-teal-600 hover:bg-teal-700 text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Report
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/crm/reports/templates"
          className="glass-card rounded-xl p-5 border border-slate-200 dark:border-white/10 hover:border-violet-500/30 transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20">
              <LayoutGrid className="w-6 h-6 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-slate-900 dark:text-white font-semibold group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                Browse Templates
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Explore {REPORT_TEMPLATES.length} pre-built report templates
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors" />
          </div>
        </Link>

        <Link
          href="/crm/reports/scheduled"
          className="glass-card rounded-xl p-5 border border-slate-200 dark:border-white/10 hover:border-emerald-500/30 transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/20">
              <Calendar className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-slate-900 dark:text-white font-semibold group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                Scheduled Reports
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Set up automated report delivery
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
          </div>
        </Link>

        <Link
          href="/crm/reports/new"
          className="glass-card rounded-xl p-5 border border-slate-200 dark:border-white/10 hover:border-teal-500/30 transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-teal-500/20 to-cyan-500/20">
              <Plus className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-slate-900 dark:text-white font-semibold group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                Custom Report
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Build a report from scratch
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors" />
          </div>
        </Link>
      </div>
    </div>
  );
}
