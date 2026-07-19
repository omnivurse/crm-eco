'use client';

import { CaretRight } from '@phosphor-icons/react';
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { cn } from '@crm-eco/ui/lib/utils';
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

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const newSuggestions = inputValue.trim() ? getSuggestions(inputValue) : [];
    queueMicrotask(() => {
      setSuggestions(newSuggestions);
      setShowSuggestions(newSuggestions.length > 0);
      if (inputValue.trim()) {
        setSelectedSuggestion(-1);
      }
    });
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
    <div className="relative border-t bg-muted/30 px-3 py-2.5">
      {/* Suggestions dropdown (above input) */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute bottom-full left-3 right-3 mb-1 rounded-lg border bg-popover shadow-lg overflow-hidden z-10">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion}
              type="button"
              className={cn(
                'flex w-full items-center justify-between px-3 py-2 text-sm text-left transition-colors',
                index === selectedSuggestion
                  ? 'bg-primary/10 text-primary'
                  : 'text-popover-foreground hover:bg-muted/50'
              )}
              onClick={() => {
                setInputValue(suggestion + ' ');
                setShowSuggestions(false);
                inputRef.current?.focus();
              }}
              onMouseEnter={() => setSelectedSuggestion(index)}
            >
              <span className="font-medium font-mono">{suggestion}</span>
              <kbd className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                Tab
              </kbd>
            </button>
          ))}
        </div>
      )}

      {/* Input row */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <CaretRight weight="light" className="w-4 h-4 text-primary shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          className={cn(
            'flex-1 bg-transparent border-none outline-none text-sm font-mono',
            'text-foreground placeholder:text-muted-foreground',
            'caret-primary',
            isExecuting && 'opacity-50'
          )}
          placeholder="Enter command..."
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          disabled={isExecuting}
        />
        {isExecuting && (
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse [animation-delay:300ms]" />
          </div>
        )}
      </form>

      {/* Hint bar */}
      <div className="flex gap-4 mt-1.5 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">↑↓</kbd>
          History
        </span>
        <span className="flex items-center gap-1">
          <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">Tab</kbd>
          Complete
        </span>
        <span className="hidden sm:flex items-center gap-1">
          <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">Esc</kbd>
          Close
        </span>
      </div>
    </div>
  );
}
