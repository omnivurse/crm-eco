'use client';

/**
 * DependentCoveragePanel — shared timeline of family-member add/remove coverage
 * periods for a linked membership (by member_id), with staff edit controls when
 * `readOnly` is false (default).
 *
 * This is the single source of truth for the panel that previously lived,
 * near-identically, in both the admin Member Command Center
 * (AdminDependentCoveragePanel) and the CRM record shell (DependentCoverageHistory).
 * The two apps differed only in (a) which Supabase browser client they use — CRM
 * deliberately injects its singleton client to avoid WebSocket/request explosion,
 * admin injects lib's createClient() — (b) which server actions back the writes,
 * and (c) whether a post-write refresh runs. All three are injected as props:
 *
 *   supabase   — the app's browser client (reads coverage periods + dependents)
 *   actions    — the four staff coverage server actions (service-role conduits)
 *   onChanged  — optional callback run after a successful mutation (e.g. router.refresh)
 *
 * Each app keeps a thin same-named wrapper that supplies these, so call sites and
 * import paths are unchanged. billingError is ALWAYS surfaced (never swallowed) —
 * the writes recalc billing best-effort and report drift via billingError.
 */

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Users,
  UserPlus,
  UserMinus,
  CalendarDays,
  Loader2,
  History,
  Plus,
  MoreHorizontal,
} from 'lucide-react';
import { Badge } from '@crm-eco/ui/components/badge';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Textarea } from '@crm-eco/ui/components/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { cn } from '@crm-eco/ui/lib/utils';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  COVERAGE_REASONS,
  formatCoverageDateRange,
  formatCoverageReason,
  isDependentCurrentlyCovered,
} from '@crm-eco/lib';
import type {
  DependentCoveragePeriod,
  staffAddDependentWithCoverage,
  staffStartDependentCoverage,
  staffEndDependentCoverage,
  staffLogHistoricalCoveragePeriod,
} from '@crm-eco/lib';

interface PeriodWithDependent extends DependentCoveragePeriod {
  dependent?: {
    first_name: string;
    last_name: string;
    relationship: string;
  } | null;
}

interface MemberDependent {
  id: string;
  first_name: string;
  last_name: string;
  relationship: string;
  date_of_birth: string | null;
  included_in_enrollment: boolean | null;
}

type CoverageActionMode = 'start' | 'end' | 'log_historical';

/**
 * Minimal result the panel reads from each injected action. The app-side staff
 * actions return a richer StaffActionResult (which has these fields plus `data`),
 * so they satisfy this structurally without any adaptation.
 */
export interface CoverageActionResult {
  success: boolean;
  error?: string;
  billing?: { previousAmount: number; newAmount: number };
  billingError?: string;
}

/**
 * The four staff coverage writes the panel invokes. Input shapes are taken
 * directly from the canonical lib staff functions so the admin/crm server-action
 * wrappers (which delegate to exactly those) are assignable with no glue.
 */
export interface DependentCoverageActions {
  addDependent: (
    input: Parameters<typeof staffAddDependentWithCoverage>[1],
  ) => Promise<CoverageActionResult>;
  startCoverage: (
    input: Parameters<typeof staffStartDependentCoverage>[1],
  ) => Promise<CoverageActionResult>;
  endCoverage: (
    input: Parameters<typeof staffEndDependentCoverage>[1],
  ) => Promise<CoverageActionResult>;
  logHistorical: (
    input: Parameters<typeof staffLogHistoricalCoveragePeriod>[1],
  ) => Promise<CoverageActionResult>;
}

export interface DependentCoveragePanelProps {
  memberId: string;
  /** The app's Supabase browser client (CRM injects its singleton). */
  supabase: SupabaseClient;
  /** Staff coverage server actions (service-role conduits). */
  actions: DependentCoverageActions;
  /** Run after a successful mutation, e.g. () => router.refresh(). */
  onChanged?: () => void;
  className?: string;
  /** When true, hides staff edit controls (timeline only). */
  readOnly?: boolean;
}

function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), 'MMM d, yyyy');
  } catch {
    return iso;
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function PeriodEntry({ period }: { period: PeriodWithDependent }) {
  const isOpen = !period.effective_to;
  const name = period.dependent
    ? `${period.dependent.first_name} ${period.dependent.last_name}`
    : 'Unknown dependent';

  return (
    <div className="relative flex gap-3">
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
          isOpen ? 'bg-emerald-500/10' : 'bg-slate-500/10',
        )}
      >
        {isOpen ? (
          <UserPlus className="w-4 h-4 text-emerald-500" />
        ) : (
          <UserMinus className="w-4 h-4 text-slate-500" />
        )}
      </div>
      <div className="flex-1 min-w-0 pb-5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-900 dark:text-white">{name}</span>
          {period.dependent?.relationship && (
            <Badge variant="outline" className="text-[10px] capitalize">
              {period.dependent.relationship}
            </Badge>
          )}
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] uppercase tracking-wide',
              isOpen ? 'text-emerald-600 border-emerald-500/30' : 'text-slate-500',
            )}
          >
            {isOpen ? 'On plan' : 'Ended'}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
          <CalendarDays className="w-3 h-3" />
          {formatCoverageDateRange(period.effective_from, period.effective_to)}
        </p>
        {period.reason && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 italic">
            {formatCoverageReason(period.reason)}
            {period.notes ? ` — ${period.notes}` : ''}
          </p>
        )}
        <p className="mt-0.5 text-[10px] text-slate-400">
          Logged {formatDate(period.created_at)} · {period.source}
        </p>
      </div>
    </div>
  );
}

export const DependentCoveragePanel = memo(function DependentCoveragePanel({
  memberId,
  supabase,
  actions,
  onChanged,
  className,
  readOnly = false,
}: DependentCoveragePanelProps) {
  const [periods, setPeriods] = useState<PeriodWithDependent[]>([]);
  const [dependents, setDependents] = useState<MemberDependent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    gender: '',
    relationship: 'child',
    coverage_start_date: todayIso(),
  });

  const [coverageAction, setCoverageAction] = useState<{
    dependent: MemberDependent;
    mode: CoverageActionMode;
  } | null>(null);
  const [coverageForm, setCoverageForm] = useState({
    date: todayIso(),
    endDate: '',
    reason: '',
    notes: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [periodsRes, dependentsRes] = await Promise.all([
      supabase
        .from('dependent_coverage_periods')
        .select(
          `
          *,
          dependent:dependents!dependent_coverage_periods_dependent_id_fkey (
            first_name, last_name, relationship
          )
        `,
        )
        .eq('member_id', memberId)
        .order('effective_from', { ascending: false }),
      supabase
        .from('dependents')
        .select('id, first_name, last_name, relationship, date_of_birth, included_in_enrollment')
        .eq('member_id', memberId)
        .is('deleted_at' as never, null)
        .order('first_name'),
    ]);

    if (periodsRes.error) {
      setError(periodsRes.error.message);
      setPeriods([]);
    } else {
      setPeriods((periodsRes.data ?? []) as PeriodWithDependent[]);
    }

    if (!dependentsRes.error) {
      setDependents((dependentsRes.data ?? []) as MemberDependent[]);
    }

    setLoading(false);
  }, [memberId, supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const sorted = useMemo(
    () => [...periods].sort((a, b) => b.effective_from.localeCompare(a.effective_from)),
    [periods],
  );

  const periodRows = useMemo(
    () =>
      periods.map((p) => ({
        dependent_id: p.dependent_id,
        effective_from: p.effective_from,
        effective_to: p.effective_to,
      })),
    [periods],
  );

  const isCurrentlyCovered = useCallback(
    (dependent: MemberDependent) =>
      isDependentCurrentlyCovered(dependent.id, periodRows, dependent.included_in_enrollment),
    [periodRows],
  );

  const coveredCount = useMemo(
    () => dependents.filter((d) => isCurrentlyCovered(d)).length,
    [dependents, isCurrentlyCovered],
  );

  const openCoverageAction = (dependent: MemberDependent, mode: CoverageActionMode) => {
    setCoverageAction({ dependent, mode });
    const today = todayIso();
    setCoverageForm({
      date: today,
      endDate: mode === 'log_historical' ? today : '',
      reason:
        mode === 'end' ? 'manual_removal' : mode === 'start' ? 'resumed' : 'historical_period',
      notes: '',
    });
  };

  const closeCoverageAction = () => {
    setCoverageAction(null);
    setCoverageForm({ date: '', endDate: '', reason: '', notes: '' });
  };

  const formatBillingToast = (billing?: { previousAmount: number; newAmount: number }) => {
    if (!billing || billing.previousAmount === billing.newAmount) return '';
    return ` Billing updated: $${billing.previousAmount.toFixed(2)} → $${billing.newAmount.toFixed(2)}/mo.`;
  };

  const afterSuccess = async () => {
    closeCoverageAction();
    await loadData();
    onChanged?.();
  };

  const handleCoverageActionSave = async () => {
    if (!coverageAction) return;
    const { dependent, mode } = coverageAction;
    setSaving(true);

    try {
      let result: CoverageActionResult;
      if (mode === 'end') {
        result = await actions.endCoverage({
          member_id: memberId,
          dependent_id: dependent.id,
          effective_to: coverageForm.date,
          reason: coverageForm.reason,
          notes: coverageForm.notes,
        });
        if (result.success) {
          toast.success(
            `Coverage ended for ${dependent.first_name}${formatBillingToast(result.billing)}`,
          );
        }
      } else if (mode === 'start') {
        result = await actions.startCoverage({
          member_id: memberId,
          dependent_id: dependent.id,
          effective_from: coverageForm.date,
          reason: coverageForm.reason,
          notes: coverageForm.notes,
        });
        if (result.success) {
          toast.success(
            `Coverage started for ${dependent.first_name}${formatBillingToast(result.billing)}`,
          );
        }
      } else {
        if (!coverageForm.endDate) {
          toast.error('End date is required for a historical period');
          setSaving(false);
          return;
        }
        result = await actions.logHistorical({
          member_id: memberId,
          dependent_id: dependent.id,
          effective_from: coverageForm.date,
          effective_to: coverageForm.endDate,
          reason: coverageForm.reason,
          notes: coverageForm.notes,
        });
        if (result.success) {
          toast.success(`Historical period logged${formatBillingToast(result.billing)}`);
        }
      }

      if (result && !result.success) {
        toast.error(result.error ?? 'Failed to record coverage change');
      } else if (result?.success) {
        if (result.billingError) {
          toast.warning(
            `Coverage saved, but billing may be briefly out of date: ${result.billingError}`,
          );
        }
        await afterSuccess();
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to record coverage change');
    } finally {
      setSaving(false);
    }
  };

  const handleAddDependent = async () => {
    if (!addForm.first_name.trim() || !addForm.last_name.trim() || !addForm.date_of_birth) {
      toast.error('First name, last name, and date of birth are required');
      return;
    }

    setSaving(true);
    try {
      const result = await actions.addDependent({
        member_id: memberId,
        first_name: addForm.first_name,
        last_name: addForm.last_name,
        date_of_birth: addForm.date_of_birth,
        gender: addForm.gender || undefined,
        relationship: addForm.relationship,
        coverage_start_date: addForm.coverage_start_date,
      });

      if (!result.success) {
        toast.error(result.error ?? 'Failed to add dependent');
      } else {
        toast.success(`Dependent added${formatBillingToast(result.billing)}`);
        if (result.billingError) {
          toast.warning(
            `Dependent added, but billing may be briefly out of date: ${result.billingError}`,
          );
        }
        setAddDialogOpen(false);
        setAddForm({
          first_name: '',
          last_name: '',
          date_of_birth: '',
          gender: '',
          relationship: 'child',
          coverage_start_date: todayIso(),
        });
        await loadData();
        onChanged?.();
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to add dependent');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40',
        className,
      )}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white/5">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-sky-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Family Coverage History
          </h3>
          {sorted.length > 0 && (
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 bg-slate-100 dark:bg-white/10 text-slate-500"
            >
              {sorted.length}
            </Badge>
          )}
          {dependents.length > 0 && (
            <Badge variant="outline" className="text-[10px] text-emerald-600">
              {coveredCount} covered now
            </Badge>
          )}
        </div>
        {!readOnly && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            onClick={() => setAddDialogOpen(true)}
          >
            <Plus className="w-3 h-3" />
            Add dependent
          </Button>
        )}
      </div>

      {!readOnly && dependents.length > 0 && (
        <div className="px-4 py-2 border-b border-slate-100 dark:border-white/5 flex flex-wrap gap-2">
          {dependents.map((dep) => (
            <div
              key={dep.id}
              className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-white/10 px-2 py-1"
            >
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                {dep.first_name} {dep.last_name}
              </span>
              <Badge
                variant="outline"
                className={cn(
                  'text-[9px] capitalize',
                  isCurrentlyCovered(dep) ? 'text-emerald-600' : 'text-slate-400',
                )}
              >
                {isCurrentlyCovered(dep) ? 'on plan' : 'off'}
              </Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <MoreHorizontal className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isCurrentlyCovered(dep) ? (
                    <DropdownMenuItem onClick={() => openCoverageAction(dep, 'end')}>
                      End coverage…
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => openCoverageAction(dep, 'start')}>
                      Add to coverage…
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => openCoverageAction(dep, 'log_historical')}>
                    Log historical period…
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}

      <div className="px-4 py-3">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : error ? (
          <p className="text-sm text-rose-500 py-4">{error}</p>
        ) : sorted.length === 0 ? (
          <div className="text-center py-6">
            <History className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No family coverage periods recorded for this member.
            </p>
            {!readOnly && (
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => setAddDialogOpen(true)}
              >
                Add first dependent
              </Button>
            )}
          </div>
        ) : (
          <div className="relative">
            {sorted.length > 1 && (
              <div className="absolute left-[15px] top-8 bottom-5 w-px bg-slate-200 dark:bg-white/10" />
            )}
            {sorted.map((period) => (
              <PeriodEntry key={period.id} period={period} />
            ))}
          </div>
        )}
      </div>

      {!readOnly && (
        <>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add dependent with coverage</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 py-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="First name"
                    value={addForm.first_name}
                    onChange={(e) => setAddForm((f) => ({ ...f, first_name: e.target.value }))}
                  />
                  <Input
                    placeholder="Last name"
                    value={addForm.last_name}
                    onChange={(e) => setAddForm((f) => ({ ...f, last_name: e.target.value }))}
                  />
                </div>
                <Input
                  type="date"
                  value={addForm.date_of_birth}
                  onChange={(e) => setAddForm((f) => ({ ...f, date_of_birth: e.target.value }))}
                />
                <Select
                  value={addForm.relationship}
                  onValueChange={(v) => setAddForm((f) => ({ ...f, relationship: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Relationship" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="spouse">Spouse</SelectItem>
                    <SelectItem value="child">Child</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Coverage start date</label>
                  <Input
                    type="date"
                    value={addForm.coverage_start_date}
                    onChange={(e) =>
                      setAddForm((f) => ({ ...f, coverage_start_date: e.target.value }))
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddDependent} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add dependent'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={!!coverageAction} onOpenChange={(open) => !open && closeCoverageAction()}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {coverageAction?.mode === 'end'
                    ? 'End coverage'
                    : coverageAction?.mode === 'start'
                      ? 'Start coverage'
                      : 'Log historical period'}
                  {coverageAction?.dependent
                    ? ` — ${coverageAction.dependent.first_name} ${coverageAction.dependent.last_name}`
                    : ''}
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 py-2">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">
                    {coverageAction?.mode === 'end' ? 'End date' : 'Start date'}
                  </label>
                  <Input
                    type="date"
                    value={coverageForm.date}
                    onChange={(e) => setCoverageForm((f) => ({ ...f, date: e.target.value }))}
                  />
                </div>
                {coverageAction?.mode === 'log_historical' && (
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">End date</label>
                    <Input
                      type="date"
                      value={coverageForm.endDate}
                      onChange={(e) => setCoverageForm((f) => ({ ...f, endDate: e.target.value }))}
                    />
                  </div>
                )}
                <Select
                  value={coverageForm.reason}
                  onValueChange={(v) => setCoverageForm((f) => ({ ...f, reason: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {COVERAGE_REASONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {formatCoverageReason(r)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  placeholder="Notes (optional)"
                  value={coverageForm.notes}
                  onChange={(e) => setCoverageForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeCoverageAction}>
                  Cancel
                </Button>
                <Button onClick={handleCoverageActionSave} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
});
