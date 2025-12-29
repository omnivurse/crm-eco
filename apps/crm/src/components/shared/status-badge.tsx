import { Badge } from '@crm-eco/ui';
import { cn } from '@crm-eco/ui';

// Member status colors
const memberStatusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  prospect: 'bg-blue-100 text-blue-700 border-blue-200',
  paused: 'bg-slate-100 text-slate-600 border-slate-200',
  inactive: 'bg-slate-100 text-slate-500 border-slate-200',
  terminated: 'bg-red-100 text-red-700 border-red-200',
};

// Advisor status colors
const advisorStatusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  paused: 'bg-slate-100 text-slate-600 border-slate-200',
  inactive: 'bg-slate-100 text-slate-500 border-slate-200',
  terminated: 'bg-red-100 text-red-700 border-red-200',
};

// Ticket status colors
const ticketStatusColors: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700 border-blue-200',
  in_progress: 'bg-amber-100 text-amber-700 border-amber-200',
  waiting: 'bg-slate-100 text-slate-600 border-slate-200',
  resolved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  closed: 'bg-slate-100 text-slate-500 border-slate-200',
};

// Need status colors
const needStatusColors: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700 border-blue-200',
  in_review: 'bg-amber-100 text-amber-700 border-amber-200',
  processing: 'bg-purple-100 text-purple-700 border-purple-200',
  paid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  closed: 'bg-slate-100 text-slate-500 border-slate-200',
};

// Lead status colors
const leadStatusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700 border-blue-200',
  contacted: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  working: 'bg-amber-100 text-amber-700 border-amber-200',
  qualified: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  unqualified: 'bg-slate-100 text-slate-500 border-slate-200',
  converted: 'bg-green-100 text-green-700 border-green-200',
  lost: 'bg-red-100 text-red-700 border-red-200',
};

type EntityType = 'member' | 'advisor' | 'ticket' | 'need' | 'lead';

const colorMaps: Record<EntityType, Record<string, string>> = {
  member: memberStatusColors,
  advisor: advisorStatusColors,
  ticket: ticketStatusColors,
  need: needStatusColors,
  lead: leadStatusColors,
};

interface StatusBadgeProps {
  status: string;
  entityType: EntityType;
  className?: string;
}

export function StatusBadge({ status, entityType, className }: StatusBadgeProps) {
  const colors = colorMaps[entityType];
  const colorClass = colors[status] || 'bg-slate-100 text-slate-600 border-slate-200';
  
  // Format display text
  const displayText = status.replace(/_/g, ' ');
  
  return (
    <Badge 
      variant="outline" 
      className={cn(colorClass, 'capitalize', className)}
    >
      {displayText}
    </Badge>
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

