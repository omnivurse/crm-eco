import { getQueryClient } from '@/components/providers/QueryProvider';
import { queryKeys } from '@/lib/query-keys';
import { createBrowserClient } from '@supabase/ssr';

// Singleton Supabase client for prefetching
let supabaseClient: ReturnType<typeof createBrowserClient> | null = null;

function getSupabase() {
  if (!supabaseClient) {
    supabaseClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return supabaseClient;
}

/**
 * Prefetch record data for the drawer on row hover
 * Uses staleTime so it won't refetch if data is fresh
 */
export async function prefetchRecordForDrawer(recordId: string) {
  const queryClient = getQueryClient();
  const supabase = getSupabase();

  // Check if already in cache and fresh
  const existingData = queryClient.getQueryData(queryKeys.records.detail(recordId));
  if (existingData) {
    // Already cached, no need to prefetch
    return;
  }

  // Prefetch the record
  await queryClient.prefetchQuery({
    queryKey: queryKeys.records.detail(recordId),
    queryFn: async () => {
      const { data } = await supabase
        .from('crm_records')
        .select('*')
        .eq('id', recordId)
        .single();
      return data;
    },
    staleTime: 30_000, // 30 seconds
  });

  // Get the record to know the module_id for field prefetching
  const record = queryClient.getQueryData<{ module_id: string }>(
    queryKeys.records.detail(recordId)
  );

  if (record?.module_id) {
    // Prefetch fields (these are heavily cached)
    queryClient.prefetchQuery({
      queryKey: queryKeys.fields.byModule(record.module_id),
      queryFn: async () => {
        const { data } = await supabase
          .from('crm_fields')
          .select('*')
          .eq('module_id', record.module_id)
          .order('display_order');
        return data || [];
      },
      staleTime: 5 * 60_000, // 5 minutes
    });

    // Prefetch timeline in parallel
    queryClient.prefetchQuery({
      queryKey: queryKeys.timeline.byRecord(recordId),
      queryFn: async () => {
        const [notesResult, tasksResult] = await Promise.all([
          supabase
            .from('crm_notes')
            .select('id, body, created_at, created_by')
            .eq('record_id', recordId)
            .order('created_at', { ascending: false })
            .limit(5),
          supabase
            .from('crm_tasks')
            .select('id, title, status, due_at, created_at')
            .eq('record_id', recordId)
            .order('created_at', { ascending: false })
            .limit(5),
        ]);

        const notes = (notesResult.data || []).map((n) => ({
          id: n.id,
          type: 'note' as const,
          timestamp: n.created_at,
          data: n,
        }));

        const tasks = (tasksResult.data || []).map((t) => ({
          id: t.id,
          type: 'task' as const,
          timestamp: t.created_at,
          data: t,
        }));

        return [...notes, ...tasks]
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 10);
      },
      staleTime: 10_000, // 10 seconds
    });
  }
}
