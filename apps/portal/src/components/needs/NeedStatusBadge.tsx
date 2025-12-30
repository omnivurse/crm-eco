import { Badge } from '@crm-eco/ui';
import { CheckCircle, Clock, FileText, XCircle, Loader2, AlertCircle } from 'lucide-react';

// Status mapping to member-friendly labels and styling
const statusConfig: Record<string, {
  label: string;
  className: string;
  icon: React.ReactNode;
}> = {
  open: {
    label: 'New',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: <FileText className="w-3 h-3" />,
  },
  in_review: {
    label: 'In Review',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: <Clock className="w-3 h-3" />,
  },
  processing: {
    label: 'Processing',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: <Loader2 className="w-3 h-3" />,
  },
  approved: {
    label: 'Approved',
    className: 'bg-green-100 text-green-800 border-green-200',
    icon: <CheckCircle className="w-3 h-3" />,
  },
  paid: {
    label: 'Paid / Shared',
    className: 'bg-green-100 text-green-800 border-green-200',
    icon: <CheckCircle className="w-3 h-3" />,
  },
  closed: {
    label: 'Closed',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
    icon: <CheckCircle className="w-3 h-3" />,
  },
  denied: {
    label: 'Not Approved',
    className: 'bg-red-100 text-red-800 border-red-200',
    icon: <XCircle className="w-3 h-3" />,
  },
  awaiting_docs: {
    label: 'Waiting on Documents',
    className: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: <AlertCircle className="w-3 h-3" />,
  },
};

interface NeedStatusBadgeProps {
  status: string;
  showIcon?: boolean;
}

export function NeedStatusBadge({ status, showIcon = true }: NeedStatusBadgeProps) {
  const config = statusConfig[status] || {
    label: status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' '),
    className: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: <FileText className="w-3 h-3" />,
  };

  return (
    <Badge className={`${config.className} border font-medium`}>
      {showIcon && <span className="mr-1">{config.icon}</span>}
      {config.label}
    </Badge>
  );
}

