// Help Panel - Starship Command Center
import React from 'react';
import { getAllCommands } from '../command-registry';
import { useTerminal } from '../terminal-provider';

export function HelpPanel() {
  const { execute } = useTerminal();
  const commands = getAllCommands();

  const categories = {
    navigation: commands.filter(c => c.category === 'navigation'),
    actions: commands.filter(c => c.category === 'actions'),
    data: commands.filter(c => c.category === 'data'),
    system: commands.filter(c => c.category === 'system'),
  };

  const categoryLabels: Record<string, { icon: string; title: string }> = {
    navigation: { icon: '🧭', title: 'NAVIGATION' },
    actions: { icon: '⚡', title: 'ACTIONS' },
    data: { icon: '📊', title: 'DATA DISPLAY' },
    system: { icon: '⚙️', title: 'SYSTEM' },
  };

  return (
    <div className="terminal-panel help-panel">
      <div className="panel-header">
        <span className="panel-icon">📖</span>
        <span className="panel-title">COMMAND REFERENCE</span>
        <span className="panel-count">{commands.length} commands</span>
      </div>

      <div className="panel-content">
        {Object.entries(categories).map(([category, cmds]) => (
          cmds.length > 0 && (
            <div key={category} className="help-category">
              <div className="section-title">
                {categoryLabels[category].icon} {categoryLabels[category].title}
              </div>
              <div className="commands-grid">
                {cmds.map(cmd => (
                  <button
                    key={cmd.name}
                    className="command-item"
                    onClick={() => execute(cmd.name)}
                    title={cmd.usage || cmd.description}
                  >
                    <span className="command-name">{cmd.name}</span>
                    {cmd.aliases && cmd.aliases.length > 0 && (
                      <span className="command-aliases">
                        ({cmd.aliases.slice(0, 2).join(', ')})
                      </span>
                    )}
                    <span className="command-desc">{cmd.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )
        ))}

        {/* Keyboard Shortcuts */}
        <div className="help-shortcuts">
          <div className="section-title">⌨️ KEYBOARD SHORTCUTS</div>
          <div className="shortcuts-grid">
            <div className="shortcut-item">
              <kbd>Ctrl</kbd>+<kbd>K</kbd>
              <span>Toggle Terminal</span>
            </div>
            <div className="shortcut-item">
              <kbd>↑</kbd><kbd>↓</kbd>
              <span>Navigate History</span>
            </div>
            <div className="shortcut-item">
              <kbd>Tab</kbd>
              <span>Autocomplete</span>
            </div>
            <div className="shortcut-item">
              <kbd>Esc</kbd>
              <span>Close Terminal</span>
            </div>
            <div className="shortcut-item">
              <kbd>Enter</kbd>
              <span>Execute Command</span>
            </div>
          </div>
        </div>
      </div>

      <div className="panel-footer">
        <span className="footer-hint">Click a command to execute it</span>
      </div>
    </div>
  );
}
