import { Phone, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface QueueItem {
  id: string;
  priority: number;
  queue_position: number;
  wait_time_seconds: number;
  call: {
    id: string;
    caller_phone: string;
    caller_name: string | null;
  };
}

interface Props {
  queue: QueueItem[];
  onAssign: () => void;
}

export default function CallQueueWidget({ queue, onAssign }: Props) {
  async function handleAssign(queueId: string) {
    try {
      const response = await fetch(`/api/goto-connect/queue/${queueId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        onAssign();
      }
    } catch (error) {
      console.error('Failed to assign call:', error);
    }
  }

  function formatWaitTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    return mins > 0 ? `${mins}m ago` : 'Just now';
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-4 flex items-center gap-2">
        <Phone className="w-5 h-5" />
        Call Queue ({queue.length})
      </h2>
      <div className="space-y-3">
        {queue.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700"
          >
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm font-semibold">
                {item.queue_position}
              </div>
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-50">
                  {item.call.caller_name || item.call.caller_phone}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Waiting {formatWaitTime(item.wait_time_seconds)}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleAssign(item.id)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              Accept Call
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
