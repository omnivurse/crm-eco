'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@crm-eco/ui/components/sheet';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  X,
  ExternalLink,
  Phone,
  Mail,
  CheckSquare,
  MessageSquare,
  Edit,
  User,
  Clock,
  Loader2,
} from 'lucide-react';
import { useRecordDrawer } from './RecordDrawerContext';
import { InlineField } from './InlineField';
import { RecordMiniTimeline } from './RecordMiniTimeline';
import type { CrmRecord, CrmField } from '@/lib/crm/types';

interface RecordData {
  record: CrmRecord;
  fields: CrmField[];
  timeline: Array<{
    id: string;
    type: string;
    timestamp: string;
    data: Record<string, unknown>;
  }>;
}

export function RecordDrawer() {
  const { isOpen, recordId, moduleKey, closeDrawer } = useRecordDrawer();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RecordData | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Fetch record data when drawer opens
  useEffect(() => {
    if (!isOpen || !recordId) {
      setData(null);
      return;
    }

    async function loadRecord() {
      setLoading(true);
      try {
        // Fetch record
        const { data: record } = await supabase
          .from('crm_records')
          .select('*')
          .eq('id', recordId)
          .single();

        if (!record) throw new Error('Record not found');

        // Fetch fields for module
        const { data: fields } = await supabase
          .from('crm_fields')
          .select('*')
          .eq('module_id', record.module_id)
          .order('display_order');

        // Fetch recent timeline (simplified - just notes and tasks)
        const { data: notes } = await supabase
          .from('crm_notes')
          .select('id, body, created_at, created_by')
          .eq('record_id', recordId)
          .order('created_at', { ascending: false })
          .limit(5);

        const { data: tasks } = await supabase
          .from('crm_tasks')
          .select('id, title, status, due_at, created_at')
          .eq('record_id', recordId)
          .order('created_at', { ascending: false })
          .limit(5);

        // Combine into timeline
        const timeline = [
          ...(notes || []).map(n => ({
            id: n.id,
            type: 'note' as const,
            timestamp: n.created_at,
            data: n,
          })),
          ...(tasks || []).map(t => ({
            id: t.id,
            type: 'task' as const,
            timestamp: t.created_at,
            data: t,
          })),
        ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 10);

        setData({
          record: record as CrmRecord,
          fields: (fields || []) as CrmField[],
          timeline,
        });
      } catch (error) {
        console.error('Error loading record:', error);
      } finally {
        setLoading(false);
      }
    }

    loadRecord();
  }, [isOpen, recordId, supabase]);

  const handleFieldUpdate = async (fieldKey: string, value: unknown) => {
    if (!data?.record) return;

    try {
      const updatedData = { ...data.record.data, [fieldKey]: value };
      
      await supabase
        .from('crm_records')
        .update({ data: updatedData })
        .eq('id', data.record.id);

      setData(prev => prev ? {
        ...prev,
        record: { ...prev.record, data: updatedData },
      } : null);
    } catch (error) {
      console.error('Error updating field:', error);
      throw error;
    }
  };

  // Build display name
  const getDisplayName = () => {
    if (!data?.record) return 'Loading...';
    const firstName = data.record.data?.first_name || '';
    const lastName = data.record.data?.last_name || '';
    return [firstName, lastName].filter(Boolean).join(' ') || data.record.title || 'Untitled';
  };

  // Get key fields to display (first 6 non-system fields)
  const keyFields = data?.fields
    .filter(f => !f.is_system && f.key !== 'first_name' && f.key !== 'last_name')
    .slice(0, 6) || [];

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeDrawer()}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-lg p-0 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-white/10"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
          </div>
        ) : data ? (
          <div className="flex flex-col h-full">
            {/* Header */}
            <SheetHeader className="p-4 border-b border-slate-200 dark:border-white/10">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <SheetTitle className="text-lg font-semibold text-slate-900 dark:text-white truncate">
                    {getDisplayName()}
                  </SheetTitle>
                  <div className="flex items-center gap-2 mt-1">
                    {data.record.status && (
                      <Badge variant="outline" className="text-xs">
                        {data.record.status}
                      </Badge>
                    )}
                    {data.record.owner_id && (
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <User className="w-3 h-3" />
                        Assigned
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-slate-500" suppressHydrationWarning>
                      <Clock className="w-3 h-3" />
                      {new Date(data.record.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    asChild
                    className="h-8 w-8 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  >
                    <Link href={`/crm/r/${data.record.id}`}>
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={closeDrawer}
                    className="h-8 w-8 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </SheetHeader>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 p-4 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-9 text-xs border-slate-200 dark:border-white/10"
              >
                <CheckSquare className="w-3.5 h-3.5 mr-1.5" />
                Add Task
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-9 text-xs border-slate-200 dark:border-white/10"
              >
                <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                Add Note
              </Button>
              {data.record.phone && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs border-slate-200 dark:border-white/10"
                  asChild
                >
                  <a href={`tel:${data.record.phone}`}>
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                </Button>
              )}
              {data.record.email && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs border-slate-200 dark:border-white/10"
                  asChild
                >
                  <a href={`mailto:${data.record.email}`}>
                    <Mail className="w-3.5 h-3.5" />
                  </a>
                </Button>
              )}
            </div>

            {/* Key Fields */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-4">
                <h3 className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
                  <Edit className="w-4 h-4" />
                  Key Information
                </h3>
                <div className="space-y-3">
                  {keyFields.map((field) => (
                    <InlineField
                      key={field.id}
                      field={field}
                      value={data.record.data?.[field.key]}
                      onSave={(value) => handleFieldUpdate(field.key, value)}
                    />
                  ))}
                </div>
              </div>

              {/* Mini Timeline */}
              <div className="p-4 border-t border-slate-200 dark:border-white/10">
                <h3 className="text-sm font-medium text-slate-900 dark:text-white mb-3">
                  Recent Activity
                </h3>
                <RecordMiniTimeline events={data.timeline} />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50">
              <Button
                className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white"
                asChild
              >
                <Link href={`/crm/r/${data.record.id}`}>
                  View Full Record
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500">
            No record selected
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
