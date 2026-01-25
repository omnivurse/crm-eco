import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Calendar, AlertTriangle, CheckCircle, Clock, Filter, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from 'date-fns';

interface Change {
  id: string;
  type: string;
  risk: string;
  window_start: string;
  window_end: string;
  description: string;
  status: string;
}

export function ChangeCalendar() {
  const [changes, setChanges] = useState<Change[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [filterRisk, setFilterRisk] = useState<string>('all');

  useEffect(() => {
    fetchChanges();
  }, [currentDate]);

  const fetchChanges = async () => {
    try {
      setLoading(true);
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);

      const { data, error } = await supabase
        .from('changes')
        .select('*')
        .gte('window_start', start.toISOString())
        .lte('window_start', end.toISOString())
        .order('window_start');

      if (data) setChanges(data);
    } catch (error) {
      console.error('Error fetching changes:', error);
    } finally {
      setLoading(false);
    }
  };

  const monthDays = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate)
  });

  const getChangesForDay = (day: Date) => {
    return changes.filter(change =>
      isSameDay(new Date(change.window_start), day)
    );
  };

  const getRiskColor = (risk: string) => {
    const colors: Record<string, string> = {
      'low': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-300',
      'medium': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-300',
      'high': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-300',
      'critical': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-300'
    };
    return colors[risk.toLowerCase()] || colors.low;
  };

  const filteredChanges = filterRisk === 'all'
    ? changes
    : changes.filter(c => c.risk.toLowerCase() === filterRisk);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-16 h-16 border-4 border-primary-800 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-neutral-600 dark:text-neutral-400">Loading change calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="championship-title text-4xl" data-text="Change Calendar">
                Change Calendar
              </h1>
              <p className="text-xl text-neutral-600 dark:text-neutral-400 mt-2">
                Plan and track infrastructure changes
              </p>
            </div>
            <button className="neon-button flex items-center gap-2">
              <Plus size={20} />
              Schedule Change
            </button>
          </div>
        </motion.div>

        {/* Stats & Filters */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="stat-card"
          >
            <div className="relative z-10 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                <Calendar className="text-white" size={24} />
              </div>
              <div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">This Month</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-white">{changes.length}</p>
              </div>
            </div>
          </motion.div>

          <button
            onClick={() => setFilterRisk(filterRisk === 'low' ? 'all' : 'low')}
            className={`stat-card text-left ${filterRisk === 'low' ? 'ring-2 ring-green-500' : ''}`}
          >
            <div className="relative z-10 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                <CheckCircle className="text-white" size={24} />
              </div>
              <div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Low Risk</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                  {changes.filter(c => c.risk === 'low').length}
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setFilterRisk(filterRisk === 'high' ? 'all' : 'high')}
            className={`stat-card text-left ${filterRisk === 'high' ? 'ring-2 ring-orange-500' : ''}`}
          >
            <div className="relative z-10 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                <AlertTriangle className="text-white" size={24} />
              </div>
              <div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">High Risk</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                  {changes.filter(c => c.risk === 'high').length}
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setFilterRisk(filterRisk === 'critical' ? 'all' : 'critical')}
            className={`stat-card text-left ${filterRisk === 'critical' ? 'ring-2 ring-red-500' : ''}`}
          >
            <div className="relative z-10 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
                <AlertTriangle className="text-white" size={24} />
              </div>
              <div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Critical</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                  {changes.filter(c => c.risk === 'critical').length}
                </p>
              </div>
            </div>
          </button>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Calendar View */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2 glass-card p-8"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">
                {format(currentDate, 'MMMM yyyy')}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
                  className="px-4 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                >
                  ←
                </button>
                <button
                  onClick={() => setCurrentDate(new Date())}
                  className="px-4 py-2 rounded-xl bg-primary-100 dark:bg-primary-950/30 text-primary-800 dark:text-primary-500 hover:bg-primary-200 dark:hover:bg-primary-950/50 transition-colors"
                >
                  Today
                </button>
                <button
                  onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
                  className="px-4 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                >
                  →
                </button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-sm font-semibold text-neutral-600 dark:text-neutral-400 py-2">
                  {day}
                </div>
              ))}

              {monthDays.map((day, index) => {
                const dayChanges = getChangesForDay(day);
                const hasChanges = dayChanges.length > 0;
                const todayClass = isToday(day) ? 'ring-2 ring-blue-500' : '';

                return (
                  <button
                    key={index}
                    onClick={() => setSelectedDate(day)}
                    className={`aspect-square p-2 rounded-xl transition-all hover:bg-primary-50 dark:hover:bg-primary-950/20 ${todayClass} ${
                      selectedDate && isSameDay(day, selectedDate) ? 'bg-primary-100 dark:bg-primary-950/30' : 'bg-white dark:bg-neutral-800'
                    }`}
                  >
                    <div className="text-sm font-medium text-neutral-900 dark:text-white">
                      {format(day, 'd')}
                    </div>
                    {hasChanges && (
                      <div className="mt-1 flex flex-wrap gap-1 justify-center">
                        {dayChanges.slice(0, 3).map((change, i) => (
                          <div
                            key={i}
                            className={`w-1.5 h-1.5 rounded-full ${
                              change.risk === 'critical' ? 'bg-accent-500' :
                              change.risk === 'high' ? 'bg-orange-500' :
                              change.risk === 'medium' ? 'bg-yellow-500' :
                              'bg-success-500'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* Change List */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-card p-6"
          >
            <h3 className="font-bold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
              <Clock size={20} />
              Upcoming Changes
            </h3>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {filteredChanges.slice(0, 10).map((change, index) => (
                <motion.div
                  key={change.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 hover:border-primary-600 dark:hover:border-primary-600 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className={`modern-badge ${getRiskColor(change.risk)}`}>
                      {change.risk}
                    </span>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      {change.type}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-neutral-900 dark:text-white mb-2">
                    {change.description || 'System maintenance'}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                    <Clock size={12} />
                    <span>{format(new Date(change.window_start), 'MMM d, HH:mm')}</span>
                  </div>
                </motion.div>
              ))}

              {filteredChanges.length === 0 && (
                <div className="text-center py-8">
                  <Calendar className="mx-auto mb-3 text-neutral-400" size={48} />
                  <p className="text-neutral-600 dark:text-neutral-400">No changes scheduled</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
