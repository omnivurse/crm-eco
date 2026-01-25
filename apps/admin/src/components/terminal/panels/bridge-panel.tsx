'use client';

// Bridge Panel - Starship Command Center
import React from 'react';
import { useTerminal } from '../terminal-provider';

export function BridgePanel() {
  const { execute } = useTerminal();

  const metrics = [
    { label: 'Pipeline Value', value: '$1.2M', trend: '+12%', icon: '💰' },
    { label: 'Active Deals', value: '42', trend: '+5', icon: '📊' },
    { label: 'Won This Month', value: '8', trend: '+3', icon: '🏆' },
    { label: 'Conversion Rate', value: '34%', trend: '+2%', icon: '📈' },
  ];

  const alerts = [
    { type: 'warning' as const, message: '5 deals closing this week' },
    { type: 'info' as const, message: '3 new leads assigned' },
  ];

  const quickActions = [
    { label: '[N]ew Deal', command: 'new deal' },
    { label: '[S]earch', command: 'search ' },
    { label: '[D]eals', command: 'deals' },
    { label: '[R]eports', command: 'goto /crm/reports' },
  ];

  return (
    <div className="terminal-panel bridge-panel">
      <div className="panel-header">
        <span className="panel-icon">🚀</span>
        <span className="panel-title">COMMAND BRIDGE</span>
        <span className="panel-status online">ONLINE</span>
      </div>

      <div className="panel-content">
        <div className="bridge-metrics">
          {metrics.map((metric, index) => (
            <div key={index} className="metric-card">
              <div className="metric-icon">{metric.icon}</div>
              <div className="metric-details">
                <span className="metric-value">{metric.value}</span>
                <span className="metric-label">{metric.label}</span>
                {metric.trend && (
                  <span className="metric-trend up">{metric.trend}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="bridge-alerts">
          <div className="section-title">◈ SYSTEM ALERTS</div>
          {alerts.map((alert, index) => (
            <div key={index} className={`alert-item alert-${alert.type}`}>
              <span className="alert-indicator" />
              <span className="alert-message">{alert.message}</span>
            </div>
          ))}
        </div>

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
      </div>
    </div>
  );
}
