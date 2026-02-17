'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { MapPin } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import type { CrmTerritory } from '@/lib/crm/types';

interface TerritoryFilterProps {
  territories: CrmTerritory[];
  moduleKey: string;
}

/**
 * TerritoryFilter -- Dropdown for filtering records by territory.
 * Syncs selection to URL via `?territory=<id>` search param.
 */
export function TerritoryFilter({ territories, moduleKey }: TerritoryFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTerritoryId = searchParams.get('territory') || 'all';

  const handleChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === 'all') {
        params.delete('territory');
      } else {
        params.set('territory', value);
      }
      // Reset to page 1 when territory changes
      params.delete('page');
      router.push(`/crm/modules/${moduleKey}?${params.toString()}`);
    },
    [router, searchParams, moduleKey],
  );

  if (!territories.length) return null;

  return (
    <Select value={currentTerritoryId} onValueChange={handleChange}>
      <SelectTrigger className="h-9 w-[170px] text-sm rounded-lg bg-white dark:bg-slate-900/50 border-slate-200 dark:border-white/10">
        <MapPin className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
        <SelectValue placeholder="All Territories" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Territories</SelectItem>
        {territories.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            {t.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
