'use client';

/**
 * DeferredChangeTicker - Lazy-loaded change feed ticker
 * 
 * This component encapsulates the change feed subscription logic
 * and is dynamically imported to avoid blocking initial page load.
 * The realtime subscription starts only after this component mounts.
 */

import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';
import { ChangeTickerPopover } from '@crm-eco/ui/components/change-ticker';
import { useChangeFeed, useChangeSubscription } from '@crm-eco/shared/changes';

interface DeferredChangeTickerProps {
  orgId: string;
}

export function DeferredChangeTicker({ orgId }: DeferredChangeTickerProps) {
  const router = useRouter();

  // Change feed for ticker - scoped to high-value entity types only
  const changeFeed = useChangeFeed({
    orgId,
    entityTypes: ['deal', 'task', 'lead'],
    minSeverity: 'medium',
    maxEvents: 10,
    realtime: true,
    autoRefresh: false,
  });

  // Subscribe to Supabase realtime for change events
  useChangeSubscription(supabase, orgId);

  // Convert change feed events to ticker format
  const tickerEvents = changeFeed.events.map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description || undefined,
    severity: event.severity,
    entityType: event.entity_type,
    entityTitle: event.entity_title || undefined,
    actorName: event.actor_full_name || undefined,
    sourceName: event.source_name || undefined,
    sourceType: event.source_type,
    requiresReview: event.requires_review,
    syncStatus: event.sync_status,
    createdAt: event.created_at,
  }));

  return (
    <ChangeTickerPopover
      events={tickerEvents}
      isPaused={changeFeed.isPaused}
      newEventCount={changeFeed.newEventCount}
      isLoading={changeFeed.isLoading}
      syncStatus={tickerEvents.length === 0 ? 'synced' : 'pending'}
      showSyncStatus={true}
      onPause={changeFeed.pause}
      onResume={changeFeed.resume}
      onClear={changeFeed.clear}
      onRefresh={changeFeed.refresh}
      onEventClick={(event) => {
        if (event.entityType === 'record' || event.entityType === 'lead' || event.entityType === 'member') {
          router.push(`/crm/records/${event.entityType}s`);
        } else if (event.entityType === 'enrollment') {
          router.push('/enrollments');
        } else if (event.entityType === 'deal') {
          router.push('/crm/deals');
        }
      }}
    />
  );
}
