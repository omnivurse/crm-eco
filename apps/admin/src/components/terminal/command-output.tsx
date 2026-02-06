'use client';

// Command Output - Pay It Forward Command Center
import React, { useRef, useEffect } from 'react';
import { useTerminal } from './terminal-provider';
import type { CommandResult, TableData } from './types';

// Panel Components
import { BridgePanel } from './panels/bridge-panel';
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
        {result.message && (
          <div className="output-message" style={{ whiteSpace: 'pre-wrap', marginBottom: '8px' }}>
            {result.message}
          </div>
        )}
        <div style={{ overflowX: 'auto' }}>
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
      </div>
    );
  }

  return (
    <div className={`output-line ${typeClasses[result.type] || 'output-info'}`}>
      {result.type === 'error' && <span className="output-icon">✗</span>}
      {result.type === 'success' && <span className="output-icon">✓</span>}
      {result.type === 'warning' && <span className="output-icon">⚠</span>}
      <span className="output-message" style={{ whiteSpace: 'pre-wrap' }}>{result.message}</span>
    </div>
  );
}

function PanelRenderer() {
  const { currentPanel } = useTerminal();

  switch (currentPanel) {
    case 'bridge':
      return <BridgePanel />;
    case 'status':
      return <StatusPanel />;
    case 'help':
      return <HelpPanel />;
    default:
      return null;
  }
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
║                    COMMAND CENTER v2.0                          ║
╚═════════════════════════════════════════════════════════════════╝
            `}</pre>
          </div>
          <div className="welcome-info">
            <p>Type <code>help</code> for available commands</p>
            <p>Type <code>search [query]</code> to find members, agents, vendors & more</p>
            <p>Type <code>bridge</code> for quick actions</p>
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
