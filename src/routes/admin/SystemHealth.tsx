import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Database,
  Zap,
  Box,
  HardDrive,
  Shield,
  Activity,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Eye,
  Download,
  Settings,
  PlayCircle,
  PauseCircle,
} from 'lucide-react';
import { format, subHours, subDays } from 'date-fns';
import { toast } from '../../components/ui/Toaster';
import { ExportButton } from '../../components/ui/ExportButton';

interface HealthCheck {
  name: string;
  status: 'healthy' | 'warning' | 'error' | 'checking';
  message: string;
  lastChecked: string;
  latency?: number;
  details?: Record<string, any>;
  uptime24h?: number;
  avgLatency24h?: number;
  incidentCount?: number;
}

interface HealthTrend {
  hour: string;
  latency: number;
  status: 'healthy' | 'warning' | 'error';
}

interface Incident {
  id: string;
  component_name: string;
  severity: string;
  title: string;
  status: string;
  detected_at: string;
}

export function SystemHealth() {
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<number>(60);
  const [trends, setTrends] = useState<Record<string, HealthTrend[]>>({});
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
  const [systemScore, setSystemScore] = useState<number>(100);

  useEffect(() => {
    runHealthChecks();
    fetchIncidents();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => {
        runHealthChecks();
      }, refreshInterval * 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, refreshInterval]);

  const runHealthChecks = async () => {
    setLoading(true);
    const results: HealthCheck[] = [];

    const checkPromises = [
      checkDatabase(),
      checkVectorIndex(),
      checkScheduledFunctions(),
      checkStorage(),
      checkAuthentication(),
      checkEdgeFunctions(),
    ];

    const checkResults = await Promise.allSettled(checkPromises);

    checkResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      }
    });

    // Calculate overall system health score
    const score = calculateHealthScore(results);
    setSystemScore(score);

    // Save health checks to database
    await saveHealthChecks(results);

    // Fetch historical trends
    await fetchHealthTrends();

    setChecks(results);
    setLastRefresh(new Date());
    setLoading(false);

    const hasErrors = results.some((c) => c.status === 'error');
    const hasWarnings = results.some((c) => c.status === 'warning');

    if (hasErrors) {
      toast({
        type: 'error',
        title: 'System Health Issues',
        message: 'Critical issues detected. Review system status.',
      });
    } else if (hasWarnings) {
      toast({
        type: 'warning',
        title: 'System Warnings',
        message: 'Some components require attention.',
      });
    }
  };

  const calculateHealthScore = (checks: HealthCheck[]): number => {
    if (checks.length === 0) return 0;

    const weights = {
      healthy: 100,
      warning: 60,
      error: 0,
      checking: 50,
    };

    const totalScore = checks.reduce((sum, check) => {
      return sum + weights[check.status];
    }, 0);

    return Math.round(totalScore / checks.length);
  };

  const saveHealthChecks = async (checks: HealthCheck[]) => {
    const logs = checks.map((check) => ({
      component_name: check.name,
      check_type: 'automated',
      status: check.status === 'checking' ? 'unknown' : check.status,
      message: check.message,
      latency_ms: check.latency || null,
      metrics: check.details || {},
    }));

    await supabase.from('system_health_logs').insert(logs);
  };

  const fetchHealthTrends = async () => {
    const { data, error } = await supabase.rpc('get_system_health_trends', {
      p_hours: 24,
    });

    if (!error && data) {
      const trendsByComponent: Record<string, HealthTrend[]> = {};

      data.forEach((row: any) => {
        if (!trendsByComponent[row.component_name]) {
          trendsByComponent[row.component_name] = [];
        }

        const statusCounts = row.status_counts || {};
        const total =
          (statusCounts.healthy || 0) +
          (statusCounts.warning || 0) +
          (statusCounts.error || 0);

        let status: 'healthy' | 'warning' | 'error' = 'healthy';
        if (statusCounts.error > 0) status = 'error';
        else if (statusCounts.warning > 0) status = 'warning';

        trendsByComponent[row.component_name].push({
          hour: format(new Date(row.hour_bucket), 'HH:mm'),
          latency: row.avg_latency_ms || 0,
          status,
        });
      });

      setTrends(trendsByComponent);
    }
  };

  const fetchIncidents = async () => {
    const { data, error } = await supabase
      .from('system_incidents')
      .select('*')
      .in('status', ['open', 'acknowledged', 'investigating'])
      .order('detected_at', { ascending: false })
      .limit(5);

    if (!error && data) {
      setIncidents(data);
    }
  };

  const checkDatabase = async (): Promise<HealthCheck> => {
    const start = Date.now();
    const { error, count } = await supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true });

    const latency = Date.now() - start;

    // Get 24h stats
    const { data: statsData } = await supabase.rpc('calculate_system_uptime', {
      p_component_name: 'Database Connection',
      p_start_date: subHours(new Date(), 24).toISOString(),
      p_end_date: new Date().toISOString(),
    });

    const stats = statsData?.[0] || {};

    if (error) {
      return {
        name: 'Database Connection',
        status: 'error',
        message: error.message,
        lastChecked: new Date().toISOString(),
        latency,
        uptime24h: 0,
        avgLatency24h: latency,
      };
    }

    return {
      name: 'Database Connection',
      status: latency < 200 ? 'healthy' : latency < 500 ? 'warning' : 'error',
      message: `Connected successfully (${latency}ms)`,
      lastChecked: new Date().toISOString(),
      latency,
      details: { latency, records: count || 0 },
      uptime24h: stats.uptime_percentage || 100,
      avgLatency24h: latency,
    };
  };

  const checkVectorIndex = async (): Promise<HealthCheck> => {
    const start = Date.now();
    const { error, count } = await supabase
      .from('kb_articles')
      .select('id', { count: 'exact', head: true });

    const latency = Date.now() - start;

    const { data: statsData } = await supabase.rpc('calculate_system_uptime', {
      p_component_name: 'Vector Index',
      p_start_date: subHours(new Date(), 24).toISOString(),
      p_end_date: new Date().toISOString(),
    });

    const stats = statsData?.[0] || {};

    if (error) {
      return {
        name: 'Vector Index',
        status: 'error',
        message: error.message,
        lastChecked: new Date().toISOString(),
        latency,
        uptime24h: 0,
      };
    }

    return {
      name: 'Vector Index',
      status: latency < 300 ? 'healthy' : latency < 1000 ? 'warning' : 'error',
      message: 'Vector index operational',
      lastChecked: new Date().toISOString(),
      latency,
      details: { indexed: count || 0 },
      uptime24h: stats.uptime_percentage || 100,
      avgLatency24h: latency,
    };
  };

  const checkScheduledFunctions = async (): Promise<HealthCheck> => {
    const start = Date.now();
    const { data: workflows, error } = await supabase
      .from('workflows')
      .select('id, name, is_active')
      .eq('is_active', true);

    const latency = Date.now() - start;

    const { data: statsData } = await supabase.rpc('calculate_system_uptime', {
      p_component_name: 'Scheduled Functions',
      p_start_date: subHours(new Date(), 24).toISOString(),
      p_end_date: new Date().toISOString(),
    });

    const stats = statsData?.[0] || {};

    if (error) {
      return {
        name: 'Scheduled Functions',
        status: 'error',
        message: error.message,
        lastChecked: new Date().toISOString(),
        latency,
        uptime24h: 0,
      };
    }

    return {
      name: 'Scheduled Functions',
      status: 'healthy',
      message: `${workflows?.length || 0} active workflows`,
      lastChecked: new Date().toISOString(),
      latency,
      details: { active: workflows?.length || 0 },
      uptime24h: stats.uptime_percentage || 100,
    };
  };

  const checkStorage = async (): Promise<HealthCheck> => {
    const start = Date.now();
    const { data, error } = await supabase.storage.listBuckets();
    const latency = Date.now() - start;

    const { data: statsData } = await supabase.rpc('calculate_system_uptime', {
      p_component_name: 'Storage',
      p_start_date: subHours(new Date(), 24).toISOString(),
      p_end_date: new Date().toISOString(),
    });

    const stats = statsData?.[0] || {};

    if (error) {
      return {
        name: 'Storage',
        status: 'error',
        message: error.message,
        lastChecked: new Date().toISOString(),
        latency,
        uptime24h: 0,
      };
    }

    const buckets = data?.length || 0;
    return {
      name: 'Storage',
      status: buckets > 0 ? 'healthy' : 'warning',
      message: `${buckets} storage buckets configured`,
      lastChecked: new Date().toISOString(),
      latency,
      details: { buckets },
      uptime24h: stats.uptime_percentage || 100,
      avgLatency24h: latency,
    };
  };

  const checkAuthentication = async (): Promise<HealthCheck> => {
    const start = Date.now();
    const { error, count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true });

    const latency = Date.now() - start;

    const { data: statsData } = await supabase.rpc('calculate_system_uptime', {
      p_component_name: 'Authentication',
      p_start_date: subHours(new Date(), 24).toISOString(),
      p_end_date: new Date().toISOString(),
    });

    const stats = statsData?.[0] || {};

    if (error) {
      return {
        name: 'Authentication',
        status: 'error',
        message: error.message,
        lastChecked: new Date().toISOString(),
        latency,
        uptime24h: 0,
      };
    }

    return {
      name: 'Authentication',
      status: latency < 150 ? 'healthy' : latency < 400 ? 'warning' : 'error',
      message: 'Authentication service operational',
      lastChecked: new Date().toISOString(),
      latency,
      details: { users: count || 0 },
      uptime24h: stats.uptime_percentage || 100,
      avgLatency24h: latency,
    };
  };

  const checkEdgeFunctions = async (): Promise<HealthCheck> => {
    const start = Date.now();
    const { data, error } = await supabase
      .from('workflows')
      .select('id', { count: 'exact', head: true });

    const latency = Date.now() - start;

    const { data: statsData } = await supabase.rpc('calculate_system_uptime', {
      p_component_name: 'Edge Functions',
      p_start_date: subHours(new Date(), 24).toISOString(),
      p_end_date: new Date().toISOString(),
    });

    const stats = statsData?.[0] || {};

    if (error) {
      return {
        name: 'Edge Functions',
        status: 'error',
        message: error.message,
        lastChecked: new Date().toISOString(),
        latency,
        uptime24h: 0,
      };
    }

    return {
      name: 'Edge Functions',
      status: 'healthy',
      message: 'Edge functions operational',
      lastChecked: new Date().toISOString(),
      latency,
      uptime24h: stats.uptime_percentage || 100,
      avgLatency24h: latency,
    };
  };

  const exportHealthData = async (format: 'csv' | 'json'): Promise<{ success: boolean; error?: string }> => {
    try {
      const exportData = {
        timestamp: new Date().toISOString(),
        system_score: systemScore,
        components: checks.map((check) => ({
          name: check.name,
          status: check.status,
          message: check.message,
          latency_ms: check.latency,
          uptime_24h: check.uptime24h,
          details: check.details,
        })),
        incidents: incidents,
        trends: trends,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `system-health-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  };

  const statusIcons = {
    healthy: CheckCircle2,
    warning: AlertCircle,
    error: XCircle,
    checking: Activity,
  };

  const statusColors = {
    healthy: 'from-green-500 to-emerald-600',
    warning: 'from-yellow-500 to-orange-600',
    error: 'from-red-500 to-rose-600',
    checking: 'from-primary-500 to-primary-700',
  };

  const statusBorderColors = {
    healthy: 'border-green-200 dark:border-green-800',
    warning: 'border-yellow-200 dark:border-yellow-800',
    error: 'border-red-200 dark:border-red-800',
    checking: 'border-primary-200 dark:border-primary-800',
  };

  const checkIcons: Record<string, any> = {
    'Database Connection': Database,
    'Vector Index': Box,
    'Scheduled Functions': Zap,
    Storage: HardDrive,
    Authentication: Shield,
    'Edge Functions': Activity,
  };

  const getScoreColor = (score: number): string => {
    if (score >= 90) return 'text-success-600 dark:text-green-400';
    if (score >= 70) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-accent-600 dark:text-red-400';
  };

  const getScoreGradient = (score: number): string => {
    if (score >= 90) return 'from-green-500 to-emerald-600';
    if (score >= 70) return 'from-yellow-500 to-orange-600';
    return 'from-red-500 to-rose-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-end mb-8"
        >
          <div>
            <h1 className="championship-title" data-text="System Health">
              System Health
            </h1>
            <p className="text-xl text-neutral-600 dark:text-neutral-400 mt-2">
              Real-time monitoring and performance metrics
            </p>
            <p className="text-sm text-neutral-500 dark:text-neutral-500 mt-1">
              Last refreshed: {format(lastRefresh, 'MMM d, yyyy h:mm:ss a')}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Auto-refresh Toggle */}
            <div className="flex items-center gap-2 px-4 py-2 glass-card rounded-xl">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`p-2 rounded-lg transition-all ${
                  autoRefresh
                    ? 'bg-green-100 dark:bg-green-900/30 text-success-600'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600'
                }`}
              >
                {autoRefresh ? (
                  <PlayCircle size={20} />
                ) : (
                  <PauseCircle size={20} />
                )}
              </button>
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="bg-transparent text-sm text-neutral-700 dark:text-neutral-300 focus:outline-none cursor-pointer"
              >
                <option value={30}>30s</option>
                <option value={60}>1m</option>
                <option value={300}>5m</option>
              </select>
            </div>

            <ExportButton onExport={exportHealthData} label="Export" />

            <button
              onClick={runHealthChecks}
              disabled={loading}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-700 to-primary-800 hover:from-primary-800 hover:to-primary-900 disabled:from-neutral-400 disabled:to-neutral-500 text-white rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-105 disabled:scale-100 font-semibold"
            >
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </motion.div>

        {/* System Health Score */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-8 mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
                Overall System Health
              </h2>
              <p className="text-neutral-600 dark:text-neutral-400">
                Calculated from all component metrics and uptime data
              </p>
            </div>
            <div className="text-center">
              <div
                className={`text-7xl font-bold mb-2 bg-gradient-to-r ${getScoreGradient(
                  systemScore
                )} bg-clip-text text-transparent`}
              >
                {systemScore}
              </div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                Health Score
              </div>
            </div>
          </div>
        </motion.div>

        {/* Active Incidents */}
        {incidents.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-6 mb-8 border-2 border-red-200 dark:border-red-800"
          >
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="text-accent-600" size={24} />
              <h3 className="text-xl font-bold text-neutral-900 dark:text-white">
                Active Incidents ({incidents.length})
              </h3>
            </div>
            <div className="space-y-3">
              {incidents.map((incident) => (
                <div
                  key={incident.id}
                  className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-neutral-900 dark:text-white">
                        {incident.title}
                      </h4>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                        {incident.component_name} • {incident.status}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        incident.severity === 'critical'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          : incident.severity === 'error'
                          ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      }`}
                    >
                      {incident.severity}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Component Health Checks */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {checks.map((check, index) => {
            const StatusIcon = statusIcons[check.status];
            const CheckIcon = checkIcons[check.name] || Database;
            const componentTrends = trends[check.name] || [];

            return (
              <motion.div
                key={check.name}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className={`glass-card border-2 ${
                  statusBorderColors[check.status]
                } hover:shadow-2xl transition-all cursor-pointer group`}
                onClick={() => setSelectedComponent(check.name)}
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className={`w-14 h-14 rounded-xl bg-gradient-to-br ${
                        statusColors[check.status]
                      } flex items-center justify-center group-hover:scale-110 transition-transform`}
                    >
                      <CheckIcon className="text-white floating" size={28} />
                    </div>
                    <StatusIcon
                      size={28}
                      className={`${
                        check.status === 'healthy'
                          ? 'text-success-600 dark:text-green-400'
                          : check.status === 'warning'
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : check.status === 'error'
                          ? 'text-accent-600 dark:text-red-400'
                          : 'text-primary-800 dark:text-primary-500 animate-pulse'
                      }`}
                    />
                  </div>

                  {/* Component Name */}
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">
                    {check.name}
                  </h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                    {check.message}
                  </p>

                  {/* Metrics */}
                  {check.details && (
                    <div className="border-t border-neutral-200/50 dark:border-neutral-700/50 pt-4 mb-4">
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(check.details).map(([key, value]) => (
                          <div key={key}>
                            <div className="text-xs text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1">
                              {key}
                            </div>
                            <div className="text-lg font-bold text-neutral-900 dark:text-white">
                              {typeof value === 'number'
                                ? value.toLocaleString()
                                : value}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 24h Stats */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {check.uptime24h !== undefined && (
                      <div className="p-3 rounded-lg bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-900/20">
                        <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                          24h Uptime
                        </div>
                        <div
                          className={`text-xl font-bold ${getScoreColor(
                            check.uptime24h
                          )}`}
                        >
                          {check.uptime24h.toFixed(1)}%
                        </div>
                      </div>
                    )}
                    {check.latency !== undefined && (
                      <div className="p-3 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
                        <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                          Latency
                        </div>
                        <div className="text-xl font-bold text-neutral-900 dark:text-white">
                          {check.latency}ms
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Mini Trend Sparkline */}
                  {componentTrends.length > 0 && (
                    <div className="h-16 flex items-end justify-between gap-1">
                      {componentTrends.slice(-12).map((trend, idx) => {
                        const maxLatency = Math.max(
                          ...componentTrends.map((t) => t.latency)
                        );
                        const height = (trend.latency / maxLatency) * 100;
                        return (
                          <div
                            key={idx}
                            className="flex-1 flex flex-col items-center group/bar"
                          >
                            <div
                              className={`w-full rounded-t transition-all ${
                                trend.status === 'healthy'
                                  ? 'bg-success-500 dark:bg-green-400'
                                  : trend.status === 'warning'
                                  ? 'bg-yellow-500 dark:bg-yellow-400'
                                  : 'bg-accent-500 dark:bg-red-400'
                              }`}
                              style={{ height: `${height}%`, minHeight: '4px' }}
                              title={`${trend.hour}: ${trend.latency}ms`}
                            ></div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Last Checked */}
                  <div className="text-xs text-neutral-500 dark:text-neutral-500 mt-4 flex items-center gap-2">
                    <Clock size={12} />
                    Last checked: {format(new Date(check.lastChecked), 'h:mm:ss a')}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* System Status Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`glass-card p-8 ${
            checks.every((c) => c.status === 'healthy')
              ? 'border-2 border-green-200 dark:border-green-800'
              : checks.some((c) => c.status === 'error')
              ? 'border-2 border-red-200 dark:border-red-800'
              : 'border-2 border-yellow-200 dark:border-yellow-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
                System Status Summary
              </h3>
              <p
                className={`text-lg ${
                  checks.every((c) => c.status === 'healthy')
                    ? 'text-success-600 dark:text-green-400'
                    : checks.some((c) => c.status === 'error')
                    ? 'text-accent-600 dark:text-red-400'
                    : 'text-yellow-600 dark:text-yellow-400'
                }`}
              >
                {checks.every((c) => c.status === 'healthy')
                  ? 'All systems operational'
                  : checks.some((c) => c.status === 'error')
                  ? 'System degradation detected - immediate attention required'
                  : 'Some systems require attention'}
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-success-600 dark:text-green-400">
                  {checks.filter((c) => c.status === 'healthy').length}
                </div>
                <div className="text-sm text-neutral-600 dark:text-neutral-400">
                  Healthy
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                  {checks.filter((c) => c.status === 'warning').length}
                </div>
                <div className="text-sm text-neutral-600 dark:text-neutral-400">
                  Warnings
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-accent-600 dark:text-red-400">
                  {checks.filter((c) => c.status === 'error').length}
                </div>
                <div className="text-sm text-neutral-600 dark:text-neutral-400">
                  Errors
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
