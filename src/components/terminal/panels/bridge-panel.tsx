// Bridge Panel - Starship Command Center
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useTerminal } from '../terminal-provider';

interface BridgeMetric {
  label: string;
  value: string | number;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  icon: string;
}

interface BridgeAlert {
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
}

export function BridgePanel() {
  const { profile } = useAuth();
  const { execute } = useTerminal();
  const [metrics, setMetrics] = useState<BridgeMetric[]>([]);
  const [alerts, setAlerts] = useState<BridgeAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBridgeData() {
      setLoading(true);
      try {
        // Fetch ticket stats
        const { count: openTickets } = await supabase
          .from('tickets')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'open');

        const { count: urgentTickets } = await supabase
          .from('tickets')
          .select('*', { count: 'exact', head: true })
          .eq('priority', 'urgent')
          .neq('status', 'closed');

        // Fetch task stats
        const { count: pendingTasks } = await supabase
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');

        // Fetch request stats
        const { count: openRequests } = await supabase
          .from('requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'open');

        setMetrics([
          {
            label: 'Open Tickets',
            value: openTickets || 0,
            trend: openTickets && openTickets > 10 ? '+' + (openTickets - 10) : undefined,
            trendDirection: openTickets && openTickets > 10 ? 'up' : 'neutral',
            icon: '🎫',
          },
          {
            label: 'Urgent Items',
            value: urgentTickets || 0,
            trendDirection: urgentTickets && urgentTickets > 0 ? 'up' : 'neutral',
            icon: '🚨',
          },
          {
            label: 'Pending Tasks',
            value: pendingTasks || 0,
            icon: '📋',
          },
          {
            label: 'Open Requests',
            value: openRequests || 0,
            icon: '📨',
          },
        ]);

        // Generate alerts
        const newAlerts: BridgeAlert[] = [];
        if (urgentTickets && urgentTickets > 0) {
          newAlerts.push({
            type: 'warning',
            message: `${urgentTickets} urgent ticket${urgentTickets > 1 ? 's' : ''} require attention`,
          });
        }
        if (openTickets && openTickets > 20) {
          newAlerts.push({
            type: 'info',
            message: `High ticket volume: ${openTickets} open tickets`,
          });
        }
        if (newAlerts.length === 0) {
          newAlerts.push({
            type: 'success',
            message: 'All systems operational',
          });
        }
        setAlerts(newAlerts);
      } catch (error) {
        console.error('Failed to fetch bridge data:', error);
        setAlerts([{ type: 'error', message: 'Failed to load bridge data' }]);
      } finally {
        setLoading(false);
      }
    }

    fetchBridgeData();
  }, [profile]);

  const quickActions = [
    { label: '[N]ew Ticket', command: 'new ticket', shortcut: 'n' },
    { label: '[T]ickets', command: 'tickets', shortcut: 't' },
    { label: '[S]earch', command: 'search ', shortcut: 's' },
    { label: '[D]esk', command: 'desk', shortcut: 'd' },
  ];

  if (loading) {
    return (
      <div className="terminal-panel bridge-panel loading">
        <div className="panel-header">
          <span className="panel-icon">🚀</span>
          <span className="panel-title">COMMAND BRIDGE</span>
          <span className="panel-status loading">LOADING...</span>
        </div>
        <div className="panel-loading">
          <div className="loading-bar" />
        </div>
      </div>
    );
  }

  return (
    <div className="terminal-panel bridge-panel">
      <div className="panel-header">
        <span className="panel-icon">🚀</span>
        <span className="panel-title">COMMAND BRIDGE</span>
        <span className="panel-status online">ONLINE</span>
      </div>

      <div className="panel-content">
        {/* Metrics Grid */}
        <div className="bridge-metrics">
          {metrics.map((metric, index) => (
            <div key={index} className="metric-card">
              <div className="metric-icon">{metric.icon}</div>
              <div className="metric-details">
                <span className="metric-value">{metric.value}</span>
                <span className="metric-label">{metric.label}</span>
                {metric.trend && (
                  <span className={`metric-trend ${metric.trendDirection}`}>
                    {metric.trend}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Alerts Section */}
        <div className="bridge-alerts">
          <div className="section-title">◈ SYSTEM ALERTS</div>
          {alerts.map((alert, index) => (
            <div key={index} className={`alert-item alert-${alert.type}`}>
              <span className="alert-indicator" />
              <span className="alert-message">{alert.message}</span>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="bridge-actions">
          <div className="section-title">◈ QUICK ACTIONS</div>
          <div className="actions-grid">
            {quickActions.map((action, index) => (
              <button
                key={index}
                className="action-btn"
                onClick={() => execute(action.command)}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="panel-footer">
        <span className="footer-text">STARDATE {new Date().toISOString().split('T')[0]}</span>
        <span className="footer-text">USER: {profile?.full_name || 'UNKNOWN'}</span>
      </div>
    </div>
  );
}
