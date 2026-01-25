import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  BarChart3,
  TrendingUp,
  Download,
  Calendar,
  PieChart,
  Activity,
  Clock,
  AlertCircle,
  CheckCircle,
  Users,
  Target,
  Plus,
  Database
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

interface TicketMetrics {
  total: number;
  new: number;
  open: number;
  resolved: number;
  closed: number;
}

interface SLAMetrics {
  total: number;
  met: number;
  breached: number;
  percentage: number;
}

interface AgentPerformance {
  agent_id: string;
  agent_name: string;
  assigned_tickets: number;
  resolved_tickets: number;
  avg_resolution_time: number;
}

interface CategoryBreakdown {
  category: string;
  count: number;
  percentage: number;
}

interface TimeSeriesData {
  date: string;
  new: number;
  resolved: number;
  open: number;
}

export function EnhancedReports() {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'custom'>('30d');
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [ticketMetrics, setTicketMetrics] = useState<TicketMetrics>({
    total: 0,
    new: 0,
    open: 0,
    resolved: 0,
    closed: 0,
  });

  const [slaMetrics, setSlaMetrics] = useState<SLAMetrics>({
    total: 0,
    met: 0,
    breached: 0,
    percentage: 0,
  });

  const [agentPerformance, setAgentPerformance] = useState<AgentPerformance[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdown[]>([]);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [priorityDistribution, setPriorityDistribution] = useState<{ priority: string; count: number }[]>([]);

  useEffect(() => {
    updateDateRange(dateRange);
  }, [dateRange]);

  useEffect(() => {
    if (startDate && endDate) {
      fetchReportData();
    }
  }, [startDate, endDate]);

  const updateDateRange = (range: '7d' | '30d' | '90d' | 'custom') => {
    if (range !== 'custom') {
      const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
      setStartDate(format(subDays(new Date(), days), 'yyyy-MM-dd'));
      setEndDate(format(new Date(), 'yyyy-MM-dd'));
    }
  };

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const start = startOfDay(new Date(startDate)).toISOString();
      const end = endOfDay(new Date(endDate)).toISOString();

      await Promise.all([
        fetchTicketMetrics(start, end),
        fetchSLAMetrics(start, end),
        fetchAgentPerformance(start, end),
        fetchCategoryBreakdown(start, end),
        fetchTimeSeriesData(start, end),
        fetchPriorityDistribution(start, end),
      ]);
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTicketMetrics = async (start: string, end: string) => {
    const { data: tickets } = await supabase
      .from('tickets')
      .select('status')
      .gte('created_at', start)
      .lte('created_at', end);

    if (tickets) {
      setTicketMetrics({
        total: tickets.length,
        new: tickets.filter(t => t.status === 'new').length,
        open: tickets.filter(t => t.status === 'open').length,
        resolved: tickets.filter(t => t.status === 'resolved').length,
        closed: tickets.filter(t => t.status === 'closed').length,
      });
    }
  };

  const fetchSLAMetrics = async (start: string, end: string) => {
    const { data: tickets } = await supabase
      .from('tickets')
      .select('sla_due_at, status, updated_at')
      .gte('created_at', start)
      .lte('created_at', end)
      .in('status', ['resolved', 'closed']);

    if (tickets) {
      const total = tickets.length;
      const breached = tickets.filter(t =>
        t.sla_due_at && new Date(t.updated_at) > new Date(t.sla_due_at)
      ).length;
      const met = total - breached;

      setSlaMetrics({
        total,
        met,
        breached,
        percentage: total > 0 ? Math.round((met / total) * 100) : 0,
      });
    }
  };

  const fetchAgentPerformance = async (start: string, end: string) => {
    const { data: tickets } = await supabase
      .from('tickets')
      .select(`
        assignee_id,
        status,
        created_at,
        updated_at,
        assignee:profiles!tickets_assignee_id_fkey(full_name, email)
      `)
      .gte('created_at', start)
      .lte('created_at', end)
      .not('assignee_id', 'is', null);

    if (tickets) {
      const agentMap = new Map<string, AgentPerformance>();

      tickets.forEach(ticket => {
        const agentId = ticket.assignee_id;
        if (!agentId) return;
        const assignee = Array.isArray(ticket.assignee) ? ticket.assignee[0] : ticket.assignee;

        if (!agentMap.has(agentId)) {
          agentMap.set(agentId, {
            agent_id: agentId,
            agent_name: assignee?.full_name || assignee?.email || 'Unknown',
            assigned_tickets: 0,
            resolved_tickets: 0,
            avg_resolution_time: 0,
          });
        }

        const agent = agentMap.get(agentId)!;
        agent.assigned_tickets++;

        if (ticket.status === 'resolved' || ticket.status === 'closed') {
          agent.resolved_tickets++;
          const resolutionTime = new Date(ticket.updated_at).getTime() - new Date(ticket.created_at).getTime();
          agent.avg_resolution_time += resolutionTime / (1000 * 60 * 60);
        }
      });

      const performance = Array.from(agentMap.values()).map(agent => ({
        ...agent,
        avg_resolution_time: agent.resolved_tickets > 0
          ? Math.round(agent.avg_resolution_time / agent.resolved_tickets)
          : 0,
      }));

      setAgentPerformance(performance);
    }
  };

  const fetchCategoryBreakdown = async (start: string, end: string) => {
    const { data: tickets } = await supabase
      .from('tickets')
      .select('category')
      .gte('created_at', start)
      .lte('created_at', end);

    if (tickets) {
      const categoryMap = new Map<string, number>();
      tickets.forEach(ticket => {
        const category = ticket.category || 'Uncategorized';
        categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
      });

      const total = tickets.length;
      const breakdown = Array.from(categoryMap.entries()).map(([category, count]) => ({
        category,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      }));

      setCategoryBreakdown(breakdown.sort((a, b) => b.count - a.count));
    }
  };

  const fetchTimeSeriesData = async (start: string, end: string) => {
    const { data: tickets } = await supabase
      .from('tickets')
      .select('created_at, status')
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at');

    if (tickets) {
      const dateMap = new Map<string, TimeSeriesData>();

      tickets.forEach(ticket => {
        const date = format(new Date(ticket.created_at), 'yyyy-MM-dd');
        if (!dateMap.has(date)) {
          dateMap.set(date, { date, new: 0, resolved: 0, open: 0 });
        }
        const data = dateMap.get(date)!;
        if (ticket.status === 'new') data.new++;
        if (ticket.status === 'resolved') data.resolved++;
        if (ticket.status === 'open') data.open++;
      });

      setTimeSeriesData(Array.from(dateMap.values()));
    }
  };

  const fetchPriorityDistribution = async (start: string, end: string) => {
    const { data: tickets } = await supabase
      .from('tickets')
      .select('priority')
      .gte('created_at', start)
      .lte('created_at', end);

    if (tickets) {
      const priorityMap = new Map<string, number>();
      tickets.forEach(ticket => {
        priorityMap.set(ticket.priority, (priorityMap.get(ticket.priority) || 0) + 1);
      });

      setPriorityDistribution(
        Array.from(priorityMap.entries()).map(([priority, count]) => ({ priority, count }))
      );
    }
  };

  const exportReport = () => {
    const reportData = {
      generated_at: new Date().toISOString(),
      date_range: { start: startDate, end: endDate },
      ticket_metrics: ticketMetrics,
      sla_metrics: slaMetrics,
      agent_performance: agentPerformance,
      category_breakdown: categoryBreakdown,
      priority_distribution: priorityDistribution,
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${startDate}-to-${endDate}.json`;
    a.click();
  };

  const priorityColors: Record<string, string> = {
    urgent: 'bg-accent-500',
    high: 'bg-orange-500',
    medium: 'bg-yellow-500',
    low: 'bg-success-500',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-neutral-500 dark:text-neutral-400">Loading reports...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="championship-title text-4xl" data-text="Reports & Analytics">Reports & Analytics</h1>
          <p className="text-xl text-neutral-600 dark:text-neutral-400 mt-1">
            Track performance metrics and trends
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/reports/builder"
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl transition-colors"
          >
            <Database size={20} />
            Report Builder
          </Link>
          <button
            onClick={exportReport}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-800 hover:bg-primary-900 text-white rounded-xl transition-colors"
          >
            <Download size={20} />
            Export Report
          </button>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="glass-card p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="flex items-center gap-2">
            <Calendar className="text-neutral-600 dark:text-neutral-400" size={20} />
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Date Range:</span>
          </div>

          <div className="flex gap-2">
            {(['7d', '30d', '90d', 'custom'] as const).map(range => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  dateRange === range
                    ? 'bg-primary-800 text-white'
                    : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600'
                }`}
              >
                {range === '7d' ? 'Last 7 Days' : range === '30d' ? 'Last 30 Days' : range === '90d' ? 'Last 90 Days' : 'Custom'}
              </button>
            ))}
          </div>

          {dateRange === 'custom' && (
            <div className="flex gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white text-sm"
              />
              <span className="text-neutral-500 dark:text-neutral-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white text-sm"
              />
            </div>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <Activity className="text-primary-800 dark:text-primary-500" size={24} />
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Total</span>
          </div>
          <p className="text-2xl font-bold text-neutral-900 dark:text-white">{ticketMetrics.total}</p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Tickets</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <AlertCircle className="text-orange-600 dark:text-orange-400 floating" size={24} />
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Active</span>
          </div>
          <p className="text-2xl font-bold text-neutral-900 dark:text-white">{ticketMetrics.open + ticketMetrics.new}</p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Open</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="text-success-600 dark:text-green-400 floating" size={24} />
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Completed</span>
          </div>
          <p className="text-2xl font-bold text-neutral-900 dark:text-white">{ticketMetrics.resolved}</p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Resolved</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <Target className="text-cyan-600 dark:text-cyan-400 floating" size={24} />
            <span className="text-xs text-neutral-500 dark:text-neutral-400">SLA</span>
          </div>
          <p className="text-2xl font-bold text-neutral-900 dark:text-white">{slaMetrics.percentage}%</p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Compliance</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <Clock className="text-accent-600 dark:text-red-400 floating" size={24} />
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Breached</span>
          </div>
          <p className="text-2xl font-bold text-neutral-900 dark:text-white">{slaMetrics.breached}</p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">SLA Breach</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Priority Distribution */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="text-neutral-600 dark:text-neutral-400" size={20} />
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Priority Distribution</h2>
          </div>
          <div className="space-y-3">
            {priorityDistribution.map((item) => (
              <div key={item.priority}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-neutral-700 dark:text-neutral-300 capitalize">{item.priority}</span>
                  <span className="text-neutral-600 dark:text-neutral-400">{item.count} tickets</span>
                </div>
                <div className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${priorityColors[item.priority] || 'bg-neutral-500'}`}
                    style={{ width: `${ticketMetrics.total > 0 ? (item.count / ticketMetrics.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SLA Performance */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target className="text-neutral-600 dark:text-neutral-400" size={20} />
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">SLA Performance</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <div className="relative w-32 h-32">
                <svg className="transform -rotate-90 w-32 h-32">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-neutral-200 dark:text-neutral-700"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={`${2 * Math.PI * 56}`}
                    strokeDashoffset={`${2 * Math.PI * 56 * (1 - slaMetrics.percentage / 100)}`}
                    className="text-success-600 dark:text-green-400 transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-neutral-900 dark:text-white">{slaMetrics.percentage}%</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-success-600 dark:text-green-400">{slaMetrics.met}</p>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Met SLA</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-accent-600 dark:text-red-400">{slaMetrics.breached}</p>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Breached</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="text-neutral-600 dark:text-neutral-400" size={20} />
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Category Breakdown</h2>
        </div>
        <div className="space-y-3">
          {categoryBreakdown.map((item) => (
            <div key={item.category} className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-neutral-700 dark:text-neutral-300">{item.category}</span>
                  <span className="text-neutral-600 dark:text-neutral-400">{item.count} ({item.percentage}%)</span>
                </div>
                <div className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-800 dark:bg-primary-500"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Agent Performance */}
      <div className="glass-card overflow-hidden">
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center gap-2">
            <Users className="text-neutral-600 dark:text-neutral-400" size={20} />
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Agent Performance</h2>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 dark:bg-neutral-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">Agent</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">Assigned</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">Resolved</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">Avg. Time (hrs)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">Resolution Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
              {agentPerformance.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-neutral-500 dark:text-neutral-400">
                    No agent performance data available
                  </td>
                </tr>
              ) : (
                agentPerformance.map((agent) => (
                  <tr key={agent.agent_id} className="hover:bg-neutral-50 dark:hover:bg-neutral-700">
                    <td className="px-6 py-4 text-sm font-medium text-neutral-900 dark:text-white">{agent.agent_name}</td>
                    <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400">{agent.assigned_tickets}</td>
                    <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400">{agent.resolved_tickets}</td>
                    <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400">{agent.avg_resolution_time}h</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-success-600 dark:bg-green-400"
                            style={{
                              width: `${agent.assigned_tickets > 0 ? (agent.resolved_tickets / agent.assigned_tickets) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <span className="text-sm text-neutral-600 dark:text-neutral-400 w-12">
                          {agent.assigned_tickets > 0 ? Math.round((agent.resolved_tickets / agent.assigned_tickets) * 100) : 0}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
