import { WorkqueueView } from '@/components/workqueue/WorkqueueView';
import { Layers } from 'lucide-react';

export const metadata = {
  title: 'Workqueue | CRM',
  description: 'Your all-in-one view for managing approvals, tasks, follow-ups, and more.',
};

export default function WorkqueuePage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-sm">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Workqueue
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Stay on top of your day &mdash; approvals, tasks, follow-ups, and more in one place.
            </p>
          </div>
        </div>
      </div>

      {/* Main view */}
      <WorkqueueView />
    </div>
  );
}
