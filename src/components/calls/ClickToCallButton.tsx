import { useState } from 'react';
import { Phone, Loader2 } from 'lucide-react';

interface Props {
  phoneNumber: string;
  ticketId?: string;
  displayName?: string;
  className?: string;
}

export default function ClickToCallButton({
  phoneNumber,
  ticketId,
  displayName,
  className = '',
}: Props) {
  const [isDialing, setIsDialing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCall() {
    setIsDialing(true);
    setError(null);

    try {
      // Get user's active device
      const devicesResponse = await fetch('/api/goto-connect/devices');
      const devicesData = await devicesResponse.json();

      if (!devicesData.success || !devicesData.devices || devicesData.devices.length === 0) {
        throw new Error('No active device found. Please register a device first.');
      }

      const activeDevice = devicesData.devices.find((d: any) => d.is_active);
      if (!activeDevice) {
        throw new Error('No active device found. Please activate a device first.');
      }

      // Make the call
      const callResponse = await fetch('/api/goto-connect/calls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to_phone: phoneNumber,
          device_id: activeDevice.id,
          ticket_id: ticketId,
        }),
      });

      const callData = await callResponse.json();

      if (!callData.success) {
        throw new Error(callData.error || 'Failed to initiate call');
      }

      // Success feedback
      setTimeout(() => {
        setIsDialing(false);
      }, 2000);
    } catch (err) {
      console.error('Call failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to make call');
      setIsDialing(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleCall}
        disabled={isDialing}
        className={`inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        title={`Call ${displayName || phoneNumber}`}
      >
        {isDialing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Dialing...</span>
          </>
        ) : (
          <>
            <Phone className="w-4 h-4" />
            <span>Call {displayName || phoneNumber}</span>
          </>
        )}
      </button>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>
      )}
    </div>
  );
}
