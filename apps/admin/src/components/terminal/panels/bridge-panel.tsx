'use client';

// Bridge Panel - Pay It Forward Command Center
import React from 'react';
import { useTerminal } from '../terminal-provider';

export function BridgePanel() {
  const { execute } = useTerminal();

  const quickActions = [
    { label: '🔍 Search', command: 'search' },
    { label: '👥 Members', command: 'member' },
    { label: '🤝 Agents', command: 'agent' },
    { label: '📦 Products', command: 'product' },
    { label: '📋 Enrollments', command: 'enrollment' },
    { label: '🏢 Vendors', command: 'vendor' },
    { label: '💰 Billing', command: 'billing' },
    { label: '📧 Emails', command: 'email' },
    { label: '📊 Reports', command: 'reports' },
    { label: '⚙️ Settings', command: 'settings' },
    { label: '📈 Counts', command: 'count' },
    { label: '🕐 Activity', command: 'recent' },
  ];

  return (
    <div className="terminal-panel bridge-panel">
      <div className="panel-header">
        <span className="panel-icon">🚀</span>
        <span className="panel-title">COMMAND BRIDGE</span>
        <span className="panel-status online">ONLINE</span>
      </div>

      <div className="panel-content">
        <div className="bridge-alerts">
          <div className="section-title">◈ QUICK COMMANDS</div>
          <div className="alert-item alert-info">
            <span className="alert-indicator" />
            <span className="alert-message">Type <code>search [query]</code> to search everything</span>
          </div>
          <div className="alert-item alert-info">
            <span className="alert-indicator" />
            <span className="alert-message">Type <code>member [name]</code> to find a member</span>
          </div>
          <div className="alert-item alert-info">
            <span className="alert-indicator" />
            <span className="alert-message">Type <code>count</code> to see record totals</span>
          </div>
          <div className="alert-item alert-info">
            <span className="alert-indicator" />
            <span className="alert-message">Type <code>whoami</code> to see your profile</span>
          </div>
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
