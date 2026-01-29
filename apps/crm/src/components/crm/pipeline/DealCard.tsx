'use client';

import { memo } from 'react';
import { useRouter } from 'next/navigation';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';
import {
  DollarSign,
  MoreHorizontal,
  Calendar,
  User,
  GripVertical,
  Loader2,
  Phone,
  Mail,
  CheckSquare,
  Eye,
  Pencil,
  Trash2,
  Tag,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import { cn } from '@crm-eco/ui/lib/utils';
import type { CrmRecord } from '@/lib/crm/types';

interface DealCardProps {
  deal: CrmRecord;
  isDragging?: boolean;
  isUpdating?: boolean;
  onQuickAction?: (action: 'call' | 'email' | 'task' | 'view' | 'edit' | 'delete', dealId: string) => void;
  displayFields?: string[]; // Customizable fields to display on card
}

export const DealCard = memo(function DealCard({ deal, isDragging, isUpdating, onQuickAction, displayFields }: DealCardProps) {
  const router = useRouter();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: deal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const amount = Number(deal.data?.amount) || 0;
  const probability = Number(deal.data?.probability) || 0;
  const expectedClose = deal.data?.expected_close_date as string | undefined;
  const priority = deal.data?.priority as string | undefined;
  const contactPhone = deal.data?.contact_phone || deal.phone;
  const contactEmail = deal.data?.contact_email || deal.email;

  const handleQuickAction = (action: 'call' | 'email' | 'task' | 'view' | 'edit' | 'delete', e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onQuickAction) {
      onQuickAction(action, deal.id);
    } else {
      // Default behaviors
      if (action === 'call' && contactPhone) {
        window.location.href = `tel:${contactPhone}`;
      } else if (action === 'email' && contactEmail) {
        window.location.href = `mailto:${contactEmail}`;
      } else if (action === 'view') {
        router.push(`/crm/r/${deal.id}`);
      } else if (action === 'edit') {
        router.push(`/crm/r/${deal.id}?edit=true`);
      }
    }
  };

  const content = (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'block p-4 glass-card rounded-xl border border-slate-200 dark:border-white/10 transition-all cursor-grab group',
        'hover:border-teal-500/30 hover:scale-[1.02]',
        (isDragging || isSortableDragging) && 'opacity-50 scale-105 shadow-xl border-teal-500/50',
        isUpdating && 'opacity-70'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="p-1 -ml-1 mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="w-4 h-4" />
        </div>

        <Link
          href={`/crm/r/${deal.id}`}
          className="flex-1 min-w-0"
          onClick={(e) => {
            if (isDragging || isSortableDragging) {
              e.preventDefault();
            }
          }}
        >
          <h4 className="text-slate-900 dark:text-white font-medium text-sm group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors line-clamp-2">
            {deal.title || String(deal.data?.deal_name || 'Untitled Deal')}
          </h4>
        </Link>

        {isUpdating ? (
          <Loader2 className="w-4 h-4 text-teal-500 animate-spin" />
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white opacity-0 group-hover:opacity-100 transition-all">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
              <DropdownMenuItem onClick={(e) => handleQuickAction('view', e)} className="cursor-pointer">
                <Eye className="w-4 h-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => handleQuickAction('edit', e)} className="cursor-pointer">
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => handleQuickAction('delete', e)}
                className="text-red-600 dark:text-red-400 cursor-pointer"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="space-y-2">
        {/* Priority Badge */}
        {priority && (
          <Badge
            variant="secondary"
            className={cn(
              'text-xs',
              priority === 'high' && 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
              priority === 'medium' && 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
              priority === 'low' && 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
            )}
          >
            {priority.charAt(0).toUpperCase() + priority.slice(1)} Priority
          </Badge>
        )}

        {amount > 0 && (
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-lg font-bold text-slate-900 dark:text-white">
              ${amount.toLocaleString()}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between text-xs">
          {probability > 0 && (
            <span className="text-slate-500 dark:text-slate-400">
              {probability}% likely
            </span>
          )}
          {expectedClose && (
            <span className="flex items-center gap-1 text-slate-500">
              <Calendar className="w-3 h-3" />
              {new Date(expectedClose).toLocaleDateString()}
            </span>
          )}
        </div>

        {deal.owner_id && (
          <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200 dark:border-white/5">
            <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
              <User className="w-3 h-3 text-slate-500 dark:text-slate-400" />
            </div>
            <span className="text-xs text-slate-500">Assigned</span>
          </div>
        )}

        {/* Quick Actions Bar */}
        <div className="flex items-center gap-1 pt-2 border-t border-slate-200 dark:border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
          {contactPhone && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => handleQuickAction('call', e)}
              className="h-7 w-7 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:text-emerald-400 dark:hover:bg-emerald-500/10"
              title="Call"
            >
              <Phone className="w-3.5 h-3.5" />
            </Button>
          )}
          {contactEmail && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => handleQuickAction('email', e)}
              className="h-7 w-7 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-500/10"
              title="Send Email"
            >
              <Mail className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => handleQuickAction('task', e)}
            className="h-7 w-7 text-slate-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:text-violet-400 dark:hover:bg-violet-500/10"
            title="Add Task"
          >
            <CheckSquare className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );

  return content;
});
