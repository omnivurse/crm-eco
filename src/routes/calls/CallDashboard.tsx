import { useState, useEffect } from 'react';
import { Phone, PhoneOff, PhoneIncoming, PhoneMissed, Clock, Users, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import IncomingCallNotification from '../../components/calls/IncomingCallNotification';
import ActiveCallPanel from '../../components/calls/ActiveCallPanel';
import CallQueueWidget from '../../components/calls/CallQueueWidget';
import CallHistoryList from '../../components/calls/CallHistoryList';
import AgentStatusToggle from '../../components/calls/AgentStatusToggle';

interface CallLog {
  id: string;
  caller_phone: string;
  caller_name: string | null;
  recipient_phone: string;
  status: string;
  direction: string;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number;
  ticket_id: string | null;
  created_at: string;
}

interface QueueItem {
  id: string;
  priority: number;
  queue_position: number;
  wait_time_seconds: number;
  status: string;
  call: CallLog;
}

export default function CallDashboard() {
  const [activeCalls, setActiveCalls] = useState<CallLog[]>([]);
  const [queuedCalls, setQueuedCalls] = useState<QueueItem[]>([]);
  const [recentCalls, setRecentCalls] = useState<CallLog[]>([]);
  const [incomingCall, setIncomingCall] = useState<CallLog | null>(null);
  const [stats, setStats] = useState({
    totalToday: 0,
    answered: 0,
    missed: 0,
    averageDuration: 0,
  });

  useEffect(() => {
    loadDashboardData();
    setupRealTimeSubscriptions();
  }, []);

  async function loadDashboardData() {
    try {
      // Load active calls
      const { data: active } = await supabase
        .from('call_logs')
        .select('*')
        .in('status', ['ringing', 'active'])
        .order('created_at', { ascending: false });

      if (active) {
        setActiveCalls(active);

        // Check for incoming calls
        const incoming = active.find(
          (call) => call.status === 'ringing' && call.direction === 'inbound'
        );
        if (incoming) {
          setIncomingCall(incoming);
          playRingtone();
        }
      }

      // Load call queue
      const { data: queue } = await supabase
        .from('call_queue')
        .select(`
          *,
          call:call_logs(*)
        `)
        .eq('status', 'waiting')
        .order('priority', { ascending: true });

      if (queue) {
        setQueuedCalls(queue);
      }

      // Load recent calls
      const { data: recent } = await supabase
        .from('call_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (recent) {
        setRecentCalls(recent);
      }

      // Calculate stats
      const today = new Date().toISOString().split('T')[0];
      const { data: todayCalls } = await supabase
        .from('call_logs')
        .select('*')
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`);

      if (todayCalls) {
        const answered = todayCalls.filter((c) => c.status === 'ended' && c.started_at).length;
        const missed = todayCalls.filter((c) => c.status === 'missed').length;
        const durations = todayCalls
          .filter((c) => c.duration_seconds > 0)
          .map((c) => c.duration_seconds);
        const avgDuration = durations.length > 0
          ? durations.reduce((a, b) => a + b, 0) / durations.length
          : 0;

        setStats({
          totalToday: todayCalls.length,
          answered,
          missed,
          averageDuration: Math.floor(avgDuration),
        });
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  }

  function setupRealTimeSubscriptions() {
    // Subscribe to call_logs changes
    const callsChannel = supabase
      .channel('call_logs_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'call_logs',
        },
        (payload) => {
          console.log('Call log change:', payload);
          loadDashboardData();
        }
      )
      .subscribe();

    // Subscribe to call_queue changes
    const queueChannel = supabase
      .channel('call_queue_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'call_queue',
        },
        (payload) => {
          console.log('Queue change:', payload);
          loadDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(callsChannel);
      supabase.removeChannel(queueChannel);
    };
  }

  function playRingtone() {
    // Play browser notification sound
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Incoming Call', {
        body: `Call from ${incomingCall?.caller_name || incomingCall?.caller_phone}`,
        icon: '/favicon.svg',
        tag: 'incoming-call',
      });
    }

    // Play audio (you would add an audio element)
    const audio = new Audio('/sounds/ringtone.mp3');
    audio.loop = true;
    audio.play().catch(() => {
      console.log('Could not play ringtone');
    });
  }

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
            Call Dashboard
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Manage incoming calls and view call history
          </p>
        </div>
        <AgentStatusToggle />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Total Today</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-50 mt-1">
                {stats.totalToday}
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Phone className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Answered</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                {stats.answered}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <PhoneIncoming className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Missed</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                {stats.missed}
              </p>
            </div>
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <PhoneMissed className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Avg Duration</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-50 mt-1">
                {formatDuration(stats.averageDuration)}
              </p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Clock className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Active Calls Section */}
      {activeCalls.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-4 flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Active Calls ({activeCalls.length})
          </h2>
          <div className="space-y-3">
            {activeCalls.map((call) => (
              <ActiveCallPanel key={call.id} call={call} onUpdate={loadDashboardData} />
            ))}
          </div>
        </div>
      )}

      {/* Queue Widget */}
      {queuedCalls.length > 0 && (
        <CallQueueWidget queue={queuedCalls} onAssign={loadDashboardData} />
      )}

      {/* Call History */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Recent Calls
        </h2>
        <CallHistoryList calls={recentCalls} />
      </div>

      {/* Incoming Call Modal */}
      {incomingCall && (
        <IncomingCallNotification
          call={incomingCall}
          onAccept={() => {
            setIncomingCall(null);
            loadDashboardData();
          }}
          onReject={() => {
            setIncomingCall(null);
            loadDashboardData();
          }}
        />
      )}
    </div>
  );
}
