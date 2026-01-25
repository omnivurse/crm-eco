import { useState } from 'react';
import {
  MoreVertical,
  Edit,
  Share2,
  Archive,
  Trash2,
  Copy,
  Link as LinkIcon,
  Tag,
  Clock,
  Eye,
  UserPlus,
  Mail,
  Download,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';

interface Ticket {
  id: string;
  subject: string;
  status: string;
  requester_id?: string;
  assignee_id?: string;
}

interface TicketActionsMenuProps {
  ticket: Ticket;
  onEdit?: () => void;
  onShare?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  onViewDetails?: () => void;
  onAddWatcher?: () => void;
  onAddTag?: () => void;
  onAddLink?: () => void;
  onLogTime?: () => void;
  onSendEmail?: () => void;
  onExport?: () => void;
  onDuplicate?: () => void;
}

export function TicketActionsMenu({
  ticket,
  onEdit,
  onShare,
  onArchive,
  onDelete,
  onViewDetails,
  onAddWatcher,
  onAddTag,
  onAddLink,
  onLogTime,
  onSendEmail,
  onExport,
  onDuplicate
}: TicketActionsMenuProps) {
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const isStaff = profile?.role && ['staff', 'agent', 'admin', 'super_admin'].includes(profile.role);
  const canEdit = isStaff || profile?.id === ticket.requester_id;

  const handleAction = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  const copyTicketLink = () => {
    const url = `${window.location.origin}/tickets/${ticket.id}`;
    navigator.clipboard.writeText(url);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
        aria-label="Ticket actions"
      >
        <MoreVertical size={18} className="text-neutral-600 dark:text-neutral-400" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-neutral-800 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-700 z-20 py-2">
            {onViewDetails && (
              <button
                onClick={() => handleAction(onViewDetails)}
                className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors"
              >
                <Eye size={16} />
                <span className="font-medium">View Details</span>
              </button>
            )}

            {canEdit && onEdit && (
              <button
                onClick={() => handleAction(onEdit)}
                className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors"
              >
                <Edit size={16} />
                <span className="font-medium">Edit Ticket</span>
              </button>
            )}

            {isStaff && onShare && (
              <button
                onClick={() => handleAction(onShare)}
                className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors"
              >
                <Share2 size={16} />
                <span className="font-medium">Share with Technician</span>
              </button>
            )}

            {isStaff && onAddWatcher && (
              <button
                onClick={() => handleAction(onAddWatcher)}
                className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors"
              >
                <UserPlus size={16} />
                <span className="font-medium">Add Watcher</span>
              </button>
            )}

            <div className="my-1 border-t border-neutral-200 dark:border-neutral-700" />

            {isStaff && onAddTag && (
              <button
                onClick={() => handleAction(onAddTag)}
                className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors"
              >
                <Tag size={16} />
                <span className="font-medium">Manage Tags</span>
              </button>
            )}

            {isStaff && onAddLink && (
              <button
                onClick={() => handleAction(onAddLink)}
                className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors"
              >
                <LinkIcon size={16} />
                <span className="font-medium">Link Tickets</span>
              </button>
            )}

            {isStaff && onLogTime && (
              <button
                onClick={() => handleAction(onLogTime)}
                className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors"
              >
                <Clock size={16} />
                <span className="font-medium">Log Time</span>
              </button>
            )}

            <div className="my-1 border-t border-neutral-200 dark:border-neutral-700" />

            {isStaff && onSendEmail && (
              <button
                onClick={() => handleAction(onSendEmail)}
                className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors"
              >
                <Mail size={16} />
                <span className="font-medium">Send Email</span>
              </button>
            )}

            <button
              onClick={copyTicketLink}
              className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors"
            >
              <Copy size={16} />
              <span className="font-medium">Copy Link</span>
            </button>

            {onExport && (
              <button
                onClick={() => handleAction(onExport)}
                className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors"
              >
                <Download size={16} />
                <span className="font-medium">Export</span>
              </button>
            )}

            {isStaff && onDuplicate && (
              <button
                onClick={() => handleAction(onDuplicate)}
                className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors"
              >
                <RefreshCw size={16} />
                <span className="font-medium">Duplicate</span>
              </button>
            )}

            {isStaff && ticket.status !== 'closed' && onArchive && (
              <>
                <div className="my-1 border-t border-neutral-200 dark:border-neutral-700" />
                <button
                  onClick={() => handleAction(onArchive)}
                  className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-700 dark:text-amber-400 transition-colors"
                >
                  <Archive size={16} />
                  <span className="font-medium">Archive</span>
                </button>
              </>
            )}

            {isStaff && onDelete && (
              <button
                onClick={() => handleAction(onDelete)}
                className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-700 dark:text-red-400 transition-colors"
              >
                <Trash2 size={16} />
                <span className="font-medium">Delete</span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
