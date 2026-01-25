'use client';

// Command Output - Pay It Forward Command Center
import React, { useRef, useEffect } from 'react';
import { useTerminal } from './terminal-provider';
import type { CommandResult, TableData } from './types';

// Panel Components
import { BridgePanel } from './panels/bridge-panel';
import { DealsPanel } from './panels/deals-panel';
import { TasksPanel } from './panels/tasks-panel';
import { StatusPanel } from './panels/status-panel';
import { HelpPanel } from './panels/help-panel';

interface OutputLineProps {
  result: CommandResult;
}

function OutputLine({ result }: OutputLineProps) {
  const typeClasses: Record<string, string> = {
    success: 'output-success',
    error: 'output-error',
    info: 'output-info',
    warning: 'output-warning',
    panel: 'output-panel',
    table: 'output-table',
  };

  if (result.type === 'table' && result.data) {
    const tableData = result.data as TableData;
    return (
      <div className="output-line output-table">
        {result.message && <div className="output-message">{result.message}</div>}
        <table className="terminal-table">
          <thead>
            <tr>
              {tableData.headers.map((header, i) => (
                <th key={i}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableData.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className={`output-line ${typeClasses[result.type] || 'output-info'}`}>
      {result.type === 'error' && <span className="output-icon">✗</span>}
      {result.type === 'success' && <span className="output-icon">✓</span>}
      {result.type === 'warning' && <span className="output-icon">⚠</span>}
      <span className="output-message">{result.message}</span>
    </div>
  );
}

function PanelRenderer() {
  const { currentPanel, output } = useTerminal();

  // Get panel data from most recent panel output
  const panelData = output
    .filter(o => o.type === 'panel')
    .pop()?.data;

  switch (currentPanel) {
    case 'bridge':
      return <BridgePanel />;
    case 'deals':
      return <DealsPanel data={panelData as { filter?: string } | undefined} />;
    case 'tasks':
      return <TasksPanel data={panelData as any} />;
    case 'status':
      return <StatusPanel />;
    case 'help':
      return <HelpPanel />;
    case 'forecast':
      return <ForecastPanel />;
    case 'analytics':
      return <AnalyticsPanel />;
    default:
      return null;
  }
}

function ForecastPanel() {
  return (
    <div className="terminal-panel forecast-panel">
      <div className="panel-header">
        <span className="panel-icon">📊</span>
        <span className="panel-title">FORECAST PROJECTION</span>
      </div>
      <div className="panel-content">
        <div className="forecast-grid">
          <div className="forecast-item">
            <span className="forecast-label">Q1 Projected</span>
            <span className="forecast-value">$245,000</span>
            <span className="forecast-trend positive">+12%</span>
          </div>
          <div className="forecast-item">
            <span className="forecast-label">Q2 Projected</span>
            <span className="forecast-value">$312,000</span>
            <span className="forecast-trend positive">+27%</span>
          </div>
          <div className="forecast-item">
            <span className="forecast-label">Win Rate</span>
            <span className="forecast-value">34%</span>
            <span className="forecast-trend neutral">+2%</span>
          </div>
          <div className="forecast-item">
            <span className="forecast-label">Avg Deal Size</span>
            <span className="forecast-value">$18,500</span>
            <span className="forecast-trend positive">+8%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalyticsPanel() {
  return (
    <div className="terminal-panel analytics-panel">
      <div className="panel-header">
        <span className="panel-icon">📈</span>
        <span className="panel-title">ANALYTICS OVERVIEW</span>
      </div>
      <div className="panel-content">
        <div className="analytics-grid">
          <div className="analytics-card">
            <div className="analytics-label">Tickets Resolved</div>
            <div className="analytics-value">127</div>
            <div className="analytics-period">This Week</div>
          </div>
          <div className="analytics-card">
            <div className="analytics-label">Avg Resolution Time</div>
            <div className="analytics-value">4.2h</div>
            <div className="analytics-period">-18% vs last week</div>
          </div>
          <div className="analytics-card">
            <div className="analytics-label">Customer Satisfaction</div>
            <div className="analytics-value">94%</div>
            <div className="analytics-period">+3% vs last month</div>
          </div>
          <div className="analytics-card">
            <div className="analytics-label">SLA Compliance</div>
            <div className="analytics-value">98.5%</div>
            <div className="analytics-period">Target: 95%</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CommandOutput() {
  const { output, currentPanel } = useTerminal();
  const outputRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  return (
    <div className="terminal-output" ref={outputRef}>
      {/* Welcome message */}
      {output.length === 0 && !currentPanel && (
        <div className="terminal-welcome">
          <div className="welcome-header">
            <pre className="welcome-ascii">{`
╔═════════════════════════════════════════════════════════════════╗
║     ██████╗  █████╗ ██╗   ██╗    ██╗████████╗                   ║
║     ██╔══██╗██╔══██╗╚██╗ ██╔╝    ██║╚══██╔══╝                   ║
║     ██████╔╝███████║ ╚████╔╝     ██║   ██║                      ║
║     ██╔═══╝ ██╔══██║  ╚██╔╝      ██║   ██║                      ║
║     ██║     ██║  ██║   ██║       ██║   ██║                      ║
║     ╚═╝     ╚═╝  ╚═╝   ╚═╝       ╚═╝   ╚═╝                      ║
║  ███████╗ ██████╗ ██████╗ ██╗    ██╗ █████╗ ██████╗ ██████╗     ║
║  ██╔════╝██╔═══██╗██╔══██╗██║    ██║██╔══██╗██╔══██╗██╔══██╗    ║
║  █████╗  ██║   ██║██████╔╝██║ █╗ ██║███████║██████╔╝██║  ██║    ║
║  ██╔══╝  ██║   ██║██╔══██╗██║███╗██║██╔══██║██╔══██╗██║  ██║    ║
║  ██║     ╚██████╔╝██║  ██║╚███╔███╔╝██║  ██║██║  ██║██████╔╝    ║
║  ╚═╝      ╚═════╝ ╚═╝  ╚═╝ ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝     ║
║                    COMMAND CENTER v1.0                          ║
╚═════════════════════════════════════════════════════════════════╝
            `}</pre>
          </div>
          <div className="welcome-info">
            <p>Type <code>help</code> for available commands</p>
            <p>Type <code>bridge</code> to access the command bridge</p>
          </div>
          <div className="welcome-shortcuts">
            <span><kbd>Ctrl</kbd>+<kbd>K</kbd> Toggle Terminal</span>
            <span><kbd>↑</kbd><kbd>↓</kbd> History</span>
            <span><kbd>Tab</kbd> Autocomplete</span>
          </div>
        </div>
      )}

      {/* Command output history */}
      <div className="output-history">
        {output.map((result, index) => (
          <OutputLine key={`${result.timestamp}-${index}`} result={result} />
        ))}
      </div>

      {/* Active panel */}
      {currentPanel && (
        <div className="panel-container">
          <PanelRenderer />
        </div>
      )}
    </div>
  );
}
