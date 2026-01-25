import { useState } from 'react';
import { Phone, PhoneOff, Voicemail, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface CallLog {
  id: string;
  caller_phone: string;
  caller_name: string | null;
  ticket_id: string | null;
}

interface Props {
  call: CallLog;
  onAccept: () => void;
  onReject: () => void;
}

export default function IncomingCallNotification({ call, onAccept, onReject }: Props) {
  const [isProcessing, setIsProcessing] = useState(false);

  async function handleAccept() {
    setIsProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('call_logs')
        .update({
          assigned_agent_id: user.id,
          status: 'active',
          started_at: new Date().toISOString(),
        })
        .eq('id', call.id);

      onAccept();
    } catch (error) {
      console.error('Failed to accept call:', error);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleReject() {
    setIsProcessing(true);
    try {
      await supabase
        .from('call_logs')
        .update({ status: 'missed' })
        .eq('id', call.id);

      onReject();
    } catch (error) {
      console.error('Failed to reject call:', error);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleVoicemail() {
    setIsProcessing(true);
    try {
      await supabase
        .from('call_logs')
        .update({ status: 'voicemail' })
        .eq('id', call.id);

      onReject();
    } catch (error) {
      console.error('Failed to send to voicemail:', error);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-8 animate-in fade-in slide-in-from-bottom-4">
        {/* Caller Info */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-4 animate-pulse">
            <User className="w-10 h-10 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-2">
            Incoming Call
          </h2>
          <p className="text-xl text-slate-700 dark:text-slate-300">
            {call.caller_name || 'Unknown Caller'}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {call.caller_phone}
          </p>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-3 gap-3">
          {/* Accept Button */}
          <button
            onClick={handleAccept}
            disabled={isProcessing}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <Phone className="w-6 h-6 text-white" />
            </div>
            <span className="text-xs font-medium text-white">Accept</span>
          </button>

          {/* Voicemail Button */}
          <button
            onClick={handleVoicemail}
            disabled={isProcessing}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-600 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <Voicemail className="w-6 h-6 text-white" />
            </div>
            <span className="text-xs font-medium text-white">Voicemail</span>
          </button>

          {/* Reject Button */}
          <button
            onClick={handleReject}
            disabled={isProcessing}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <PhoneOff className="w-6 h-6 text-white" />
            </div>
            <span className="text-xs font-medium text-white">Decline</span>
          </button>
        </div>

        {call.ticket_id && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-900 dark:text-blue-100 text-center">
              Linked to Ticket #{call.ticket_id.slice(0, 8)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
