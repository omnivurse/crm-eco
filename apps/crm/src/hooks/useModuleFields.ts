'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase-client';
import { queryKeys } from '@/lib/query-keys';
import type { CrmField } from '@/lib/crm/types';

/**
 * Centralized hook for fetching module fields
 *
 * IMPORTANT: All components needing field data should use this hook
 * instead of making direct Supabase queries. This ensures:
 * - Query deduplication via React Query
 * - 5-minute cache (fields rarely change)
 * - Single source of truth
 *
 * @example
 * const { fields, isLoading } = useModuleFields(moduleId);
 */
export function useModuleFields(moduleId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.fields.byModule(moduleId || ''),
    queryFn: async () => {
      if (!moduleId) return [];

      const { data, error } = await supabase
        .from('crm_fields')
        .select('*')
        .eq('module_id', moduleId)
        .order('display_order');

      if (error) throw error;
      return (data || []) as CrmField[];
    },
    enabled: !!moduleId,
    staleTime: 5 * 60_000, // 5 minutes - fields rarely change
    gcTime: 10 * 60_000, // Keep in cache for 10 minutes
  });
}

/**
 * Prefetch fields for a module (useful for hover prefetch)
 */
export function prefetchModuleFields(
  queryClient: ReturnType<typeof import('@tanstack/react-query').useQueryClient>,
  moduleId: string
) {
  return queryClient.prefetchQuery({
    queryKey: queryKeys.fields.byModule(moduleId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_fields')
        .select('*')
        .eq('module_id', moduleId)
        .order('display_order');

      if (error) throw error;
      return (data || []) as CrmField[];
    },
    staleTime: 5 * 60_000,
  });
}
