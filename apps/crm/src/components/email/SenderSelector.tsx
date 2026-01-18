'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  Mail,
  Star,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface SenderAddress {
  id: string;
  email: string;
  name: string;
  domain: string;
  is_default: boolean;
  is_verified: boolean;
}

interface SenderSelectorProps {
  value?: string;
  onChange: (addressId: string, address: SenderAddress) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}

export function SenderSelector({
  value,
  onChange,
  className,
  disabled = false,
  placeholder = 'Select sender...',
}: SenderSelectorProps) {
  const [addresses, setAddresses] = useState<SenderAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAddresses = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/email/sender-addresses');
      if (!response.ok) {
        throw new Error('Failed to fetch sender addresses');
      }

      const data = await response.json();
      setAddresses(data.addresses || []);

      // Auto-select default if no value set
      if (!value && data.addresses?.length > 0) {
        const defaultAddr = data.addresses.find((a: SenderAddress) => a.is_default);
        if (defaultAddr) {
          onChange(defaultAddr.id, defaultAddr);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load addresses');
    } finally {
      setLoading(false);
    }
  }, [value, onChange]);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  const selectedAddress = addresses.find((a) => a.id === value);

  // Group addresses by domain
  const groupedAddresses = addresses.reduce(
    (acc, addr) => {
      if (!acc[addr.domain]) {
        acc[addr.domain] = [];
      }
      acc[addr.domain].push(addr);
      return acc;
    },
    {} as Record<string, SenderAddress[]>
  );

  const formatSender = (addr: SenderAddress) => {
    return addr.name ? `${addr.name} <${addr.email}>` : addr.email;
  };

  const handleValueChange = (addressId: string) => {
    const address = addresses.find((a) => a.id === addressId);
    if (address) {
      onChange(addressId, address);
    }
  };

  if (loading) {
    return (
      <div className={cn('flex items-center gap-2 px-3 py-2 text-sm text-slate-500 border border-slate-200 dark:border-slate-700 rounded-md', className)}>
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading senders...
      </div>
    );
  }

  if (error) {
    return (
      <button
        type="button"
        onClick={fetchAddresses}
        className={cn('flex items-center gap-2 px-3 py-2 text-sm text-red-500 border border-red-200 dark:border-red-800 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20', className)}
      >
        <AlertCircle className="w-4 h-4" />
        {error} - Click to retry
      </button>
    );
  }

  if (addresses.length === 0) {
    return (
      <div className={cn('flex items-center gap-2 px-3 py-2 text-sm text-slate-500 border border-slate-200 dark:border-slate-700 rounded-md', className)}>
        <Mail className="w-4 h-4" />
        No sender addresses configured
      </div>
    );
  }

  return (
    <Select
      value={value}
      onValueChange={handleValueChange}
      disabled={disabled}
    >
      <SelectTrigger className={cn('w-full', className)}>
        <div className="flex items-center gap-2 truncate">
          <Mail className="w-4 h-4 flex-shrink-0 text-slate-400" />
          <SelectValue placeholder={placeholder}>
            {selectedAddress ? formatSender(selectedAddress) : placeholder}
          </SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent>
        {Object.entries(groupedAddresses).map(([domain, domainAddresses]) => (
          <SelectGroup key={domain}>
            <SelectLabel className="text-xs text-slate-500">{domain}</SelectLabel>
            {domainAddresses.map((addr) => (
              <SelectItem
                key={addr.id}
                value={addr.id}
                disabled={!addr.is_verified}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span>{addr.name ? `${addr.name}` : addr.email}</span>
                  {addr.is_default && (
                    <Star className="w-3 h-3 text-amber-500 fill-current" />
                  )}
                  {!addr.is_verified && (
                    <span className="text-xs text-amber-500">(Unverified)</span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

export default SenderSelector;
