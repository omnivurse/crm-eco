import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';
import { Calendar, Clock, Plus, ChevronLeft, ChevronRight, BookOpen, Zap, List, Edit2, Trash2, Save, X, Send } from 'lucide-react';

interface DailyLog {
  id: string;
  work_date: string;
  started_at: string | null;
  ended_at: string | null;
  blockers: string | null;
  highlights: string | null;
  summary: string | null;
}

interface DailyLogEntry {
  id: string;
  daily_log_id: string;
  entry_type: string;
  description: string;
  duration_minutes: number | null;
  created_at: string;
  updated_at: string;
}

export function DailyLogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [todayLog, setTodayLog] = useState<DailyLog | null>(null);
  const [entries, setEntries] = useState<DailyLogEntry[]>([]);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [newEntry, setNewEntry] = useState({ entry_type: 'task', description: '', duration_minutes: '' });
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [showEndDayModal, setShowEndDayModal] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);

  useEffect(() => {
    if (user) {
      loadLogs();
    }
  }, [user, currentDate]);

  useEffect(() => {
    if (todayLog) {
      loadEntries();
    }
  }, [todayLog]);

  async function loadLogs() {
    if (!user) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0];
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().split('T')[0];

      const [logsRes, todayRes] = await Promise.all([
        supabase
          .from('daily_logs')
          .select('*')
          .eq('user_id', user.id)
          .gte('work_date', startOfMonth)
          .lte('work_date', endOfMonth)
          .order('work_date', { ascending: false }),

        supabase
          .from('daily_logs')
          .select('*')
          .eq('user_id', user.id)
          .eq('work_date', today)
          .maybeSingle()
      ]);

      if (logsRes.data) setLogs(logsRes.data);
      if (todayRes.data) setTodayLog(todayRes.data);
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  }

  async function startLog() {
    if (!user) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('daily_logs')
        .insert({
          user_id: user.id,
          work_date: today,
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setTodayLog(data);
        loadLogs();
      }
    } catch (error) {
      console.error('Error starting log:', error);
    }
  }

  async function loadEntries() {
    if (!todayLog) return;

    try {
      const { data, error } = await supabase
        .from('daily_log_entries')
        .select('*')
        .eq('daily_log_id', todayLog.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (data) setEntries(data);
    } catch (error) {
      console.error('Error loading entries:', error);
    }
  }

  async function addEntry() {
    if (!todayLog || !newEntry.description.trim()) return;

    try {
      const { data, error } = await supabase
        .from('daily_log_entries')
        .insert({
          daily_log_id: todayLog.id,
          user_id: user!.id,
          entry_type: newEntry.entry_type,
          description: newEntry.description.trim(),
          duration_minutes: newEntry.duration_minutes ? parseInt(newEntry.duration_minutes) : null
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setEntries([...entries, data]);
        setNewEntry({ entry_type: 'task', description: '', duration_minutes: '' });
        setShowAddEntry(false);
      }
    } catch (error) {
      console.error('Error adding entry:', error);
    }
  }

  async function updateEntry(entryId: string, description: string) {
    try {
      const { error } = await supabase
        .from('daily_log_entries')
        .update({ description })
        .eq('id', entryId);

      if (error) throw error;
      setEditingEntry(null);
      loadEntries();
    } catch (error) {
      console.error('Error updating entry:', error);
    }
  }

  async function deleteEntry(entryId: string) {
    if (!confirm('Delete this entry?')) return;

    try {
      const { error } = await supabase
        .from('daily_log_entries')
        .delete()
        .eq('id', entryId);

      if (error) throw error;
      setEntries(entries.filter(e => e.id !== entryId));
    } catch (error) {
      console.error('Error deleting entry:', error);
    }
  }

  async function endLog() {
    if (!todayLog) return;
    setShowEndDayModal(true);
  }

  async function confirmEndDay() {
    if (!todayLog || !user) return;

    try {
      setSendingReport(true);

      const { error: updateError } = await supabase
        .from('daily_logs')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', todayLog.id);

      if (updateError) throw updateError;

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .single();

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const reportPayload = {
        dailyLogId: todayLog.id,
        userId: user.id,
        workDate: todayLog.work_date,
        startedAt: todayLog.started_at || new Date().toISOString(),
        endedAt: new Date().toISOString(),
        highlights: todayLog.highlights,
        blockers: todayLog.blockers,
        summary: todayLog.summary,
        userName: profile?.full_name || 'Team Member',
        userEmail: profile?.email || '',
        entries: entries
      };

      await fetch(`${supabaseUrl}/functions/v1/send-daily-log-report`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(reportPayload)
      });

      setShowEndDayModal(false);
      loadLogs();
    } catch (error) {
      console.error('Error ending log:', error);
    } finally {
      setSendingReport(false);
    }
  }

  function previousMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  }

  function nextMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900">
        <div className="text-center">
          <div className="inline-block w-16 h-16 border-4 border-primary-800 border-t-transparent rounded-full animate-spin glow-effect"></div>
          <p className="mt-4 text-neutral-600 dark:text-neutral-400 font-medium">Loading daily logs...</p>
        </div>
      </div>
    );
  }

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="hero-work text-white py-20 px-6"
      >
        <div className="max-w-5xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-5 mb-8"
          >
            <motion.div
              animate={{
                rotate: [0, 360]
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "linear"
              }}
              className="p-5 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20"
            >
              <Calendar size={52} className="text-white" />
            </motion.div>
            <div>
              <h1 className="text-6xl font-black mb-2 tracking-tight">Daily Logs</h1>
              <p className="text-2xl text-cyan-100 font-medium">Track your daily work activity and progress</p>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="stat-card"
            >
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">This Month</div>
                  <div className="text-3xl font-bold text-neutral-900 dark:text-white">{logs.length}</div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                  <BookOpen className="text-blue-600 dark:text-blue-300" size={24} />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="stat-card"
            >
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Status</div>
                  <div className="text-xl font-bold text-neutral-900 dark:text-white">{todayLog ? todayLog.ended_at ? 'Completed' : 'Active' : 'Not Started'}</div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-yellow-100 dark:bg-yellow-500/20 flex items-center justify-center">
                  <Zap className="text-yellow-600 dark:text-yellow-300" size={24} />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-6 mb-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Today's Log</h2>
            <div className="text-sm text-neutral-600 dark:text-neutral-400 font-medium">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>

          {!todayLog ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-900/30 flex items-center justify-center mx-auto mb-4">
                <Calendar className="text-primary-800 dark:text-primary-500 floating" size={40} />
              </div>
              <p className="text-neutral-600 dark:text-neutral-400 mb-4 font-medium">No log for today yet</p>
              <button
                onClick={startLog}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-700 to-primary-800 hover:from-primary-800 hover:to-primary-900 text-white rounded-xl transition-all transform hover:scale-105 font-medium shadow-lg hover:shadow-xl"
              >
                <Plus className="h-5 w-5" />
                Start Daily Log
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-primary-800" />
                  <div>
                    <div className="text-sm font-medium text-neutral-900 dark:text-white">
                      Started: {todayLog.started_at ? new Date(todayLog.started_at).toLocaleTimeString() : 'Not started'}
                    </div>
                    {todayLog.ended_at && (
                      <div className="text-sm text-neutral-500 dark:text-neutral-400">
                        Ended: {new Date(todayLog.ended_at).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                </div>
                {!todayLog.ended_at && (
                  <button
                    onClick={endLog}
                    className="px-6 py-3 bg-gradient-to-r from-neutral-600 to-neutral-700 hover:from-neutral-700 hover:to-neutral-800 text-white rounded-xl transition-all transform hover:scale-105 font-medium shadow-lg"
                  >
                    End Day
                  </button>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">Highlights</label>
                <textarea
                  value={todayLog.highlights || ''}
                  onChange={(e) => {
                    const newLog = { ...todayLog, highlights: e.target.value };
                    setTodayLog(newLog);
                  }}
                  onBlur={async () => {
                    await supabase
                      .from('daily_logs')
                      .update({ highlights: todayLog.highlights })
                      .eq('id', todayLog.id);
                  }}
                  rows={3}
                  className="w-full px-4 py-3 bg-white/50 dark:bg-neutral-800/50 backdrop-blur-sm border border-neutral-300 dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-neutral-900 dark:text-white"
                  placeholder="What went well today?"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">Blockers</label>
                <textarea
                  value={todayLog.blockers || ''}
                  onChange={(e) => {
                    const newLog = { ...todayLog, blockers: e.target.value };
                    setTodayLog(newLog);
                  }}
                  onBlur={async () => {
                    await supabase
                      .from('daily_logs')
                      .update({ blockers: todayLog.blockers })
                      .eq('id', todayLog.id);
                  }}
                  rows={3}
                  className="w-full px-4 py-3 bg-white/50 dark:bg-neutral-800/50 backdrop-blur-sm border border-neutral-300 dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-neutral-900 dark:text-white"
                  placeholder="Any obstacles or challenges?"
                />
              </div>

              <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                    <List size={20} />
                    Activity Log
                    {entries.length > 0 && (
                      <span className="ml-2 px-2 py-1 text-xs font-medium rounded-full bg-primary-100 text-primary-900 dark:bg-primary-950 dark:text-primary-200">
                        {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
                      </span>
                    )}
                  </h3>
                  {!todayLog.ended_at && (
                    <button
                      onClick={() => setShowAddEntry(!showAddEntry)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary-800 hover:bg-primary-900 text-white rounded-xl transition-colors text-sm font-medium"
                    >
                      <Plus size={16} />
                      Add Entry
                    </button>
                  )}
                </div>

                <AnimatePresence>
                  {showAddEntry && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-4 p-4 bg-primary-50 dark:bg-primary-950/20 rounded-xl border border-primary-200 dark:border-primary-900"
                    >
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">Entry Type</label>
                          <select
                            value={newEntry.entry_type}
                            onChange={(e) => setNewEntry({ ...newEntry, entry_type: e.target.value })}
                            className="w-full px-4 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-primary-500 text-neutral-900 dark:text-white"
                          >
                            <option value="task">Task Completed</option>
                            <option value="meeting">Meeting</option>
                            <option value="blocker">Blocker Found</option>
                            <option value="note">Note</option>
                            <option value="achievement">Achievement</option>
                            <option value="break">Break</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">Description</label>
                          <textarea
                            value={newEntry.description}
                            onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
                            rows={2}
                            className="w-full px-4 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-primary-500 text-neutral-900 dark:text-white"
                            placeholder="Describe what you did..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">Duration (minutes, optional)</label>
                          <input
                            type="number"
                            value={newEntry.duration_minutes}
                            onChange={(e) => setNewEntry({ ...newEntry, duration_minutes: e.target.value })}
                            className="w-full px-4 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-primary-500 text-neutral-900 dark:text-white"
                            placeholder="e.g., 30"
                            min="0"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={addEntry}
                            disabled={!newEntry.description.trim()}
                            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary-800 hover:bg-primary-900 disabled:bg-neutral-400 disabled:cursor-not-allowed text-white rounded-xl transition-colors font-medium"
                          >
                            <Save size={16} />
                            Save Entry
                          </button>
                          <button
                            onClick={() => {
                              setShowAddEntry(false);
                              setNewEntry({ entry_type: 'task', description: '', duration_minutes: '' });
                            }}
                            className="px-4 py-2 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-neutral-900 dark:text-white rounded-xl transition-colors"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {entries.length === 0 ? (
                  <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
                    <List size={40} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No entries yet. Add your first activity above!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {entries.map((entry, index) => (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="p-3 bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:border-primary-300 dark:hover:border-primary-700 transition-all"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0">
                            <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                              entry.entry_type === 'task' ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200' :
                              entry.entry_type === 'meeting' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                              entry.entry_type === 'blocker' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                              entry.entry_type === 'achievement' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                              entry.entry_type === 'break' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                              'bg-neutral-100 text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200'
                            }`}>
                              {entry.entry_type}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            {editingEntry === entry.id ? (
                              <div className="space-y-2">
                                <textarea
                                  defaultValue={entry.description}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && e.ctrlKey) {
                                      updateEntry(entry.id, e.currentTarget.value);
                                    }
                                  }}
                                  rows={2}
                                  className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-primary-500 text-neutral-900 dark:text-white text-sm"
                                  id={`edit-${entry.id}`}
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => {
                                      const textarea = document.getElementById(`edit-${entry.id}`) as HTMLTextAreaElement;
                                      updateEntry(entry.id, textarea.value);
                                    }}
                                    className="px-3 py-1 bg-primary-800 hover:bg-primary-900 text-white rounded text-xs"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingEntry(null)}
                                    className="px-3 py-1 bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-neutral-900 dark:text-white rounded text-xs"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="text-sm text-neutral-900 dark:text-white">{entry.description}</p>
                                <div className="flex items-center gap-3 mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                  <span>{new Date(entry.created_at).toLocaleTimeString()}</span>
                                  {entry.duration_minutes && <span>⏱ {entry.duration_minutes} min</span>}
                                </div>
                              </>
                            )}
                          </div>
                          {!todayLog.ended_at && editingEntry !== entry.id && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => setEditingEntry(entry.id)}
                                className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"
                                title="Edit entry"
                              >
                                <Edit2 size={14} className="text-neutral-600 dark:text-neutral-400" />
                              </button>
                              <button
                                onClick={() => deleteEntry(entry.id)}
                                className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded transition-colors"
                                title="Delete entry"
                              >
                                <Trash2 size={14} className="text-red-600 dark:text-red-400" />
                              </button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Log History</h2>
            <div className="flex items-center gap-4">
              <button onClick={previousMonth} className="p-2 hover:bg-white/50 dark:hover:bg-neutral-700/50 rounded-xl transition-all">
                <ChevronLeft className="h-5 w-5 text-neutral-700 dark:text-neutral-300" />
              </button>
              <span className="text-sm font-semibold text-neutral-900 dark:text-white">
                {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
              <button onClick={nextMonth} className="p-2 hover:bg-white/50 dark:hover:bg-neutral-700/50 rounded-xl transition-all">
                <ChevronRight className="h-5 w-5 text-neutral-700 dark:text-neutral-300" />
              </button>
            </div>
          </div>

          {logs.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-800/30 dark:to-neutral-700/30 flex items-center justify-center mx-auto mb-4">
                <Calendar className="text-neutral-500 dark:text-neutral-400 floating" size={40} />
              </div>
              <p className="text-neutral-600 dark:text-neutral-400 font-medium">No logs for this month</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log, index) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="p-4 bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:shadow-lg transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-semibold text-neutral-900 dark:text-white">
                          {new Date(log.work_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                        </span>
                        {log.ended_at && (
                          <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                            {log.started_at && log.ended_at && (
                              <>
                                {new Date(log.started_at).toLocaleTimeString()} - {new Date(log.ended_at).toLocaleTimeString()}
                              </>
                            )}
                          </span>
                        )}
                      </div>
                      {log.highlights && (
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2">{log.highlights}</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      <AnimatePresence>
        {showEndDayModal && todayLog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => !sendingReport && setShowEndDayModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
                <h2 className="text-2xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <Send className="text-primary-800" />
                  End Day & Send Report
                </h2>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                  Review your daily summary before sending the report to management
                </p>
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-neutral-50 dark:bg-neutral-900/50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Work Duration</span>
                    <span className="text-sm font-medium text-neutral-900 dark:text-white">
                      {todayLog.started_at && (() => {
                        const start = new Date(todayLog.started_at);
                        const end = new Date();
                        const diffMs = end.getTime() - start.getTime();
                        const hours = Math.floor(diffMs / (1000 * 60 * 60));
                        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                        return `${hours}h ${minutes}m`;
                      })()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Activity Entries</span>
                    <span className="text-sm font-medium text-neutral-900 dark:text-white">{entries.length}</span>
                  </div>
                </div>

                {todayLog.highlights && (
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-white mb-2">Highlights</h3>
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
                      {todayLog.highlights}
                    </div>
                  </div>
                )}

                {todayLog.blockers && (
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-white mb-2">Blockers</h3>
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
                      {todayLog.blockers}
                    </div>
                  </div>
                )}

                {entries.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-white mb-2">
                      Activity Timeline ({entries.length} entries)
                    </h3>
                    <div className="bg-neutral-50 dark:bg-neutral-900/50 rounded-xl p-3 space-y-2 max-h-60 overflow-y-auto">
                      {entries.map((entry) => (
                        <div key={entry.id} className="flex items-start gap-2 text-sm">
                          <span className="text-neutral-500 dark:text-neutral-400 text-xs whitespace-nowrap">
                            {new Date(entry.created_at).toLocaleTimeString()}
                          </span>
                          <span className={`inline-block px-2 py-0.5 text-xs rounded-full flex-shrink-0 ${
                            entry.entry_type === 'task' ? 'bg-cyan-100 text-cyan-800' :
                            entry.entry_type === 'meeting' ? 'bg-purple-100 text-purple-800' :
                            entry.entry_type === 'blocker' ? 'bg-red-100 text-red-800' :
                            entry.entry_type === 'achievement' ? 'bg-green-100 text-green-800' :
                            'bg-neutral-100 text-neutral-800'
                          }`}>
                            {entry.entry_type}
                          </span>
                          <span className="text-neutral-700 dark:text-neutral-300 flex-1">{entry.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-xl p-4">
                  <p className="text-sm text-cyan-900 dark:text-cyan-100">
                    This report will be automatically sent to <strong>vrt@mympb.com</strong> when you confirm.
                  </p>
                </div>
              </div>

              <div className="p-6 border-t border-neutral-200 dark:border-neutral-700 flex gap-3">
                <button
                  onClick={() => setShowEndDayModal(false)}
                  disabled={sendingReport}
                  className="flex-1 px-4 py-3 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-700 dark:hover:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-900 dark:text-white rounded-xl transition-all font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmEndDay}
                  disabled={sendingReport}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-primary-700 to-primary-800 hover:from-primary-800 hover:to-primary-900 disabled:from-neutral-400 disabled:to-neutral-500 disabled:cursor-not-allowed text-white rounded-xl transition-all font-medium shadow-lg"
                >
                  {sendingReport ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Sending Report...
                    </>
                  ) : (
                    <>
                      <Send size={20} />
                      End Day & Send Report
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
