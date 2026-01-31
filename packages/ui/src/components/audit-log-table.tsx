'use client';

import * as React from 'react';
import { useRef, memo, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '../lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from './avatar';
import { RiskLevelBadge, type RiskLevel } from './risk-level-badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip';
import {
  User,
  Clock,
  Activity,
  ExternalLink,
  ChevronRight,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

export interface AuditLogEntry {
  id: string;
  sequence_number?: number;
  organization_id: string;
  app_source: 'crm' | 'admin' | 'portal' | 'system';
  actor_id: string | null;
  actor_role: string | null;
  actor_email: string | null;
  actor_name?: string | null;
  actor_avatar_url?: string | null;
  target_user_id: string | null;
  target_entity_type: string | null;
  target_entity_id: string | null;
  action: string;
  action_category: string;
  description: string | null;
  risk_level: RiskLevel;
  ip_address: string | null;
  user_agent: string | null;
  details: Record<string, unknown>;
  changes: Record<string, unknown>;
  created_at: string;
}

export interface AuditLogTableProps {
  logs: AuditLogEntry[];
  isLoading?: boolean;
  onRowClick?: (log: AuditLogEntry) => void;
  className?: string;
  emptyMessage?: string;
}

const ROW_HEIGHT = 64;

function getInitials(name: string | null | undefined, email: string | null | undefined): string {
  if (name) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return 'SY';
}

function formatActionLabel(action: string): string {
  return action
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getActionIcon(actionCategory: string) {
  switch (actionCategory) {
    case 'authentication':
      return <User className="w-4 h-4" />;
    case 'data_modification':
    case 'data_deletion':
      return <FileText className="w-4 h-4" />;
    case 'data_export':
      return <ExternalLink className="w-4 h-4" />;
    default:
      return <Activity className="w-4 h-4" />;
  }
}

function getRoleColor(role: string | null): string {
  if (!role) return 'text-slate-500';

  if (role.includes('admin') || role === 'owner') {
    return 'text-amber-600 dark:text-amber-400';
  }
  if (role.includes('manager')) {
    return 'text-teal-600 dark:text-teal-400';
  }
  return 'text-slate-600 dark:text-slate-400';
}

const AuditLogRow = memo(function AuditLogRow({
  log,
  onClick,
  style,
}: {
  log: AuditLogEntry;
  onClick?: (log: AuditLogEntry) => void;
  style?: React.CSSProperties;
}) {
  const timeAgo = useMemo(
    () => formatDistanceToNow(new Date(log.created_at), { addSuffix: true }),
    [log.created_at]
  );

  const fullTime = useMemo(
    () => format(new Date(log.created_at), 'PPpp'),
    [log.created_at]
  );

  const actorDisplay = log.actor_name || log.actor_email || 'System';

  return (
    <div
      style={style}
      onClick={() => onClick?.(log)}
      className={cn(
        'flex items-center gap-4 px-4 border-b border-slate-100 dark:border-white/5',
        onClick && 'cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5'
      )}
    >
      {/* Actor Avatar */}
      <Avatar className="w-9 h-9 flex-shrink-0">
        <AvatarImage src={log.actor_avatar_url || undefined} alt={actorDisplay} />
        <AvatarFallback className="bg-gradient-to-br from-teal-500 to-emerald-500 text-white text-xs font-medium">
          {getInitials(log.actor_name, log.actor_email)}
        </AvatarFallback>
      </Avatar>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900 dark:text-white truncate">
            {actorDisplay}
          </span>
          {log.actor_role && (
            <span className={cn('text-xs font-medium', getRoleColor(log.actor_role))}>
              {log.actor_role.replace('crm_', '').replace('_', ' ')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-sm text-slate-600 dark:text-slate-400">
            {log.description || formatActionLabel(log.action)}
          </span>
          {log.target_entity_type && (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              ({log.target_entity_type})
            </span>
          )}
        </div>
      </div>

      {/* Action Badge */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
          {getActionIcon(log.action_category)}
          <span className="text-xs font-medium">{formatActionLabel(log.action)}</span>
        </div>
      </div>

      {/* Risk Level */}
      <div className="flex-shrink-0">
        <RiskLevelBadge level={log.risk_level} size="sm" />
      </div>

      {/* Timestamp */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 flex-shrink-0 w-24">
              <Clock className="w-3 h-3" />
              <span className="truncate">{timeAgo}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>{fullTime}</p>
            {log.ip_address && <p className="text-xs opacity-70">IP: {log.ip_address}</p>}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Chevron */}
      {onClick && (
        <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
      )}
    </div>
  );
});

export const AuditLogTable = memo(function AuditLogTable({
  logs,
  isLoading,
  onRowClick,
  className,
  emptyMessage = 'No audit logs found',
}: AuditLogTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  if (isLoading) {
    return (
      <div
        className={cn(
          'rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50',
          className
        )}
      >
        {/* Header Skeleton */}
        <div className="flex items-center gap-4 px-4 py-3 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900">
          <div className="w-20 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="flex-1" />
          <div className="w-24 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="w-16 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="w-20 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        </div>
        {/* Row Skeletons */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-4 border-b border-slate-100 dark:border-white/5"
          >
            <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="w-32 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              <div className="w-48 h-3 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
            </div>
            <div className="w-24 h-6 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="w-16 h-5 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="w-20 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-16 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50',
          className
        )}
      >
        <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
          <AlertCircle className="w-8 h-8 text-slate-400" />
        </div>
        <p className="text-slate-600 dark:text-slate-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50 overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900">
        <div className="w-9" /> {/* Avatar spacer */}
        <div className="flex-1 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          User
        </div>
        <div className="w-32 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Action
        </div>
        <div className="w-20 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Risk
        </div>
        <div className="w-24 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Time
        </div>
        {onRowClick && <div className="w-4" />}
      </div>

      {/* Virtual Scrolling Container */}
      <div
        ref={containerRef}
        className="overflow-auto"
        style={{ height: Math.min(logs.length * ROW_HEIGHT, 600) }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const log = logs[virtualRow.index];
            return (
              <AuditLogRow
                key={log.id}
                log={log}
                onClick={onRowClick}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {logs.length.toLocaleString()} log{logs.length !== 1 ? 's' : ''}
        </span>
        {logs[0]?.sequence_number && (
          <span className="text-xs text-slate-400 dark:text-slate-500">
            Hash chain verified
          </span>
        )}
      </div>
    </div>
  );
});
