'use client';

/**
 * Change Intelligence System - useChangeFeed Hook
 * React hook for subscribing to and managing a change feed
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ChangeEventBus } from '../event-bus';
import { SEVERITY_ORDER, DEFAULT_FEED_SETTINGS } from '../constants';
import type {
  ChangeEventWithActor,
  ChangeEventPayload,
  UseChangeFeedOptions,
  UseChangeFeedReturn,
  ChangeSeverity,
} from '../types';

/**
 * Hook for subscribing to and managing a real-time change feed
 * @param options - Feed configuration options
 * @returns Feed state and control functions
 */
export function useChangeFeed(options: UseChangeFeedOptions): UseChangeFeedReturn {
  const {
    orgId,
    entityTypes = [],
    sourceTypes = [],
    minSeverity = DEFAULT_FEED_SETTINGS.minSeverity,
    maxEvents = DEFAULT_FEED_SETTINGS.maxEvents,
    autoRefresh = true,
    refreshInterval = DEFAULT_FEED_SETTINGS.refreshInterval,
    realtime = DEFAULT_FEED_SETTINGS.realtime,
  } = options;

  const [events, setEvents] = useState<ChangeEventWithActor[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [newEventCount, setNewEventCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Track paused state in ref for event handler
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  // Filter function to check if event matches criteria
  const matchesFilters = useCallback(
    (event: ChangeEventPayload): boolean => {
      // Check org
      if (event.orgId !== orgId) return false;

      // Check entity types
      if (entityTypes.length > 0 && !entityTypes.includes(event.entityType)) return false;

      // Check source types
      if (sourceTypes.length > 0 && !sourceTypes.includes(event.sourceType)) return false;

      // Check severity
      const eventPriority = SEVERITY_ORDER[event.severity];
      const minPriority = SEVERITY_ORDER[minSeverity];
      if (eventPriority > minPriority) return false;

      return true;
    },
    [orgId, entityTypes, sourceTypes, minSeverity]
  );

  // Convert EventPayload to ChangeEventWithActor
  const payloadToEvent = useCallback((payload: ChangeEventPayload): ChangeEventWithActor => {
    return {
      id: payload.id,
      org_id: payload.orgId,
      source_type: payload.sourceType,
      source_name: payload.sourceName,
      change_type: payload.type,
      entity_type: payload.entityType,
      entity_id: payload.entityId,
      entity_title: payload.entityTitle,
      severity: payload.severity,
      requires_review: payload.requiresReview,
      title: payload.title,
      description: payload.description,
      actor_type: 'user',
      reconciliation_status: 'none',
      sync_status: payload.syncStatus,
      detected_at: payload.timestamp.toISOString(),
      created_at: payload.timestamp.toISOString(),
      actor_full_name: payload.actorName,
    };
  }, []);

  // Subscribe to real-time events
  useEffect(() => {
    if (!realtime) return;

    const unsubscribe = ChangeEventBus.onAll((payload: ChangeEventPayload) => {
      if (!matchesFilters(payload)) return;

      if (isPausedRef.current) {
        setNewEventCount((prev) => prev + 1);
      } else {
        const newEvent = payloadToEvent(payload);
        setEvents((prev) => [newEvent, ...prev].slice(0, maxEvents));
      }
    });

    return unsubscribe;
  }, [realtime, matchesFilters, payloadToEvent, maxEvents]);

  // Initial fetch and auto-refresh
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setIsLoading(true);
        // Build query params
        const params = new URLSearchParams({
          orgId,
          limit: String(maxEvents),
        });

        if (entityTypes.length > 0) {
          params.set('entityTypes', entityTypes.join(','));
        }
        if (sourceTypes.length > 0) {
          params.set('sourceTypes', sourceTypes.join(','));
        }
        if (minSeverity !== 'info') {
          params.set('minSeverity', minSeverity);
        }

        const response = await fetch(`/api/changes?${params}`);
        if (!response.ok) {
          throw new Error('Failed to fetch changes');
        }

        const data = await response.json();
        setEvents(data.events || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();

    // Set up auto-refresh interval
    if (autoRefresh && refreshInterval > 0) {
      const intervalId = setInterval(() => {
        if (!isPausedRef.current) {
          fetchEvents();
        }
      }, refreshInterval);

      return () => clearInterval(intervalId);
    }
  }, [orgId, entityTypes, sourceTypes, minSeverity, maxEvents, autoRefresh, refreshInterval]);

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
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        orgId,
        limit: String(maxEvents),
      });

      const response = await fetch(`/api/changes?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch changes');
      }

      const data = await response.json();
      setEvents(data.events || []);
      setNewEventCount(0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [orgId, maxEvents]);

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
  };
}

/**
 * Hook for subscribing to Supabase realtime changes
 * @param supabase - Supabase client instance
 * @param orgId - Organization ID to subscribe to
 */
export function useChangeSubscription(
  supabase: any, // SupabaseClient type
  orgId: string
) {
  useEffect(() => {
    if (!supabase || !orgId) return;

    const channel = supabase
      .channel(`change-events-${orgId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'change_events',
          filter: `org_id=eq.${orgId}`,
        },
        (payload: any) => {
          const event = payload.new;
          ChangeEventBus.emit({
            type: event.entity_type,
            orgId: event.org_id,
            severity: event.severity as ChangeSeverity,
            title: event.title,
            description: event.description,
            entityType: event.entity_type,
            entityId: event.entity_id,
            entityTitle: event.entity_title,
            sourceType: event.source_type,
            sourceName: event.source_name,
            requiresReview: event.requires_review,
            syncStatus: event.sync_status,
            actorName: event.actor_name,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, orgId]);
}
