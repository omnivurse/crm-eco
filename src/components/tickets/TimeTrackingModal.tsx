import { useState, useEffect } from 'react';
import { X, Clock, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';

interface TimeEntry {
  id: string;
  entry_type: string;
  hours: number;
  description: string;
  is_billable: boolean;
  entry_date: string;
  created_at: string;
  user: { full_name: string; email: string; };
}

interface TimeTrackingModalProps {
  ticketId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function TimeTrackingModal({ ticketId, isOpen, onClose }: TimeTrackingModalProps) {
  const { profile } = useAuth();
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [hours, setHours] = useState('');
  const [entryType, setEntryType] = useState('work');
  const [description, setDescription] = useState('');
  const [isBillable, setIsBillable] = useState(true);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (isOpen && ticketId) fetchTimeEntries();
  }, [isOpen, ticketId]);

  const fetchTimeEntries = async () => {
    try {
      const { data, error } = await supabase
        .from('ticket_time_entries')
        .select('id, entry_type, hours, description, is_billable, entry_date, created_at, user:profiles!ticket_time_entries_user_id_fkey(full_name, email)')
        .eq('ticket_id', ticketId)
        .order('entry_date', { ascending: false });
      if (error) throw error;
      setTimeEntries(data as any || []);
    } catch (err) {
      console.error('Error fetching time entries:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEntry = async () => {
    if (!hours || parseFloat(hours) <= 0 || !description.trim()) return;
    setAdding(true);
    try {
      const { error } = await supabase.from('ticket_time_entries').insert({
        ticket_id: ticketId, user_id: profile?.id, entry_type: entryType,
        hours: parseFloat(hours), description: description.trim(),
        is_billable: isBillable, entry_date: entryDate
      });
      if (error) throw error;
      setHours(''); setDescription(''); setEntryType('work'); setIsBillable(true); setEntryDate(new Date().toISOString().split('T')[0]);
      await fetchTimeEntries();
    } catch (err: any) {
      alert('Failed to add time entry: ' + (err.message || 'Unknown error'));
    } finally {
      setAdding(false);
    }
  };

  const totalHours = timeEntries.reduce((sum, entry) => sum + entry.hours, 0);
  const billableHours = timeEntries.filter(e => e.is_billable).reduce((sum, entry) => sum + entry.hours, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700">
          <div>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <Clock size={24} className="text-primary-800 dark:text-primary-500" />
              Time Tracking
            </h2>
            <div className="flex gap-4 mt-2 text-sm">
              <span className="text-neutral-600 dark:text-neutral-400">Total: <strong className="text-neutral-900 dark:text-white">{totalHours.toFixed(2)}h</strong></span>
              <span className="text-neutral-600 dark:text-neutral-400">Billable: <strong className="text-green-600 dark:text-green-400">{billableHours.toFixed(2)}h</strong></span>
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"><X size={24} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 p-4 bg-neutral-50 dark:bg-neutral-900 rounded-lg border">
            <h3 className="text-sm font-bold mb-4">Log Time</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold mb-2">Hours</label>
                <input type="number" step="0.25" min="0" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="1.5" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-2">Type</label>
                <select value={entryType} onChange={(e) => setEntryType(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                  <option value="work">Work</option><option value="research">Research</option><option value="communication">Communication</option>
                  <option value="documentation">Documentation</option><option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold mb-2">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What did you work on?" className="w-full px-3 py-2 border rounded-lg resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold mb-2">Date</label>
                <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={isBillable} onChange={(e) => setIsBillable(e.target.checked)} className="w-4 h-4" />
                  <span className="text-sm font-medium">Billable</span>
                </label>
              </div>
            </div>
            <button onClick={handleAddEntry} disabled={adding} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-800 hover:bg-primary-900 text-white rounded-xl font-medium disabled:opacity-50">
              <Plus size={18} />Add Time Entry
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8"><div className="inline-block w-8 h-8 border-4 border-primary-800 border-t-transparent rounded-full animate-spin"></div></div>
          ) : timeEntries.length === 0 ? (
            <div className="text-center py-8">
              <Clock size={48} className="mx-auto text-neutral-300 mb-3" />
              <p className="text-neutral-600 dark:text-neutral-400">No time entries yet. Start tracking time spent on this ticket.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="text-sm font-bold mb-3">Time Entries</h3>
              {timeEntries.map((entry) => (
                <div key={entry.id} className="p-4 bg-white dark:bg-neutral-900 rounded-lg border">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg font-bold">{entry.hours}h</span>
                        <span className="text-xs px-2 py-1 rounded bg-neutral-100">{entry.entry_type}</span>
                        {entry.is_billable && <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-800">Billable</span>}
                      </div>
                      <p className="text-sm mb-2">{entry.description}</p>
                      <div className="flex items-center gap-3 text-xs text-neutral-600">
                        <span>{entry.user.full_name || entry.user.email}</span><span>•</span>
                        <span>{format(new Date(entry.entry_date), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end p-6 border-t bg-neutral-50 dark:bg-neutral-900/50">
          <button onClick={onClose} className="px-5 py-2 border text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 rounded-xl font-medium">Close</button>
        </div>
      </div>
    </div>
  );
}
