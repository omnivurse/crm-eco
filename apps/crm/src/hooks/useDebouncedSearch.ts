'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

interface UseDebouncedSearchOptions<T> {
  /** Items to search through (for client-side filtering) */
  items?: T[];
  /** Function to get searchable text from an item */
  getSearchableText?: (item: T) => string;
  /** Debounce delay in milliseconds (default: 200ms) */
  delay?: number;
  /** Minimum characters before searching (default: 0) */
  minChars?: number;
  /** Custom search function for API-based search */
  onSearch?: (query: string) => Promise<T[]>;
}

interface UseDebouncedSearchReturn<T> {
  /** Current search query */
  query: string;
  /** Set search query */
  setQuery: (query: string) => void;
  /** Debounced query (updates after delay) */
  debouncedQuery: string;
  /** Filtered/searched results */
  results: T[];
  /** Whether a search is in progress */
  isSearching: boolean;
  /** Clear the search */
  clear: () => void;
}

/**
 * Hook for debounced search with support for both client-side filtering and API-based search.
 *
 * @example Client-side filtering:
 * ```tsx
 * const { query, setQuery, results } = useDebouncedSearch({
 *   items: products,
 *   getSearchableText: (p) => `${p.name} ${p.category}`.toLowerCase(),
 * });
 * ```
 *
 * @example API-based search:
 * ```tsx
 * const { query, setQuery, results, isSearching } = useDebouncedSearch({
 *   delay: 300,
 *   onSearch: async (q) => {
 *     const { data } = await supabase.from('records').select('*').ilike('title', `%${q}%`);
 *     return data || [];
 *   },
 * });
 * ```
 */
export function useDebouncedSearch<T>({
  items = [],
  getSearchableText,
  delay = 200,
  minChars = 0,
  onSearch,
}: UseDebouncedSearchOptions<T> = {}): UseDebouncedSearchReturn<T> {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [apiResults, setApiResults] = useState<T[]>([]);

  // Debounce the query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, delay);

    return () => clearTimeout(timer);
  }, [query, delay]);

  // Handle API-based search
  useEffect(() => {
    if (!onSearch) return;

    const searchQuery = debouncedQuery.trim().toLowerCase();

    if (searchQuery.length < minChars) {
      setApiResults([]);
      return;
    }

    let cancelled = false;
    setIsSearching(true);

    onSearch(searchQuery)
      .then((results) => {
        if (!cancelled) {
          setApiResults(results);
        }
      })
      .catch((error) => {
        console.error('Search error:', error);
        if (!cancelled) {
          setApiResults([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsSearching(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, minChars, onSearch]);

  // Client-side filtering
  const filteredResults = useMemo(() => {
    if (onSearch) return apiResults; // Use API results if onSearch is provided

    const searchQuery = debouncedQuery.trim().toLowerCase();

    if (searchQuery.length < minChars) {
      return items;
    }

    if (!searchQuery) {
      return items;
    }

    if (!getSearchableText) {
      // Default: search through stringified items
      return items.filter((item) =>
        JSON.stringify(item).toLowerCase().includes(searchQuery)
      );
    }

    return items.filter((item) =>
      getSearchableText(item).toLowerCase().includes(searchQuery)
    );
  }, [items, debouncedQuery, minChars, getSearchableText, onSearch, apiResults]);

  const clear = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
    setApiResults([]);
  }, []);

  return {
    query,
    setQuery,
    debouncedQuery,
    results: filteredResults,
    isSearching,
    clear,
  };
}

/**
 * Simple hook for just debouncing a value
 */
export function useDebouncedValue<T>(value: T, delay = 200): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
