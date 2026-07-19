import { Badge } from '@crm-eco/ui';
import {
  CheckCircle,
  Clock,
  FileText,
  XCircle,
  CircleNotch,
  WarningCircle,
  CurrencyDollar,
  ClipboardText,
  PaperPlaneTilt,
  Prohibit,
} from '@phosphor-icons/react/dist/ssr';

// Status mapping to member-friendly labels and styling
// Expanded for granular workflow states
const statusConfig: Record<string, {
  label: string;
  className: string;
  icon: React.ReactNode;
}> = {
  // Active/Open statuses
  new: {
    label: 'New',
    className: 'bg-[rgba(11,109,133,0.1)] text-[var(--mp-teal)] border-[rgba(11,109,133,0.15)]',
    icon: <FileText weight="light" className="w-3 h-3" aria-hidden />,
  },
  open: {
    label: 'New',
    className: 'bg-[rgba(11,109,133,0.1)] text-[var(--mp-teal)] border-[rgba(11,109,133,0.15)]',
    icon: <FileText weight="light" className="w-3 h-3" aria-hidden />,
  },
  submitted: {
    label: 'Submitted',
    className: 'bg-[rgba(11,109,133,0.1)] text-[var(--mp-teal)] border-[rgba(11,109,133,0.15)]',
    icon: <PaperPlaneTilt weight="light" className="w-3 h-3" aria-hidden />,
  },
  intake: {
    label: 'Intake',
    className: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    icon: <ClipboardText weight="light" className="w-3 h-3" aria-hidden />,
  },
  awaiting_member_docs: {
    label: 'Waiting on You',
    className: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: <WarningCircle weight="light" className="w-3 h-3" aria-hidden />,
  },
  awaiting_provider_docs: {
    label: 'Waiting on Provider',
    className: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: <Clock weight="light" className="w-3 h-3" aria-hidden />,
  },
  awaiting_docs: {
    label: 'Waiting on Documents',
    className: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: <WarningCircle weight="light" className="w-3 h-3" aria-hidden />,
  },
  in_review: {
    label: 'In Review',
    className: 'bg-purple-100 text-purple-800 border-purple-200',
    icon: <Clock weight="light" className="w-3 h-3" aria-hidden />,
  },
  pricing: {
    label: 'Pricing',
    className: 'bg-violet-100 text-violet-700 border-violet-200',
    icon: <CurrencyDollar weight="light" className="w-3 h-3" aria-hidden />,
  },
  approved: {
    label: 'Approved',
    className: 'bg-green-100 text-green-800 border-green-200',
    icon: <CheckCircle weight="light" className="w-3 h-3" aria-hidden />,
  },
  reimbursement_pending: {
    label: 'Reimbursement Pending',
    className: 'bg-teal-100 text-teal-700 border-teal-200',
    icon: <CurrencyDollar weight="light" className="w-3 h-3" aria-hidden />,
  },
  processing: {
    label: 'Processing',
    className: 'bg-purple-100 text-purple-800 border-purple-200',
    icon: <CircleNotch weight="light" className="w-3 h-3" aria-hidden />,
  },
  // Terminal statuses
  paid: {
    label: 'Paid / Shared',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    icon: <CheckCircle weight="light" className="w-3 h-3" aria-hidden />,
  },
  closed: {
    label: 'Closed',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
    icon: <CheckCircle weight="light" className="w-3 h-3" aria-hidden />,
  },
  denied: {
    label: 'Not Approved',
    className: 'bg-red-100 text-red-800 border-red-200',
    icon: <XCircle weight="light" className="w-3 h-3" aria-hidden />,
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-slate-100 text-slate-500 border-slate-200',
    icon: <Prohibit weight="light" className="w-3 h-3" aria-hidden />,
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
    icon: <FileText weight="light" className="w-3 h-3" aria-hidden />,
  };

  return (
    <Badge className={`${config.className} border font-medium`}>
      {showIcon && <span className="mr-1">{config.icon}</span>}
      {config.label}
    </Badge>
  );
}
