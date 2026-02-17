'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Contact,
  Search,
  Loader2,
  User,
  Mail,
  Phone,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  module: string;
  moduleKey: string;
  url: string;
}

interface ContactsPanelProps {
  onClose: () => void;
}

export function ContactsPanel({ onClose }: ContactsPanelProps) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentContacts, setRecentContacts] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const router = useRouter();
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Fetch recent contacts on mount
  const fetchRecent = useCallback(async () => {
    try {
      const res = await fetch('/api/crm/search?q=a&module=contacts&limit=10');
      if (res.ok) {
        const data = await res.json();
        setRecentContacts(data.results || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  useEffect(() => {
    fetchRecent();
  }, [fetchRecent]);

  // Search contacts
  useEffect(() => {
    if (!search.trim()) {
      setResults([]);
      return;
    }

    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/crm/search?q=${encodeURIComponent(search)}&module=contacts&limit=15`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(searchTimeout.current);
  }, [search]);

  const displayResults = search.trim() ? results : recentContacts;
  const isSearching = search.trim() ? loading : loadingRecent;

  const parseSubtitle = (subtitle?: string) => {
    if (!subtitle) return { email: null, phone: null, status: null };
    const parts = subtitle.split(' · ');
    const email = parts.find(p => p.includes('@')) || null;
    const phone = parts.find(p => p.match(/^\+?\d/)) || null;
    const status = parts.find(p => !p.includes('@') && !p.match(/^\+?\d/)) || null;
    return { email, phone, status };
  };

  return (
    <div className="flex flex-col max-h-[480px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Contact className="w-4 h-4 text-teal-500" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Contacts</h3>
        </div>
        <button
          onClick={() => { router.push('/crm/modules/contacts'); onClose(); }}
          className="flex items-center gap-1 text-[10px] font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 transition-colors"
        >
          View All
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts..."
            className="w-full text-xs pl-7 pr-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500/50"
            autoFocus
          />
        </div>
      </div>

      {/* Label */}
      {!search.trim() && !loadingRecent && recentContacts.length > 0 && (
        <div className="px-4 pt-2 pb-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Recent Contacts
          </span>
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {isSearching ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : displayResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <User className="w-8 h-8 text-slate-300 dark:text-slate-600" />
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {search ? 'No contacts found' : 'No recent contacts'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {displayResults.map((contact) => {
              const { email, phone, status } = parseSubtitle(contact.subtitle);
              return (
                <button
                  key={contact.id}
                  onClick={() => { router.push(contact.url); onClose(); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-teal-600 dark:text-teal-400">
                      {contact.title.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-800 dark:text-white truncate">
                      {contact.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {email && (
                        <span className="flex items-center gap-0.5 text-[10px] text-slate-400 dark:text-slate-500 truncate">
                          <Mail className="w-2.5 h-2.5 flex-shrink-0" />
                          {email}
                        </span>
                      )}
                      {phone && (
                        <span className="flex items-center gap-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                          <Phone className="w-2.5 h-2.5 flex-shrink-0" />
                          {phone}
                        </span>
                      )}
                    </div>
                    {status && (
                      <span className="inline-block text-[9px] mt-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1 py-0.5 rounded capitalize">
                        {status}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
