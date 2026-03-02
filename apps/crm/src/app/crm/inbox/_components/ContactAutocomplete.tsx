'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, User, Loader2, X } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';

interface ContactResult {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
}

interface ContactAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (contact: ContactResult) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function ContactAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Search contacts or enter email...',
  className,
  disabled,
}: ContactAutocompleteProps) {
  const [results, setResults] = useState<ContactResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const search = useCallback(async (query: string) => {
    if (query.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/crm/contacts/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.contacts || []);
      setShowDropdown((data.contacts || []).length > 0);
      setSelectedIndex(-1);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, search]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (contact: ContactResult) => {
    onChange(contact.email);
    setShowDropdown(false);
    onSelect?.(contact);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'w-full pl-9 pr-8 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent',
            className
          )}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
        )}
        {!loading && value && (
          <button
            onClick={() => { onChange(''); setResults([]); setShowDropdown(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {showDropdown && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-[200px] overflow-y-auto"
        >
          {results.map((contact, i) => (
            <button
              key={contact.id}
              onClick={() => handleSelect(contact)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors',
                i === selectedIndex && 'bg-teal-50 dark:bg-teal-500/10',
                i === 0 && 'rounded-t-lg',
                i === results.length - 1 && 'rounded-b-lg'
              )}
            >
              <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                <User className="w-3.5 h-3.5 text-slate-500" />
              </div>
              <div className="min-w-0 text-left">
                <div className="font-medium text-slate-900 dark:text-white truncate">
                  {contact.name || contact.email}
                </div>
                {contact.name && (
                  <div className="text-xs text-slate-500 truncate">{contact.email}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
