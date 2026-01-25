import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { motion } from 'framer-motion';
import {
  Target,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Users,
  Calendar,
  Activity,
  BarChart3,
  Award,
  Sparkles,
} from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';

interface SLAComplianceData {
  total_tickets: number;
  first_response_met: number;
  first_response_percentage: number;
  resolution_met: number;
  resolution_percentage: number;
  overall_met: number;
  overall_percentage: number;
}

interface AgentPerformance {
  agent_id: string;
  agent_name: string;
  agent_email: string;
  total_tickets: number;
  first_response_met: number;
  first_response_percentage: number;
  resolution_met: number;
  resolution_percentage: number;
  avg_first_response_minutes: number;
  avg_resolution_minutes: number;
}

interface SLATrend {
  date: string;
  compliance_rate: number;
  breaches: number;
}

interface BreachedTicket {
  id: string;
  subject: string;
  priority: string;
  created_at: string;
  breach_type: string;
  breach_minutes: number;
  assignee: {
    full_name: string | null;
    email: string;
  } | null;
}

export default function SlaInsights() {
  const [compliance, setCompliance] = useState<SLAComplianceData>({
    total_tickets: 0,
    first_response_met: 0,
    first_response_percentage: 0,
    resolution_met: 0,
    resolution_percentage: 0,
    overall_met: 0,
    overall_percentage: 0,
  });
  const [agentPerformance, setAgentPerformance] = useState<AgentPerformance[]>([]);
  const [trends, setTrends] = useState<SLATrend[]>([]);
  const [breachedTickets, setBreachedTickets] = useState<BreachedTicket[]>([]);
  const [atRiskTickets, setAtRiskTickets] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    fetchSLAData();
  }, [dateRange]);

  const fetchSLAData = async () => {
    try {
      setLoading(true);

      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      const startDate = subDays(new Date(), days);

      // Fetch compliance data
      const { data: complianceData, error: complianceError } = await supabase.rpc(
        'get_sla_compliance_percentage',
        {
          p_start_date: startDate.toISOString(),
          p_end_date: new Date().toISOString(),
        }
      );

      if (complianceError) throw complianceError;
      if (complianceData && complianceData[0]) {
        setCompliance(complianceData[0]);
      }

      // Fetch agent performance
      const { data: agentData, error: agentError } = await supabase.rpc(
        'get_agent_sla_performance',
        {
          p_start_date: startDate.toISOString(),
          p_end_date: new Date().toISOString(),
        }
      );

      if (agentError) throw agentError;
      setAgentPerformance(agentData || []);

      // Fetch trends (last 30 days)
      await fetchSLATrends();

      // Fetch breached tickets
      const { data: breached, error: breachedError } = await supabase
        .from('sla_metrics')
        .select(
          `
          ticket_id,
          first_response_breach_minutes,
          resolution_breach_minutes,
          ticket:tickets(
            id,
            subject,
            priority,
            created_at,
            assignee:profiles!tickets_assignee_id_fkey(full_name, email)
          )
        `
        )
        .eq('overall_breach', true)
        .gte('ticket_created_at', startDate.toISOString())
        .order('ticket_created_at', { ascending: false })
        .limit(10);

      if (breachedError) throw breachedError;

      const breachedList: BreachedTicket[] = (breached || []).map((b: any) => ({
        id: b.ticket?.id || '',
        subject: b.ticket?.subject || 'Unknown',
        priority: b.ticket?.priority || 'normal',
        created_at: b.ticket?.created_at || '',
        breach_type:
          b.first_response_breach_minutes > 0 ? 'First Response' : 'Resolution',
        breach_minutes:
          b.first_response_breach_minutes > 0
            ? b.first_response_breach_minutes
            : b.resolution_breach_minutes,
        assignee: b.ticket?.assignee || null,
      }));

      setBreachedTickets(breachedList);

      // Fetch at-risk tickets
      const { count: atRisk } = await supabase
        .from('sla_metrics')
        .select('*', { count: 'exact', head: true })
        .eq('sla_status', 'at_risk');

      setAtRiskTickets(atRisk || 0);
    } catch (error) {
      console.error('Error fetching SLA data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSLATrends = async () => {
    try {
      const { data: metrics } = await supabase
        .from('sla_metrics')
        .select('ticket_created_at, overall_breach')
        .gte('ticket_created_at', subDays(new Date(), 30).toISOString())
        .order('ticket_created_at');

      if (metrics) {
        const trendsByDate = metrics.reduce((acc, metric) => {
          const date = format(new Date(metric.ticket_created_at), 'yyyy-MM-dd');
          if (!acc[date]) {
            acc[date] = { total: 0, breaches: 0 };
          }
          acc[date].total++;
          if (metric.overall_breach) {
            acc[date].breaches++;
          }
          return acc;
        }, {} as Record<string, { total: number; breaches: number }>);

        const trendsArray: SLATrend[] = Object.entries(trendsByDate).map(
          ([date, data]) => ({
            date,
            compliance_rate:
              data.total > 0 ? ((data.total - data.breaches) / data.total) * 100 : 0,
            breaches: data.breaches,
          })
        );

        setTrends(trendsArray);
      }
    } catch (error) {
      console.error('Error fetching trends:', error);
    }
  };

  const priorityColors: Record<string, string> = {
    urgent: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  };

  const formatMinutes = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getComplianceColor = (percentage: number): string => {
    if (percentage >= 90) return 'text-success-600 dark:text-green-400';
    if (percentage >= 75) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-accent-600 dark:text-red-400';
  };

  const maxTrendValue = Math.max(...trends.map((t) => t.compliance_rate), 1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-teal-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="hero-analytics text-white py-20 px-6"
      >
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex justify-between items-end">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-5"
            >
              <motion.div
                animate={{
                  scale: [1, 1.05, 1],
                  rotate: [0, 360]
                }}
                transition={{
                  duration: 10,
                  repeat: Infinity,
                  ease: "linear"
                }}
                className="p-5 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20"
              >
                <Target size={52} className="text-white" />
              </motion.div>
              <div>
                <h1 className="text-6xl font-black mb-2 tracking-tight">
                  SLA Insights
                </h1>
                <p className="text-2xl text-cyan-100 font-medium">
                  Track SLA compliance with 4-hour first response and 24-hour resolution targets
                </p>
              </div>
            </motion.div>
            <motion.select
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="px-8 py-4 rounded-xl border-2 border-white/30 bg-white/15 backdrop-blur-xl text-white text-lg focus:outline-none focus:ring-4 focus:ring-white/40 focus:border-white/50 transition-all cursor-pointer font-semibold shadow-2xl"
            >
              <option value="7d" className="bg-neutral-800 text-white">Last 7 Days</option>
              <option value="30d" className="bg-neutral-800 text-white">Last 30 Days</option>
              <option value="90d" className="bg-neutral-800 text-white">Last 90 Days</option>
            </motion.select>
          </div>
        </div>
      </motion.div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="inline-block w-16 h-16 border-4 border-primary-800 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-neutral-600 dark:text-neutral-400">Loading SLA data...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
              className="stat-card"
            >
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                    <Target className="text-white floating" size={24} />
                  </div>
                  <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase">Overall</span>
                </div>
                <p
                  className={`text-4xl font-bold mb-1 ${
                    getComplianceColor(compliance.overall_percentage || 0)
                  }`}
                >
                  {(compliance.overall_percentage || 0).toFixed(1)}%
                </p>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">SLA Compliance</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 }}
              className="stat-card"
            >
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-700 to-cyan-600 flex items-center justify-center">
                    <Clock className="text-white floating" size={24} />
                  </div>
                  <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase">4hr Target</span>
                </div>
                <p
                  className={`text-4xl font-bold mb-1 ${
                    getComplianceColor(compliance.first_response_percentage || 0)
                  }`}
                >
                  {(compliance.first_response_percentage || 0).toFixed(1)}%
                </p>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">First Response</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="stat-card"
            >
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                    <CheckCircle className="text-white floating" size={24} />
                  </div>
                  <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase">24hr Target</span>
                </div>
                <p
                  className={`text-4xl font-bold mb-1 ${
                    getComplianceColor(compliance.resolution_percentage || 0)
                  }`}
                >
                  {(compliance.resolution_percentage || 0).toFixed(1)}%
                </p>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Resolution</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25 }}
              className="stat-card"
            >
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
                    <XCircle className="text-white floating" size={24} />
                  </div>
                  <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase">Failed</span>
                </div>
                <p className="text-4xl font-bold text-neutral-900 dark:text-white mb-1">
                  {compliance.total_tickets - compliance.overall_met}
                </p>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Breached</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="stat-card"
            >
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                    <AlertTriangle className="text-white floating" size={24} />
                  </div>
                  <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase">Warning</span>
                </div>
                <p className="text-4xl font-bold text-neutral-900 dark:text-white mb-1">
                  {atRiskTickets}
                </p>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">At Risk</p>
              </div>
            </motion.div>
          </div>

          {/* SLA Targets Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass-card p-8 mb-8"
          >
            <h3 className="text-2xl font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-3">
              <Target size={28} className="text-primary-800" />
              SLA Targets
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex items-center gap-4">
                <div className="p-4 rounded-lg bg-cyan-100 dark:bg-cyan-900/20">
                  <Clock className="text-cyan-600 dark:text-cyan-400" size={32} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-neutral-900 dark:text-white">4 Hours</p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    First Response Time Target
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-1">
                    Staff must respond to tickets within 4 hours
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="p-4 rounded-lg bg-green-100 dark:bg-green-900/20">
                  <CheckCircle className="text-success-600 dark:text-green-400" size={32} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-neutral-900 dark:text-white">24 Hours</p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    Resolution Time Target
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-1">
                    Tickets must be resolved within 24 hours
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Compliance Trend */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="glass-card p-8 mb-8"
          >
            <h3 className="text-2xl font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-3">
              <TrendingUp size={28} className="text-success-600" />
              30-Day Compliance Trend
            </h3>
            <div className="h-48 flex items-end justify-between gap-1">
              {trends.slice(-30).map((trend, index) => {
                const height = (trend.compliance_rate / 100) * 100;
                return (
                  <div key={index} className="flex-1 flex flex-col items-center group">
                    <div
                      className={`w-full rounded-t transition-all cursor-pointer ${
                        trend.compliance_rate >= 90
                          ? 'bg-gradient-to-t from-green-600 to-emerald-500 dark:from-green-500 dark:to-emerald-400 hover:from-green-700 hover:to-emerald-600'
                          : trend.compliance_rate >= 75
                          ? 'bg-gradient-to-t from-yellow-600 to-orange-500 dark:from-yellow-500 dark:to-orange-400 hover:from-yellow-700 hover:to-orange-600'
                          : 'bg-gradient-to-t from-red-600 to-rose-500 dark:from-red-500 dark:to-rose-400 hover:from-red-700 hover:to-rose-600'
                      }`}
                      style={{ height: `${height}%`, minHeight: '4px' }}
                      title={`${format(new Date(trend.date), 'MMM d')}: ${trend.compliance_rate.toFixed(1)}% (${trend.breaches} breaches)`}
                    ></div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-4 text-xs text-neutral-600 dark:text-neutral-400">
              <span>{trends.length > 0 ? format(new Date(trends[0].date), 'MMM d') : ''}</span>
              <span>
                {trends.length > 0
                  ? format(new Date(trends[trends.length - 1].date), 'MMM d')
                  : ''}
              </span>
            </div>
          </motion.div>

          {/* Agent Performance */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="glass-card overflow-hidden mb-8"
          >
            <div className="p-8 border-b border-neutral-200/50 dark:border-neutral-700/50">
              <h3 className="text-2xl font-bold text-neutral-900 dark:text-white flex items-center gap-3">
                <Users size={28} className="text-cyan-600 dark:text-cyan-400" />
                Agent SLA Performance
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-primary-500/10 to-cyan-500/10 border-b border-neutral-200/50 dark:border-neutral-700/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                      Agent
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                      Tickets
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                      First Response
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                      Resolution
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                      Avg Response Time
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                      Avg Resolution Time
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200/50 dark:divide-neutral-700/50">
                  {agentPerformance.map((agent, index) => (
                    <motion.tr
                      key={agent.agent_id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="hover:bg-white/50 dark:hover:bg-neutral-800/50 transition-all group"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-neutral-900 dark:text-white">
                            {agent.agent_name}
                          </p>
                          <p className="text-sm text-neutral-500 dark:text-neutral-400">
                            {agent.agent_email}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-neutral-900 dark:text-white">
                          {agent.total_tickets}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                agent.first_response_percentage >= 90
                                  ? 'bg-success-600 dark:bg-green-400'
                                  : agent.first_response_percentage >= 75
                                  ? 'bg-yellow-600 dark:bg-yellow-400'
                                  : 'bg-accent-600 dark:bg-red-400'
                              }`}
                              style={{ width: `${agent.first_response_percentage}%` }}
                            />
                          </div>
                          <span
                            className={`text-sm font-medium w-12 ${
                              getComplianceColor(agent.first_response_percentage)
                            }`}
                          >
                            {agent.first_response_percentage?.toFixed(0) || 0}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                agent.resolution_percentage >= 90
                                  ? 'bg-success-600 dark:bg-green-400'
                                  : agent.resolution_percentage >= 75
                                  ? 'bg-yellow-600 dark:bg-yellow-400'
                                  : 'bg-accent-600 dark:bg-red-400'
                              }`}
                              style={{ width: `${agent.resolution_percentage}%` }}
                            />
                          </div>
                          <span
                            className={`text-sm font-medium w-12 ${
                              getComplianceColor(agent.resolution_percentage)
                            }`}
                          >
                            {agent.resolution_percentage?.toFixed(0) || 0}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400">
                        {formatMinutes(agent.avg_first_response_minutes)}
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400">
                        {formatMinutes(agent.avg_resolution_minutes)}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Recent Breached Tickets */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="glass-card overflow-hidden"
          >
            <div className="p-8 border-b border-neutral-200/50 dark:border-neutral-700/50">
              <h3 className="text-2xl font-bold text-neutral-900 dark:text-white flex items-center gap-3">
                <XCircle size={28} className="text-accent-600" />
                Recent SLA Breaches
              </h3>
            </div>
            <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
              {breachedTickets.length === 0 ? (
                <div className="p-12 text-center">
                  <CheckCircle className="mx-auto text-success-500 mb-4" size={64} />
                  <p className="text-neutral-500 dark:text-neutral-400 text-lg">
                    No SLA breaches in this period
                  </p>
                </div>
              ) : (
                breachedTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="p-6 hover:bg-red-50/30 dark:hover:bg-red-900/10 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-neutral-900 dark:text-white mb-2">
                          {ticket.subject}
                        </h4>
                        <div className="flex items-center gap-4 text-sm">
                          <span
                            className={`modern-badge ${priorityColors[ticket.priority]}`}
                          >
                            {ticket.priority}
                          </span>
                          <span className="text-neutral-600 dark:text-neutral-400">
                            {format(new Date(ticket.created_at), 'MMM d, yyyy HH:mm')}
                          </span>
                          {ticket.assignee && (
                            <span className="text-neutral-600 dark:text-neutral-400">
                              Assigned to: {ticket.assignee.full_name || ticket.assignee.email}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-medium text-accent-600 dark:text-red-400">
                          {ticket.breach_type}
                        </span>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                          Breached by {formatMinutes(ticket.breach_minutes)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
          </>
        )}
      </div>
    </div>
  );
}
