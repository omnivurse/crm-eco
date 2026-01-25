import { useState, useEffect } from 'react';
import { Power, Coffee, Moon, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type AgentStatus = 'available' | 'busy' | 'away' | 'dnd' | 'offline';

const STATUS_CONFIG = {
  available: {
    label: 'Available',
    color: 'bg-green-600',
    icon: Power,
  },
  busy: {
    label: 'Busy',
    color: 'bg-red-600',
    icon: AlertCircle,
  },
  away: {
    label: 'Away',
    color: 'bg-yellow-600',
    icon: Coffee,
  },
  dnd: {
    label: 'Do Not Disturb',
    color: 'bg-orange-600',
    icon: Moon,
  },
  offline: {
    label: 'Offline',
    color: 'bg-slate-600',
    icon: Power,
  },
};

export default function AgentStatusToggle() {
  const [currentStatus, setCurrentStatus] = useState<AgentStatus>('offline');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadCurrentStatus();
  }, []);

  async function loadCurrentStatus() {
    try {
      const response = await fetch('/api/goto-connect/status');
      const data = await response.json();
      if (data.success && data.status) {
        setCurrentStatus(data.status.status);
      }
    } catch (error) {
      console.error('Failed to load status:', error);
    }
  }

  async function updateStatus(newStatus: AgentStatus) {
    setIsLoading(true);
    try {
      const response = await fetch('/api/goto-connect/status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setCurrentStatus(newStatus);
        setIsOpen(false);
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const StatusIcon = STATUS_CONFIG[currentStatus].icon;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className={`flex items-center gap-2 px-4 py-2 ${STATUS_CONFIG[currentStatus].color} text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50`}
      >
        <StatusIcon className="w-4 h-4" />
        <span className="font-medium">{STATUS_CONFIG[currentStatus].label}</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-20 py-1">
            {(Object.keys(STATUS_CONFIG) as AgentStatus[]).map((status) => {
              const Icon = STATUS_CONFIG[status].icon;
              return (
                <button
                  key={status}
                  onClick={() => updateStatus(status)}
                  disabled={isLoading}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 ${
                    status === currentStatus ? 'bg-slate-50 dark:bg-slate-700' : ''
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full ${STATUS_CONFIG[status].color}`} />
                  <Icon className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  <span className="text-sm text-slate-900 dark:text-slate-50">
                    {STATUS_CONFIG[status].label}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
