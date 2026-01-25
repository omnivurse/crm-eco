import { useState, useEffect } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Pause, Play } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface CallLog {
  id: string;
  caller_phone: string;
  caller_name: string | null;
  status: string;
  started_at: string | null;
  ticket_id: string | null;
}

interface Props {
  call: CallLog;
  onUpdate: () => void;
}

export default function ActiveCallPanel({ call, onUpdate }: Props) {
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);

  useEffect(() => {
    if (call.started_at) {
      const interval = setInterval(() => {
        const startTime = new Date(call.started_at!).getTime();
        const now = Date.now();
        setDuration(Math.floor((now - startTime) / 1000));
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [call.started_at]);

  async function handleEndCall() {
    try {
      await supabase
        .from('call_logs')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
        })
        .eq('id', call.id);

      onUpdate();
    } catch (error) {
      console.error('Failed to end call:', error);
    }
  }

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return (
    <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-green-600 dark:bg-green-500 flex items-center justify-center animate-pulse">
          <Phone className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-medium text-slate-900 dark:text-slate-50">
            {call.caller_name || call.caller_phone}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {call.status === 'active' ? `Active • ${formatDuration(duration)}` : 'Ringing...'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {call.status === 'active' && (
          <>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-2 rounded-lg transition-colors ${
                isMuted
                  ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setIsOnHold(!isOnHold)}
              className={`p-2 rounded-lg transition-colors ${
                isOnHold
                  ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
              }`}
              title={isOnHold ? 'Resume' : 'Hold'}
            >
              {isOnHold ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
          </>
        )}

        <button
          onClick={handleEndCall}
          className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          title="End Call"
        >
          <PhoneOff className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
