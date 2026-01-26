'use client';

/**
 * Change Intelligence System - ChangeTicker Component
 * Real-time scrolling ticker for displaying system changes
 */

import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Pause, Play, X, RefreshCw, ChevronDown, ChevronUp, Bell } from 'lucide-react';
import { cn } from '../lib/utils';

// Types
export type ChangeSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type SyncStatus = 'synced' | 'pending' | 'conflict' | 'stale';

export interface ChangeTickerEvent {
  id: string;
  title: string;
  description?: string;
  severity: ChangeSeverity;
  entityType: string;
  entityTitle?: string;
  actorName?: string;
  sourceName?: string;
  sourceType: string;
  requiresReview?: boolean;
  syncStatus?: SyncStatus;
  createdAt: string;
}

export interface ChangeTickerProps {
  events: ChangeTickerEvent[];
  variant?: 'compact' | 'expanded';
  isPaused?: boolean;
  newEventCount?: number;
  isLoading?: boolean;
  syncStatus?: SyncStatus;
  showSyncStatus?: boolean;
  onPause?: () => void;
  onResume?: () => void;
  onClear?: () => void;
  onRefresh?: () => void;
  onEventClick?: (event: ChangeTickerEvent) => void;
  className?: string;
}

// Severity indicators
const SEVERITY_INDICATORS: Record<ChangeSeverity, string> = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🟢',
  info: '🔵',
};

const SEVERITY_COLORS: Record<ChangeSeverity, string> = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-yellow-400',
  low: 'text-green-400',
  info: 'text-blue-400',
};

const SYNC_STATUS_CONFIG: Record<SyncStatus, { label: string; color: string; dotColor: string }> = {
  synced: { label: 'Synced', color: 'text-green-400', dotColor: 'bg-green-400' },
  pending: { label: 'Syncing...', color: 'text-yellow-400', dotColor: 'bg-yellow-400' },
  conflict: { label: 'Conflict', color: 'text-red-400', dotColor: 'bg-red-400' },
  stale: { label: 'Stale', color: 'text-slate-400', dotColor: 'bg-slate-400' },
};

// Format relative time (returns empty string on first render to avoid hydration mismatch)
function formatRelativeTime(timestamp: string, isMounted: boolean): string {
  if (!isMounted) return '';

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 10) return 'just now';
  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

<<<<<<< HEAD
// Hook to track client-side mount for hydration-safe rendering
function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  return hydrated;
}

// Hydration-safe relative time component
function RelativeTime({ timestamp }: { timestamp: string }) {
  const hydrated = useHydrated();
  if (!hydrated) {
    // Return a placeholder during SSR/hydration to prevent mismatch
    return <span className="text-slate-500">...</span>;
  }
  return <span className="text-slate-500">{formatRelativeTime(timestamp)}</span>;
=======
// Hook to track if component is mounted (for hydration-safe rendering)
function useIsMounted() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);
  return isMounted;
>>>>>>> 0ad13e2d06862883557cc607c8522902ae07087a
}

/**
 * Compact Ticker - Horizontal scrolling ticker for headers
 */
export function ChangeTickerCompact({
  events,
  isPaused = false,
  syncStatus = 'synced',
  showSyncStatus = false,
  onPause,
  onResume,
  onEventClick,
  className,
}: ChangeTickerProps) {
  const tickerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const isMounted = useIsMounted();

  // Auto-pause on hover
  useEffect(() => {
    if (isHovered && !isPaused && onPause) {
      onPause();
    } else if (!isHovered && isPaused && onResume) {
      onResume();
    }
  }, [isHovered, isPaused, onPause, onResume]);

  const syncConfig = SYNC_STATUS_CONFIG[syncStatus];

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 rounded-lg border border-white/10',
        'backdrop-blur-sm',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Live indicator */}
      <span className="relative flex h-2 w-2 flex-shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
      </span>

      {/* Scrolling ticker content */}
      <div className="flex-1 overflow-hidden min-w-0">
        <div
          ref={tickerRef}
          className={cn(
            'flex gap-6 whitespace-nowrap',
            !isPaused && events.length > 0 && 'animate-ticker'
          )}
        >
          {events.length === 0 ? (
            <span className="text-xs text-slate-400">System synced - no recent changes</span>
          ) : (
            events.map((event) => (
              <button
                key={event.id}
                className="inline-flex items-center gap-1.5 text-xs hover:text-teal-400 transition-colors"
                onClick={() => onEventClick?.(event)}
              >
                <span>{SEVERITY_INDICATORS[event.severity]}</span>
                <span className="text-slate-300">{event.title}</span>
<<<<<<< HEAD
                <RelativeTime timestamp={event.createdAt} />
=======
                <span className="text-slate-500">{formatRelativeTime(event.createdAt, isMounted)}</span>
>>>>>>> 0ad13e2d06862883557cc607c8522902ae07087a
              </button>
            ))
          )}
        </div>
      </div>

      {/* Sync status badge */}
      {showSyncStatus && (
        <span className={cn('text-xs flex items-center gap-1 flex-shrink-0', syncConfig.color)}>
          <span className={cn('w-1.5 h-1.5 rounded-full', syncConfig.dotColor)} />
          {syncConfig.label}
        </span>
      )}
    </div>
  );
}

/**
 * Expanded Ticker - Vertical list with controls
 */
export function ChangeTickerExpanded({
  events,
  isPaused = false,
  newEventCount = 0,
  isLoading = false,
  syncStatus = 'synced',
  onPause,
  onResume,
  onClear,
  onRefresh,
  onEventClick,
  className,
}: ChangeTickerProps) {
  const isMounted = useIsMounted();
  const syncConfig = SYNC_STATUS_CONFIG[syncStatus];

  return (
    <div className={cn('bg-slate-900/90 rounded-lg border border-white/10 backdrop-blur-sm', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-sm font-medium text-white">Change Feed</span>
          {isPaused && (
            <span className="text-xs text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full">
              PAUSED
            </span>
          )}
          <span className={cn('text-xs flex items-center gap-1', syncConfig.color)}>
            <span className={cn('w-1.5 h-1.5 rounded-full', syncConfig.dotColor)} />
            {syncConfig.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isPaused ? (
            <button
              onClick={onResume}
              className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1"
            >
              <Play className="w-3 h-3" />
              Resume {newEventCount > 0 && `(${newEventCount})`}
            </button>
          ) : (
            <button
              onClick={onPause}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
            >
              <Pause className="w-3 h-3" />
              Pause
            </button>
          )}
          <button
            onClick={onRefresh}
            className={cn(
              'text-xs text-slate-400 hover:text-white',
              isLoading && 'animate-spin'
            )}
          >
            <RefreshCw className="w-3 h-3" />
          </button>
          <button onClick={onClear} className="text-xs text-slate-400 hover:text-white">
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Feed list */}
      <div className="max-h-96 overflow-y-auto">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <span className="text-3xl mb-2">✓</span>
            <span className="text-sm">All systems synced</span>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {events.map((event, index) => (
              <ChangeTickerItem
                key={event.id}
                event={event}
                isNew={index === 0 && !isPaused}
                isMounted={isMounted}
                onClick={() => onEventClick?.(event)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Individual change item in expanded view
 */
function ChangeTickerItem({
  event,
  isNew,
  isMounted,
  onClick,
}: {
  event: ChangeTickerEvent;
  isNew: boolean;
  isMounted: boolean;
  onClick?: () => void;
}) {
  const [isAnimating, setIsAnimating] = useState(isNew);

  useEffect(() => {
    if (isNew) {
      const timer = setTimeout(() => setIsAnimating(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [isNew]);

  return (
    <button
      className={cn(
        'flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer hover:bg-white/5 w-full text-left',
        isAnimating && 'animate-slide-in bg-teal-500/10'
      )}
      onClick={onClick}
    >
      <span className="text-lg flex-shrink-0">{SEVERITY_INDICATORS[event.severity]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{event.title}</p>
        <p className="text-xs text-slate-500">
          {event.actorName || event.sourceName || 'System'} •{' '}
          {formatRelativeTime(event.createdAt, isMounted)}
        </p>
      </div>
      {event.requiresReview && (
        <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded flex-shrink-0">
          Review
        </span>
      )}
    </button>
  );
}

/**
 * Main ChangeTicker component that switches between variants
 */
export function ChangeTicker(props: ChangeTickerProps) {
  const { variant = 'compact', ...rest } = props;

  if (variant === 'expanded') {
    return <ChangeTickerExpanded {...rest} />;
  }

  return <ChangeTickerCompact {...rest} />;
}

/**
 * Ticker Popover - Compact ticker with expandable popover
 */
export function ChangeTickerPopover({
  events,
  isPaused = false,
  newEventCount = 0,
  isLoading = false,
  syncStatus = 'synced',
  showSyncStatus = true,
  onPause,
  onResume,
  onClear,
  onRefresh,
  onEventClick,
  className,
}: ChangeTickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const criticalCount = events.filter((e) => e.severity === 'critical').length;
  const highCount = events.filter((e) => e.severity === 'high').length;
  const reviewCount = events.filter((e) => e.requiresReview).length;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors',
          'bg-slate-900/50 border-white/10 hover:border-white/20',
          isOpen && 'border-teal-500/50'
        )}
      >
        {/* Live indicator */}
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>

        {/* Summary */}
        <span className="text-xs text-slate-300">
          {events.length === 0 ? (
            'Synced'
          ) : (
            <>
              {criticalCount > 0 && <span className="text-red-400 mr-1">{criticalCount} critical</span>}
              {highCount > 0 && <span className="text-orange-400 mr-1">{highCount} high</span>}
              {reviewCount > 0 && <span className="text-amber-400">{reviewCount} review</span>}
              {criticalCount === 0 && highCount === 0 && reviewCount === 0 && (
                <span>{events.length} changes</span>
              )}
            </>
          )}
        </span>

        {/* Expand icon */}
        {isOpen ? (
          <ChevronUp className="w-3 h-3 text-slate-400" />
        ) : (
          <ChevronDown className="w-3 h-3 text-slate-400" />
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-96 z-50">
          <ChangeTickerExpanded
            events={events}
            isPaused={isPaused}
            newEventCount={newEventCount}
            isLoading={isLoading}
            syncStatus={syncStatus}
            onPause={onPause}
            onResume={onResume}
            onClear={onClear}
            onRefresh={onRefresh}
            onEventClick={(e) => {
              onEventClick?.(e);
              setIsOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

export default ChangeTicker;
