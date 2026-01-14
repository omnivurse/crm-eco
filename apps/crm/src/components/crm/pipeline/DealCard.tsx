'use client';

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
} from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import type { CrmRecord } from '@/lib/crm/types';

interface DealCardProps {
  deal: CrmRecord;
  isDragging?: boolean;
  isUpdating?: boolean;
}

export function DealCard({ deal, isDragging, isUpdating }: DealCardProps) {
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
          <button className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white opacity-0 group-hover:opacity-100 transition-all">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="space-y-2">
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
      </div>
    </div>
  );

  return content;
}
