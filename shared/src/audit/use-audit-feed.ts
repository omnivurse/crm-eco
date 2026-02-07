'use client';

/**
 * Audit Logging System - useAuditFeed Hook
 * React hook for subscribing to and managing a real-time audit log feed
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  AuditLogEntry,
  UseAuditFeedOptions,
  UseAuditFeedReturn,
  RiskLevel,
} from './types';
import { RISK_ORDER } from './types';

/**
 * Hook for subscribing to and managing a real-time audit log feed
 *
 * @param supabase - Supabase client instance
 * @param options - Feed configuration options
 * @returns Feed state and control functions
 *
 * @example
 * const auditFeed = useAuditFeed(supabase, {
 *   orgId: profile.organization_id,
 *   minRiskLevel: 'medium',
 *   onHighRiskEvent: (event) => {
 *     toast.warning(`High-risk activity: ${event.description}`);
 *   }
 * });
 */
export function useAuditFeed(
  supabase: any,
  options: UseAuditFeedOptions
): UseAuditFeedReturn {
  const {
    orgId,
    appSource,
    minRiskLevel = 'low',
    maxEvents = 100,
    throttleMs = 500,
    autoRefresh = false,
    refreshInterval = 30000,
    onHighRiskEvent,
  } = options;

  const [events, setEvents] = useState<AuditLogEntry[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [newEventCount, setNewEventCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Refs for callbacks and throttling
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  const pendingEvents = useRef<AuditLogEntry[]>([]);
  const throttleTimer = useRef<NodeJS.Timeout | null>(null);

  // Stable ref for callback to prevent re-subscription
  const onHighRiskEventRef = useRef(onHighRiskEvent);
  onHighRiskEventRef.current = onHighRiskEvent;

  // Flush pending events with throttling
  const flushEvents = useCallback(() => {
    if (pendingEvents.current.length === 0) return;

    setEvents((prev) => {
      const newEvents = [...pendingEvents.current, ...prev].slice(0, maxEvents);
      pendingEvents.current = [];
      return newEvents;
    });
  }, [maxEvents]);

  // Check if event meets minimum risk level
  const meetsRiskThreshold = useCallback(
    (level: RiskLevel): boolean => {
      return RISK_ORDER[level] >= RISK_ORDER[minRiskLevel];
    },
    [minRiskLevel]
  );

  // Subscribe to Supabase realtime for audit logs
  useEffect(() => {
    if (!supabase || !orgId) return;

    const channel = supabase
      .channel(`audit-logs:${orgId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'unified_audit_logs',
          filter: `organization_id=eq.${orgId}`,
        },
        (payload: { new: AuditLogEntry }) => {
          const event = payload.new;

          // Filter by app source if specified
          if (appSource && event.app_source !== appSource) return;

          // Check minimum risk level filter
          if (!meetsRiskThreshold(event.risk_level)) return;

          // Trigger high-risk callback (for toast notifications)
          if (event.risk_level === 'high' || event.risk_level === 'critical') {
            onHighRiskEventRef.current?.(event);
          }

          if (isPausedRef.current) {
            setNewEventCount((prev) => prev + 1);
            return;
          }

          // Add to pending events with throttling
          pendingEvents.current.push(event);

          if (!throttleTimer.current) {
            throttleTimer.current = setTimeout(() => {
              flushEvents();
              throttleTimer.current = null;
            }, throttleMs);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (throttleTimer.current) {
        clearTimeout(throttleTimer.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    supabase,
    orgId,
    appSource,
    minRiskLevel,
    throttleMs,
    meetsRiskThreshold,
    flushEvents,
    // onHighRiskEvent removed - using ref to prevent re-subscription
  ]);

  // Fetch function
  const fetchEvents = useCallback(async () => {
    try {
      setIsLoading(true);

      let query = supabase
        .from('unified_audit_logs')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(maxEvents);

      if (appSource) {
        query = query.eq('app_source', appSource);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      // Filter by minimum risk level
      const filteredEvents = (data || []).filter((event: AuditLogEntry) =>
        meetsRiskThreshold(event.risk_level)
      );

      setEvents(filteredEvents);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [supabase, orgId, appSource, maxEvents, meetsRiskThreshold]);

  // Initial fetch
  useEffect(() => {
    if (supabase && orgId) {
      fetchEvents();
    }
  }, [supabase, orgId, fetchEvents]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh || refreshInterval <= 0) return;

    const intervalId = setInterval(() => {
      if (!isPausedRef.current) {
        fetchEvents();
      }
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [autoRefresh, refreshInterval, fetchEvents]);

  // Control functions
  const pause = useCallback(() => {
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    setIsPaused(false);
    setNewEventCount(0);
  }, []);

  const clear = useCallback(() => {
    setEvents([]);
    setNewEventCount(0);
  }, []);

  const refresh = useCallback(async () => {
    await fetchEvents();
    setNewEventCount(0);
  }, [fetchEvents]);

  const prepend = useCallback(
    (event: AuditLogEntry) => {
      setEvents((prev) => [event, ...prev].slice(0, maxEvents));
    },
    [maxEvents]
  );

  return {
    events,
    isPaused,
    newEventCount,
    isLoading,
    error,
    pause,
    resume,
    clear,
    refresh,
    prepend,
  };
}

/**
 * Hook for subscribing to Supabase realtime audit logs via broadcast
 * Use this for cross-tab notifications without WAL polling overhead
 *
 * @param supabase - Supabase client instance
 * @param orgId - Organization ID to subscribe to
 * @param onEvent - Callback when an audit event occurs
 */
export function useAuditSubscription(
  supabase: any,
  orgId: string,
  onEvent?: (event: AuditLogEntry) => void
) {
  useEffect(() => {
    if (!supabase || !orgId) return;

    const channel = supabase
      .channel(`audit-broadcast:${orgId}`)
      .on(
        'broadcast',
        { event: 'audit_event' },
        (payload: { payload: AuditLogEntry }) => {
          onEvent?.(payload.payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, orgId, onEvent]);
}
