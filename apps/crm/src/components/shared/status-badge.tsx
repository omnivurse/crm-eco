import { StatusBadge as ToneStatusBadge } from '@crm-eco/ui/components/status-badge';
import { cn } from '@crm-eco/ui';

/**
 * Entity status badges.
 *
 * These used to hardcode pastel `bg-*-100 text-*-700 border-*-200` classes,
 * which were too washed-out to read on the contacts / leads lists. They now
 * delegate to the shared, token-driven <StatusBadge> (one hue = one meaning,
 * high-contrast, theme-aware) so every status pill across the suite matches and
 * stays legible. `entityType` is retained for API compatibility; the canonical
 * status -> tone map (see `@crm-eco/ui`) is entity-agnostic on purpose.
 */
type EntityType = 'member' | 'advisor' | 'ticket' | 'need' | 'lead';

interface StatusBadgeProps {
  status: string;
  entityType: EntityType;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const displayText = status.replace(/_/g, ' ');
  return (
    <ToneStatusBadge
      status={status}
      label={displayText}
      className={cn('capitalize', className)}
    />
  );
}

// Convenience exports for specific entity types
export function MemberStatusBadge({ status, className }: { status: string; className?: string }) {
  return <StatusBadge status={status} entityType="member" className={className} />;
}

export function AdvisorStatusBadge({ status, className }: { status: string; className?: string }) {
  return <StatusBadge status={status} entityType="advisor" className={className} />;
}

export function TicketStatusBadge({ status, className }: { status: string; className?: string }) {
  return <StatusBadge status={status} entityType="ticket" className={className} />;
}

export function NeedStatusBadge({ status, className }: { status: string; className?: string }) {
  return <StatusBadge status={status} entityType="need" className={className} />;
}

export function LeadStatusBadge({ status, className }: { status: string; className?: string }) {
  return <StatusBadge status={status} entityType="lead" className={className} />;
}
