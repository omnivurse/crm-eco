'use client';

import { Button } from '@crm-eco/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  Phone,
  Mail,
  CheckSquare,
  MoreHorizontal,
  Eye,
  Pencil,
  MessageSquare,
  Calendar,
  Trash2,
} from 'lucide-react';

interface RowQuickActionsProps {
  recordId: string;
  email?: string | null;
  phone?: string | null;
  onView: () => void;
  onEdit: () => void;
  onCall?: () => void;
  onEmail?: () => void;
  onAddTask?: () => void;
  onAddNote?: () => void;
  onScheduleMeeting?: () => void;
  onDelete?: () => void;
  className?: string;
}

export function RowQuickActions({
  recordId,
  email,
  phone,
  onView,
  onEdit,
  onCall,
  onEmail,
  onAddTask,
  onAddNote,
  onScheduleMeeting,
  onDelete,
  className,
}: RowQuickActionsProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity',
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Call - only if phone exists */}
      {phone && onCall && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onCall}
          className="h-7 w-7 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:text-emerald-400 dark:hover:bg-emerald-500/10"
          title="Call"
        >
          <Phone className="w-3.5 h-3.5" />
        </Button>
      )}

      {/* Email - only if email exists */}
      {email && onEmail && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onEmail}
          className="h-7 w-7 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-500/10"
          title="Send Email"
        >
          <Mail className="w-3.5 h-3.5" />
        </Button>
      )}

      {/* Add Task */}
      {onAddTask && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onAddTask}
          className="h-7 w-7 text-slate-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:text-violet-400 dark:hover:bg-violet-500/10"
          title="Add Task"
        >
          <CheckSquare className="w-3.5 h-3.5" />
        </Button>
      )}

      {/* More Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-44 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10"
        >
          <DropdownMenuItem
            onClick={onView}
            className="cursor-pointer text-slate-700 dark:text-slate-300"
          >
            <Eye className="w-4 h-4 mr-2" />
            View Details
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onEdit}
            className="cursor-pointer text-slate-700 dark:text-slate-300"
          >
            <Pencil className="w-4 h-4 mr-2" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-slate-200 dark:bg-white/10" />
          
          {onAddNote && (
            <DropdownMenuItem
              onClick={onAddNote}
              className="cursor-pointer text-slate-700 dark:text-slate-300"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Add Note
            </DropdownMenuItem>
          )}
          
          {onScheduleMeeting && (
            <DropdownMenuItem
              onClick={onScheduleMeeting}
              className="cursor-pointer text-slate-700 dark:text-slate-300"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Schedule Meeting
            </DropdownMenuItem>
          )}

          {onDelete && (
            <>
              <DropdownMenuSeparator className="bg-slate-200 dark:bg-white/10" />
              <DropdownMenuItem
                onClick={onDelete}
                className="cursor-pointer text-red-600 dark:text-red-400 focus:text-red-700 focus:bg-red-50 dark:focus:bg-red-500/10"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
