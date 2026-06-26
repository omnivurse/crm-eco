import { Badge } from '@crm-eco/ui';
import { CheckCircle, Clock, FileText, AlertCircle, XCircle, Loader2, HelpCircle } from 'lucide-react';

type StatusType = 
  | 'active' | 'paid' | 'resolved' | 'closed'
  | 'pending' | 'in_progress' | 'in_review' | 'processing' | 'submitted'
  | 'draft' | 'open' | 'waiting'
  | 'terminated' | 'cancelled' | 'paused';

interface StatusBadgeProps {
  status: string;
  showIcon?: boolean;
}

const statusConfig: Record<string, { 
  className: string; 
  icon: React.ReactNode; 
  label: string;
}> = {
  // Green - success/complete states
  active: {
    className: 'bg-green-100 text-green-800 border-green-200',
    icon: <CheckCircle className="w-3 h-3" />,
    label: 'Active',
  },
  paid: {
    className: 'bg-green-100 text-green-800 border-green-200',
    icon: <CheckCircle className="w-3 h-3" />,
    label: 'Paid',
  },
  resolved: {
    className: 'bg-green-100 text-green-800 border-green-200',
    icon: <CheckCircle className="w-3 h-3" />,
    label: 'Resolved',
  },
  closed: {
    className: 'bg-slate-100 text-slate-600 border-slate-200',
    icon: <CheckCircle className="w-3 h-3" />,
    label: 'Closed',
  },

  // Amber/Blue - in progress states
  pending: {
    className: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: <Clock className="w-3 h-3" />,
    label: 'Pending',
  },
  in_progress: {
    className: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: <Loader2 className="w-3 h-3" />,
    label: 'In Progress',
  },
  in_review: {
    className: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: <Clock className="w-3 h-3" />,
    label: 'In Review',
  },
  processing: {
    className: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: <Loader2 className="w-3 h-3" />,
    label: 'Processing',
  },
  submitted: {
    className: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: <Clock className="w-3 h-3" />,
    label: 'Submitted',
  },

  // Slate - neutral/waiting states
  draft: {
    className: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: <FileText className="w-3 h-3" />,
    label: 'Draft',
  },
  open: {
    className: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: <AlertCircle className="w-3 h-3" />,
    label: 'Open',
  },
  waiting: {
    className: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: <HelpCircle className="w-3 h-3" />,
    label: 'Waiting',
  },

  // Red - negative states
  terminated: {
    className: 'bg-red-100 text-red-800 border-red-200',
    icon: <XCircle className="w-3 h-3" />,
    label: 'Terminated',
  },
  cancelled: {
    className: 'bg-red-100 text-red-800 border-red-200',
    icon: <XCircle className="w-3 h-3" />,
    label: 'Cancelled',
  },
  paused: {
    className: 'bg-slate-100 text-slate-600 border-slate-200',
    icon: <Clock className="w-3 h-3" />,
    label: 'Paused',
  },
};

export function StatusBadge({ status, showIcon = true }: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase().replace(/\s+/g, '_');
  const config = statusConfig[normalizedStatus] || {
    className: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: <HelpCircle className="w-3 h-3" />,
    label: status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' '),
  };

  return (
    <Badge className={`${config.className} border font-medium`}>
      {showIcon && <span className="mr-1">{config.icon}</span>}
      {config.label}
    </Badge>
  );
}

