import { Badge } from '@crm-eco/ui';
import {
  CheckCircle,
  Clock,
  FileText,
  WarningCircle,
  XCircle,
  CircleNotch,
  Question,
} from '@phosphor-icons/react/dist/ssr';

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
  active: {
    className: 'bg-green-100 text-green-800 border-green-200',
    icon: <CheckCircle weight="light" className="w-3 h-3" aria-hidden />,
    label: 'Active',
  },
  paid: {
    className: 'bg-green-100 text-green-800 border-green-200',
    icon: <CheckCircle weight="light" className="w-3 h-3" aria-hidden />,
    label: 'Paid',
  },
  resolved: {
    className: 'bg-green-100 text-green-800 border-green-200',
    icon: <CheckCircle weight="light" className="w-3 h-3" aria-hidden />,
    label: 'Resolved',
  },
  closed: {
    className: 'bg-slate-100 text-slate-600 border-slate-200',
    icon: <CheckCircle weight="light" className="w-3 h-3" aria-hidden />,
    label: 'Closed',
  },
  pending: {
    className: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: <Clock weight="light" className="w-3 h-3" aria-hidden />,
    label: 'Pending',
  },
  in_progress: {
    className: 'bg-[rgba(11,109,133,0.1)] text-[var(--mp-teal)] border-[rgba(11,109,133,0.15)]',
    icon: <CircleNotch weight="light" className="w-3 h-3" aria-hidden />,
    label: 'In Progress',
  },
  in_review: {
    className: 'bg-[rgba(11,109,133,0.1)] text-[var(--mp-teal)] border-[rgba(11,109,133,0.15)]',
    icon: <Clock weight="light" className="w-3 h-3" aria-hidden />,
    label: 'In Review',
  },
  processing: {
    className: 'bg-[rgba(11,109,133,0.1)] text-[var(--mp-teal)] border-[rgba(11,109,133,0.15)]',
    icon: <CircleNotch weight="light" className="w-3 h-3" aria-hidden />,
    label: 'Processing',
  },
  submitted: {
    className: 'bg-[rgba(11,109,133,0.1)] text-[var(--mp-teal)] border-[rgba(11,109,133,0.15)]',
    icon: <Clock weight="light" className="w-3 h-3" aria-hidden />,
    label: 'Submitted',
  },
  draft: {
    className: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: <FileText weight="light" className="w-3 h-3" aria-hidden />,
    label: 'Draft',
  },
  open: {
    className: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: <WarningCircle weight="light" className="w-3 h-3" aria-hidden />,
    label: 'Open',
  },
  waiting: {
    className: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: <Question weight="light" className="w-3 h-3" aria-hidden />,
    label: 'Waiting',
  },
  terminated: {
    className: 'bg-red-100 text-red-800 border-red-200',
    icon: <XCircle weight="light" className="w-3 h-3" aria-hidden />,
    label: 'Terminated',
  },
  cancelled: {
    className: 'bg-red-100 text-red-800 border-red-200',
    icon: <XCircle weight="light" className="w-3 h-3" aria-hidden />,
    label: 'Cancelled',
  },
  paused: {
    className: 'bg-slate-100 text-slate-600 border-slate-200',
    icon: <Clock weight="light" className="w-3 h-3" aria-hidden />,
    label: 'Paused',
  },
};

export function StatusBadge({ status, showIcon = true }: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase().replace(/\s+/g, '_');
  const config = statusConfig[normalizedStatus] || {
    className: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: <Question weight="light" className="w-3 h-3" aria-hidden />,
    label: status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' '),
  };

  return (
    <Badge className={`${config.className} border font-medium`}>
      {showIcon && <span className="mr-1">{config.icon}</span>}
      {config.label}
    </Badge>
  );
}
