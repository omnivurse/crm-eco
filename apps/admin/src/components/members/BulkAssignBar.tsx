'use client';

import { CircleNotch, UserCheck, X } from '@phosphor-icons/react';
import { useState, useEffect, useCallback } from 'react';
import { Button, Combobox, type ComboboxOption } from '@crm-eco/ui';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@crm-eco/ui';
import { createClient } from '@crm-eco/lib/supabase/client';
import { toast } from 'sonner';
interface BulkAssignBarProps {
  selectedIds: string[];
  onClearSelection: () => void;
  onAssignComplete: () => void;
  orgId: string;
}

const UNASSIGNED_VALUE = '__unassigned__';

export function BulkAssignBar({
  selectedIds,
  onClearSelection,
  onAssignComplete,
  orgId,
}: BulkAssignBarProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [advisorOptions, setAdvisorOptions] = useState<ComboboxOption[]>([]);
  const [selectedAdvisor, setSelectedAdvisor] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  const fetchAdvisors = useCallback(async () => {
    setFetching(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('advisors')
        .select('id, first_name, last_name, email')
        .eq('organization_id', orgId)
        .order('last_name', { ascending: true });

      if (error) throw error;

      const options: ComboboxOption[] = [
        { value: UNASSIGNED_VALUE, label: 'Unassigned (clear advisor)' },
        ...(data ?? []).map((a) => ({
          value: a.id,
          label: `${a.first_name} ${a.last_name}`,
          subtext: a.email ?? undefined,
        })),
      ];

      setAdvisorOptions(options);
    } catch {
      toast.error('Failed to load advisors');
    } finally {
      setFetching(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (dialogOpen) {
      setSelectedAdvisor('');
      fetchAdvisors();
    }
  }, [dialogOpen, fetchAdvisors]);

  if (selectedIds.length === 0) return null;

  const handleApply = async () => {
    if (!selectedAdvisor) return;

    setLoading(true);
    try {
      const supabase = createClient();
      const advisorId = selectedAdvisor === UNASSIGNED_VALUE ? null : selectedAdvisor;

      const { error } = await supabase
        .from('members')
        .update({ advisor_id: advisorId })
        .in('id', selectedIds);

      if (error) throw error;

      const advisorLabel =
        selectedAdvisor === UNASSIGNED_VALUE
          ? 'unassigned'
          : advisorOptions.find((o) => o.value === selectedAdvisor)?.label ?? 'selected advisor';

      toast.success(
        `${selectedIds.length} member${selectedIds.length === 1 ? '' : 's'} assigned to ${advisorLabel}`
      );

      setDialogOpen(false);
      onClearSelection();
      onAssignComplete();
    } catch {
      toast.error('Failed to update member assignments');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 shadow-lg">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <p className="text-sm font-medium text-slate-700">
            <span className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-semibold mr-2">
              {selectedIds.length}
            </span>
            member{selectedIds.length === 1 ? '' : 's'} selected
          </p>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClearSelection}>
              <X weight="light" className="h-4 w-4 mr-1" />
              Clear
            </Button>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <UserCheck weight="light" className="h-4 w-4 mr-1" />
              Assign Advisor
            </Button>
          </div>
        </div>
      </div>

      {/* Assign dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent aria-describedby="bulk-assign-description">
          <DialogHeader>
            <DialogTitle>Assign Advisor</DialogTitle>
            <DialogDescription id="bulk-assign-description">
              Choose an advisor to assign to {selectedIds.length} selected member
              {selectedIds.length === 1 ? '' : 's'}.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {fetching ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <CircleNotch weight="light" className="h-4 w-4 animate-spin mr-2" />
                Loading advisors...
              </div>
            ) : (
              <Combobox
                options={advisorOptions}
                value={selectedAdvisor}
                onValueChange={setSelectedAdvisor}
                placeholder="Select an advisor..."
                searchPlaceholder="Search advisors..."
                emptyText="No advisors found."
                clearable={false}
              />
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleApply} disabled={!selectedAdvisor || loading}>
              {loading && <CircleNotch weight="light" className="h-4 w-4 animate-spin mr-2" />}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
