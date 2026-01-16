'use client';

import { Badge } from '@crm-eco/ui';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import type { ApprovalStatus } from '@/lib/approvals/types';

interface ApprovalBadgeProps {
  status: ApprovalStatus;
  size?: 'sm' | 'default';
  showIcon?: boolean;
}

export function ApprovalBadge({ status, size = 'default', showIcon = true }: ApprovalBadgeProps) {
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

  switch (status) {
    case 'pending':
      return (
        <Badge variant="outline" className={`text-yellow-600 border-yellow-600 ${size === 'sm' ? 'text-xs' : ''}`}>
          {showIcon && <Clock className={`${iconSize} mr-1`} />}
          Pending
        </Badge>
      );
    case 'approved':
      return (
        <Badge variant="outline" className={`text-green-600 border-green-600 ${size === 'sm' ? 'text-xs' : ''}`}>
          {showIcon && <CheckCircle2 className={`${iconSize} mr-1`} />}
          Approved
        </Badge>
      );
    case 'rejected':
      return (
        <Badge variant="outline" className={`text-red-600 border-red-600 ${size === 'sm' ? 'text-xs' : ''}`}>
          {showIcon && <XCircle className={`${iconSize} mr-1`} />}
          Rejected
        </Badge>
      );
    case 'changes_requested':
      return (
        <Badge variant="outline" className={`text-orange-600 border-orange-600 ${size === 'sm' ? 'text-xs' : ''}`}>
          {showIcon && <AlertCircle className={`${iconSize} mr-1`} />}
          Changes Requested
        </Badge>
      );
    case 'cancelled':
      return (
        <Badge variant="secondary" className={size === 'sm' ? 'text-xs' : ''}>
          Cancelled
        </Badge>
      );
    case 'expired':
      return (
        <Badge variant="secondary" className={size === 'sm' ? 'text-xs' : ''}>
          Expired
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className={size === 'sm' ? 'text-xs' : ''}>
          {status}
        </Badge>
      );
  }
}

export default ApprovalBadge;
