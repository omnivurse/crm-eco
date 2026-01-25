// Command Input - Starship Command Center
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useTerminal } from './terminal-provider';

export function CommandInput() {
  const {
    inputValue,
    setInputValue,
    execute,
    navigateHistory,
    getSuggestions,
    isExecuting,
  } = useTerminal();

  const inputRef = useRef<HTMLInputElement>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Focus input when terminal opens
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Update suggestions as user types
  useEffect(() => {
    if (inputValue.trim()) {
      const newSuggestions = getSuggestions(inputValue);
      setSuggestions(newSuggestions);
      setShowSuggestions(newSuggestions.length > 0);
      setSelectedSuggestion(-1);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [inputValue, getSuggestions]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (inputValue.trim() && !isExecuting) {
        setShowSuggestions(false);
        execute(inputValue);
      }
    },
    [inputValue, execute, isExecuting]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          if (showSuggestions && suggestions.length > 0) {
            setSelectedSuggestion(prev =>
              prev <= 0 ? suggestions.length - 1 : prev - 1
            );
          } else {
            navigateHistory('up');
          }
          break;

        case 'ArrowDown':
          e.preventDefault();
          if (showSuggestions && suggestions.length > 0) {
            setSelectedSuggestion(prev =>
              prev >= suggestions.length - 1 ? 0 : prev + 1
            );
          } else {
            navigateHistory('down');
          }
          break;

        case 'Tab':
          e.preventDefault();
          if (suggestions.length > 0) {
            const suggestion = selectedSuggestion >= 0
              ? suggestions[selectedSuggestion]
              : suggestions[0];
            setInputValue(suggestion + ' ');
            setShowSuggestions(false);
          }
          break;

        case 'Escape':
          setShowSuggestions(false);
          setSelectedSuggestion(-1);
          break;

        case 'Enter':
          if (showSuggestions && selectedSuggestion >= 0) {
            e.preventDefault();
            setInputValue(suggestions[selectedSuggestion] + ' ');
            setShowSuggestions(false);
          }
          break;
      }
    },
    [navigateHistory, setInputValue, suggestions, selectedSuggestion, showSuggestions]
  );

  return (
    <div className="terminal-input-container">
      <form onSubmit={handleSubmit} className="terminal-input-form">
        <span className="terminal-prompt">
          <span className="prompt-chevron">›</span>
          <span className="prompt-cursor">_</span>
        </span>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          className="terminal-input"
          placeholder="Enter command..."
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          disabled={isExecuting}
        />
        {isExecuting && (
          <span className="terminal-executing">
            <span className="executing-dot" />
            <span className="executing-dot" />
            <span className="executing-dot" />
          </span>
        )}
      </form>

      {showSuggestions && suggestions.length > 0 && (
        <div className="terminal-suggestions">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion}
              type="button"
              className={`terminal-suggestion ${index === selectedSuggestion ? 'selected' : ''}`}
              onClick={() => {
                setInputValue(suggestion + ' ');
                setShowSuggestions(false);
                inputRef.current?.focus();
              }}
              onMouseEnter={() => setSelectedSuggestion(index)}
            >
              <span className="suggestion-command">{suggestion}</span>
              <span className="suggestion-hint">Tab</span>
            </button>
          ))}
        </div>
      )}

      <div className="terminal-input-hints">
        <span className="hint">
          <kbd>↑</kbd><kbd>↓</kbd> History
        </span>
        <span className="hint">
          <kbd>Tab</kbd> Complete
        </span>
        <span className="hint">
          <kbd>Esc</kbd> Close
        </span>
      </div>
    </div>
  );
}
