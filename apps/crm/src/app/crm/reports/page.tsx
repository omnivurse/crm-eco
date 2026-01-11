import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Users,
  UserPlus,
  DollarSign,
  Target,
  Calendar,
  ArrowUpRight,
  Download,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { getCurrentProfile, getModuleStats } from '@/lib/crm/queries';
import type { ModuleStats } from '@/lib/crm/types';

// Mock data for charts (in production, this would come from actual queries)
const MONTHLY_DATA = [
  { month: 'Jul', leads: 45, contacts: 32, deals: 8 },
  { month: 'Aug', leads: 52, contacts: 41, deals: 12 },
  { month: 'Sep', leads: 61, contacts: 38, deals: 15 },
  { month: 'Oct', leads: 48, contacts: 45, deals: 11 },
  { month: 'Nov', leads: 73, contacts: 52, deals: 18 },
  { month: 'Dec', leads: 68, contacts: 61, deals: 22 },
];

function StatCard({ 
  title, 
  value, 
  change, 
  trend,
  icon: Icon,
  color,
}: { 
  title: string;
  value: string | number;
  change: number;
  trend: 'up' | 'down' | 'neutral';
  icon: React.ElementType;
  color: 'teal' | 'violet' | 'emerald' | 'amber';
}) {
  const colorClasses = {
    teal: { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/30' },
    violet: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/30' },
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  };
  
  const colors = colorClasses[color];

  return (
    <div className="glass-card rounded-xl p-5 border border-white/10 hover:border-teal-500/20 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-xl ${colors.bg}`}>
          <Icon className={`w-5 h-5 ${colors.text}`} />
        </div>
        <div className={`flex items-center gap-1 text-sm ${
          trend === 'up' ? 'text-emerald-400' : 
          trend === 'down' ? 'text-red-400' : 
          'text-slate-400'
        }`}>
          {trend === 'up' && <TrendingUp className="w-4 h-4" />}
          {trend === 'down' && <TrendingDown className="w-4 h-4" />}
          {change !== 0 && <span>{change > 0 ? '+' : ''}{change}%</span>}
        </div>
      </div>
      
      <p className="text-3xl font-bold text-white mb-1">{value}</p>
      <p className="text-slate-400 text-sm">{title}</p>
    </div>
  );
}

function MiniBarChart({ data, label }: { data: number[]; label: string }) {
  const max = Math.max(...data);
  
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1 h-16">
        {data.map((value, idx) => (
          <div
            key={idx}
            className="flex-1 bg-gradient-to-t from-teal-500/50 to-teal-400/30 rounded-t transition-all hover:from-teal-500 hover:to-teal-400"
            style={{ height: `${(value / max) * 100}%` }}
          />
        ))}
      </div>
      <p className="text-xs text-slate-500 text-center">{label}</p>
    </div>
  );
}

function ReportCard({ 
  title, 
  description, 
  href,
  icon: Icon,
  color,
}: { 
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Link 
      href={href}
      className="glass-card rounded-xl p-5 border border-white/10 hover:border-teal-500/30 transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-xl ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-teal-400 transition-colors" />
      </div>
      <h3 className="text-white font-semibold mb-1 group-hover:text-teal-400 transition-colors">{title}</h3>
      <p className="text-slate-500 text-sm">{description}</p>
    </Link>
  );
}

async function ReportsContent() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect('/crm-login');
  }

  const stats = await getModuleStats(profile.organization_id);
  
  // Calculate totals from stats
  const totalContacts = stats.find(s => s.moduleKey === 'contacts')?.totalRecords || 0;
  const totalLeads = stats.find(s => s.moduleKey === 'leads')?.totalRecords || 0;
  const totalDeals = stats.find(s => s.moduleKey === 'deals')?.totalRecords || 0;
  const totalAccounts = stats.find(s => s.moduleKey === 'accounts')?.totalRecords || 0;
  
  const leadsThisWeek = stats.find(s => s.moduleKey === 'leads')?.createdThisWeek || 0;
  const contactsThisWeek = stats.find(s => s.moduleKey === 'contacts')?.createdThisWeek || 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20">
              <BarChart3 className="w-4 h-4 text-violet-400" />
            </div>
            <span className="text-violet-400 text-sm font-medium">Analytics</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Reports & Insights</h1>
          <p className="text-slate-400 mt-0.5">
            Track performance and gain insights into your CRM data
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <select className="h-10 px-4 rounded-xl glass border border-white/10 text-sm text-slate-300 focus:outline-none focus:border-teal-500/50 bg-transparent">
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="12m">Last 12 months</option>
          </select>
          <Button 
            variant="outline" 
            className="glass border-white/10 text-slate-300 hover:text-white hover:border-white/20"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button 
            variant="outline" 
            className="glass border-white/10 text-slate-300 hover:text-white hover:border-white/20"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total Contacts"
          value={totalContacts.toLocaleString()}
          change={contactsThisWeek > 0 ? Math.round((contactsThisWeek / (totalContacts || 1)) * 100) : 0}
          trend={contactsThisWeek > 0 ? 'up' : 'neutral'}
          icon={Users}
          color="teal"
        />
        <StatCard
          title="Active Leads"
          value={totalLeads.toLocaleString()}
          change={leadsThisWeek > 0 ? Math.round((leadsThisWeek / (totalLeads || 1)) * 100) : 0}
          trend={leadsThisWeek > 0 ? 'up' : 'neutral'}
          icon={UserPlus}
          color="violet"
        />
        <StatCard
          title="Open Deals"
          value={totalDeals.toLocaleString()}
          change={0}
          trend="neutral"
          icon={DollarSign}
          color="emerald"
        />
        <StatCard
          title="Accounts"
          value={totalAccounts.toLocaleString()}
          change={0}
          trend="neutral"
          icon={Target}
          color="amber"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lead Conversion Funnel */}
        <div className="glass-card rounded-2xl p-6 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <Target className="w-5 h-5 text-violet-400" />
            Lead Conversion Funnel
          </h3>
          
          <div className="space-y-4">
            {[
              { stage: 'New Leads', count: totalLeads, percent: 100, color: 'from-blue-500 to-cyan-500' },
              { stage: 'Contacted', count: Math.round(totalLeads * 0.7), percent: 70, color: 'from-violet-500 to-purple-500' },
              { stage: 'Qualified', count: Math.round(totalLeads * 0.4), percent: 40, color: 'from-amber-500 to-orange-500' },
              { stage: 'Converted', count: Math.round(totalLeads * 0.15), percent: 15, color: 'from-emerald-500 to-green-500' },
            ].map((item) => (
              <div key={item.stage} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">{item.stage}</span>
                  <span className="text-white font-medium">{item.count.toLocaleString()}</span>
                </div>
                <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full bg-gradient-to-r ${item.color} transition-all`}
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Activity Trends */}
        <div className="glass-card rounded-2xl p-6 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            Activity Trends
          </h3>
          
          <div className="grid grid-cols-3 gap-6">
            <MiniBarChart 
              data={MONTHLY_DATA.map(d => d.leads)} 
              label="Leads"
            />
            <MiniBarChart 
              data={MONTHLY_DATA.map(d => d.contacts)} 
              label="Contacts"
            />
            <MiniBarChart 
              data={MONTHLY_DATA.map(d => d.deals)} 
              label="Deals"
            />
          </div>
          
          <div className="mt-6 pt-4 border-t border-white/5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">6-month trend</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                +24% growth
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Report Types */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Available Reports</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <ReportCard
            title="Sales Performance"
            description="Track deals, revenue, and win rates"
            href="/crm/reports/sales"
            icon={DollarSign}
            color="bg-gradient-to-br from-emerald-500 to-green-600"
          />
          <ReportCard
            title="Lead Analytics"
            description="Source analysis and conversion metrics"
            href="/crm/reports/leads"
            icon={UserPlus}
            color="bg-gradient-to-br from-violet-500 to-purple-600"
          />
          <ReportCard
            title="Activity Report"
            description="Team productivity and engagement"
            href="/crm/reports/activity"
            icon={Calendar}
            color="bg-gradient-to-br from-blue-500 to-cyan-600"
          />
          <ReportCard
            title="Pipeline Health"
            description="Deal velocity and stage analysis"
            href="/crm/reports/pipeline"
            icon={Target}
            color="bg-gradient-to-br from-amber-500 to-orange-600"
          />
        </div>
      </div>

      {/* Recent Activity Summary */}
      <div className="glass-card rounded-2xl p-6 border border-white/10">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-teal-400" />
            This Week&apos;s Summary
          </h3>
          <span className="text-sm text-slate-500">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </span>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-white mb-1">{leadsThisWeek}</p>
            <p className="text-slate-400 text-sm">New Leads</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-white mb-1">{contactsThisWeek}</p>
            <p className="text-slate-400 text-sm">New Contacts</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-white mb-1">0</p>
            <p className="text-slate-400 text-sm">Deals Closed</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-white mb-1">$0</p>
            <p className="text-slate-400 text-sm">Revenue</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<ReportsSkeleton />}>
      <ReportsContent />
    </Suspense>
  );
}

function ReportsSkeleton() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header skeleton */}
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="h-5 w-24 bg-slate-800/50 rounded animate-pulse" />
          <div className="h-8 w-48 bg-slate-800/50 rounded animate-pulse" />
          <div className="h-4 w-64 bg-slate-800/50 rounded animate-pulse" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-32 bg-slate-800/50 rounded-lg animate-pulse" />
          <div className="h-10 w-24 bg-slate-800/50 rounded-lg animate-pulse" />
        </div>
      </div>
      
      {/* Stats skeleton */}
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-slate-800/30 rounded-xl border border-white/5 animate-pulse" />
        ))}
      </div>
      
      {/* Charts skeleton */}
      <div className="grid grid-cols-2 gap-6">
        <div className="h-80 bg-slate-800/30 rounded-2xl border border-white/5 animate-pulse" />
        <div className="h-80 bg-slate-800/30 rounded-2xl border border-white/5 animate-pulse" />
      </div>
    </div>
  );
}
