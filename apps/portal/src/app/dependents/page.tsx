'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import { 
  Users, 
  Plus,
  User,
  Calendar,
  Heart,
  MoreHorizontal,
  Edit,
  Trash2,
  Loader2,
  UserPlus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@crm-eco/ui/components/dialog';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import { toast } from 'sonner';

interface Dependent {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  relationship: string;
  included_in_enrollment: boolean; // source of truth from table (was historically is_covered in some UI)
  created_at: string;
  updated_at?: string;
}

/** Coverage period for a dependent on the membership. Supports back-dated historical entries. */
interface DependentCoveragePeriod {
  id: string;
  dependent_id: string;
  effective_from: string; // YYYY-MM-DD
  effective_to: string | null;
  reason: string | null;
  notes: string | null;
  source: string;
  created_at: string;
  created_by?: string | null;
}

export default function DependentsPage() {
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [periods, setPeriods] = useState<DependentCoveragePeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null); // for created_by on periods
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDependent, setEditingDependent] = useState<Dependent | null>(null);
  const [saving, setSaving] = useState(false);

  // Coverage action dialog (add to coverage / end coverage / log historical closed period)
  const [coverageAction, setCoverageAction] = useState<{
    dependent: Dependent;
    mode: 'start' | 'end' | 'log_historical';
  } | null>(null);
  const [coverageForm, setCoverageForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    endDate: '', // only for log_historical (closed range)
    reason: '',
    notes: '',
  });
  const [coverageSaving, setCoverageSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    gender: '',
    relationship: '',
    coverage_start_date: new Date().toISOString().slice(0, 10), // for new dependents
  });

  const supabase = createClient();

  const fetchDependents = useCallback(async () => {
    setLoading(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get profile to find member + profile id (for created_by attribution on periods)
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, member_id, organization_id')
      .eq('user_id', user.id)
      .single() as { data: { id: string; member_id: string; organization_id: string } | null };

    if (!profile?.member_id) {
      setLoading(false);
      return;
    }

    setMemberId(profile.member_id);
    setOrganizationId(profile.organization_id);
    setProfileId(profile.id);

    const [{ data: deps, error: depErr }, { data: per, error: perErr }] = await Promise.all([
      (supabase as any)
        .from('dependents')
        .select('*')
        .eq('member_id', profile.member_id)
        .order('created_at', { ascending: false }),
      (supabase as any)
        .from('dependent_coverage_periods')
        .select('*')
        .eq('member_id', profile.member_id)
        .order('effective_from', { ascending: false }),
    ]);

    if (!depErr && deps) setDependents(deps);
    if (!perErr && per) setPeriods(per as DependentCoveragePeriod[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    queueMicrotask(() => fetchDependents());
  }, [fetchDependents]);

  // Compute whether a dependent is currently covered based on periods (source of truth for history).
  // Falls back to the included_in_enrollment flag if no periods exist yet (migration/compat).
  const isCurrentlyCovered = (dep: Dependent): boolean => {
    const depPeriods = periods.filter((p) => p.dependent_id === dep.id);
    if (depPeriods.length === 0) {
      const flag = (dep as any).included_in_enrollment ?? (dep as any).is_covered ?? false;
      return !!flag;
    }
    const today = new Date().toISOString().slice(0, 10);
    return depPeriods.some((p) => {
      const from = p.effective_from;
      const to = p.effective_to;
      return from <= today && (to === null || to >= today);
    });
  };

  const getCoverageSince = (dep: Dependent): string | null => {
    const depPeriods = periods
      .filter((p) => p.dependent_id === dep.id)
      .sort((a, b) => (b.effective_from || '').localeCompare(a.effective_from || ''));
    const open = depPeriods.find((p) => !p.effective_to);
    return open?.effective_from ?? null;
  };

  const getCoverageHistory = (dep: Dependent): DependentCoveragePeriod[] => {
    return periods
      .filter((p) => p.dependent_id === dep.id)
      .sort((a, b) => (b.effective_from || '').localeCompare(a.effective_from || ''));
  };

  const handleOpenDialog = (dependent?: Dependent) => {
    if (dependent) {
      setEditingDependent(dependent);
      setFormData({
        first_name: dependent.first_name,
        last_name: dependent.last_name,
        date_of_birth: dependent.date_of_birth || '',
        gender: dependent.gender || '',
        relationship: dependent.relationship,
        coverage_start_date: new Date().toISOString().slice(0, 10),
      });
    } else {
      setEditingDependent(null);
      setFormData({
        first_name: '',
        last_name: '',
        date_of_birth: '',
        gender: '',
        relationship: '',
        coverage_start_date: new Date().toISOString().slice(0, 10),
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!memberId || !organizationId) return;
    
    setSaving(true);

    if (editingDependent) {
      // Update person info only (coverage changes go through coverage actions)
      const { error } = await (supabase as any)
        .from('dependents')
        .update({
          first_name: formData.first_name,
          last_name: formData.last_name,
          date_of_birth: formData.date_of_birth || null,
          gender: formData.gender || null,
          relationship: formData.relationship,
        })
        .eq('id', editingDependent.id);

      if (error) {
        toast.error('Failed to update dependent');
      } else {
        toast.success('Dependent updated successfully!');
        setDialogOpen(false);
        fetchDependents();
      }
    } else {
      // Create the person + initial coverage period (with chosen start date, supports past for back-logging).
      const startDate = formData.coverage_start_date || new Date().toISOString().slice(0, 10);

      const { data: inserted, error: insErr } = await (supabase as any)
        .from('dependents')
        .insert({
          member_id: memberId,
          organization_id: organizationId,
          first_name: formData.first_name,
          last_name: formData.last_name,
          date_of_birth: formData.date_of_birth || null,
          gender: formData.gender || null,
          relationship: formData.relationship,
          included_in_enrollment: true,
        })
        .select('id')
        .single();

      if (insErr || !inserted?.id) {
        toast.error('Failed to add dependent');
      } else {
        // Record the initial coverage period (the durable history record).
        const { error: perErr } = await (supabase as any)
          .from('dependent_coverage_periods')
          .insert({
            organization_id: organizationId,
            member_id: memberId,
            dependent_id: inserted.id,
            effective_from: startDate,
            effective_to: null,
            reason: 'initial_enrollment',
            notes: null,
            source: 'portal',
            created_by: profileId,
          });

        if (perErr) {
          // Dependent exists; period is nice-to-have but not fatal for the add.
          toast.success('Dependent added (coverage period will appear after refresh)');
        } else {
          toast.success('Dependent added successfully!');
        }
        setDialogOpen(false);
        fetchDependents();
      }
    }

    setSaving(false);
  };

  // --- Coverage period actions (the core of the requested feature) -------------

  const openCoverageAction = (dependent: Dependent, mode: 'start' | 'end' | 'log_historical') => {
    setCoverageAction({ dependent, mode });
    const today = new Date().toISOString().slice(0, 10);
    setCoverageForm({
      date: today,
      endDate: mode === 'log_historical' ? today : '',
      reason: mode === 'end' ? 'manual_removal' : (mode === 'start' ? 'resumed' : 'historical_period'),
      notes: '',
    });
  };

  const closeCoverageAction = () => {
    setCoverageAction(null);
    setCoverageForm({ date: '', endDate: '', reason: '', notes: '' });
  };

  const handleCoverageActionSave = async () => {
    if (!coverageAction || !memberId || !organizationId) return;
    const { dependent, mode } = coverageAction;

    setCoverageSaving(true);

    try {
      if (mode === 'end') {
        // End current coverage as of chosen date (back-datable).
        // 1. Close any open period(s) for this dependent.
        const openPeriods = periods.filter(
          (p) => p.dependent_id === dependent.id && !p.effective_to
        );
        for (const p of openPeriods) {
          await (supabase as any)
            .from('dependent_coverage_periods')
            .update({ effective_to: coverageForm.date })
            .eq('id', p.id);
        }
        // 2. Flip the current flag on the dependent (compat for existing queries/billing).
        await (supabase as any)
          .from('dependents')
          .update({ included_in_enrollment: false })
          .eq('id', dependent.id);

        toast.success(`Coverage ended for ${dependent.first_name} as of ${coverageForm.date}`);
      } else if (mode === 'start') {
        // Start/resume coverage (can be back-dated).
        await (supabase as any)
          .from('dependent_coverage_periods')
          .insert({
            organization_id: organizationId,
            member_id: memberId,
            dependent_id: dependent.id,
            effective_from: coverageForm.date,
            effective_to: null,
            reason: coverageForm.reason || 'resumed',
            notes: coverageForm.notes || null,
            source: 'portal',
            created_by: profileId,
          });

        await (supabase as any)
          .from('dependents')
          .update({ included_in_enrollment: true })
          .eq('id', dependent.id);

        toast.success(`Coverage started for ${dependent.first_name} as of ${coverageForm.date}`);
      } else if (mode === 'log_historical') {
        // Pure historical closed period (e.g. summer 2025 on, then off). Does not change "current".
        if (!coverageForm.endDate) {
          toast.error('End date is required for a historical (closed) period');
          setCoverageSaving(false);
          return;
        }
        await (supabase as any)
          .from('dependent_coverage_periods')
          .insert({
            organization_id: organizationId,
            member_id: memberId,
            dependent_id: dependent.id,
            effective_from: coverageForm.date,
            effective_to: coverageForm.endDate,
            reason: coverageForm.reason || 'historical_period',
            notes: coverageForm.notes || null,
            source: 'portal',
            created_by: profileId,
          });

        toast.success('Historical coverage period logged');
      }

      closeCoverageAction();
      fetchDependents();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to record coverage change');
    } finally {
      setCoverageSaving(false);
    }
  };

  const handlePurgeDependent = async (dependent: Dependent) => {
    if (
      !confirm(
        `Permanently delete the record for ${dependent.first_name} ${dependent.last_name}? ` +
          `This removes the person and ALL their coverage history. Prefer "End coverage" for normal use.`
      )
    ) {
      return;
    }

    const { error } = await (supabase as any).from('dependents').delete().eq('id', dependent.id);

    if (error) {
      toast.error('Failed to remove dependent record');
    } else {
      toast.success('Dependent record purged (including history)');
      fetchDependents();
    }
  };

  // handleDelete removed — normal "remove" is now "End coverage" (preserves history).
  // Full purge of the person record (and cascaded periods) is available as "Purge record" in the menu with strong warning.

  const calculateAge = (dob: string | null) => {
    if (!dob) return null;
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const getRelationshipIcon = (relationship: string) => {
    switch (relationship.toLowerCase()) {
      case 'spouse': return <Heart className="h-4 w-4 text-pink-500" />;
      case 'child': return <User className="h-4 w-4 text-blue-500" />;
      default: return <User className="h-4 w-4 text-slate-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Dependents</h1>
          <p className="text-slate-500">Manage family members on your plan</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Dependent
        </Button>
      </div>

      {dependents.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Users className="h-16 w-16 mx-auto mb-4 text-slate-300" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">No Dependents</h2>
            <p className="text-slate-500 mb-6 max-w-md mx-auto">
              You haven't added any dependents to your membership yet. 
              Add your spouse or children to include them in your coverage.
            </p>
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Add Your First Dependent
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dependents.map((dependent) => (
            <Card key={dependent.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                      <User className="h-6 w-6 text-slate-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {dependent.first_name} {dependent.last_name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        {getRelationshipIcon(dependent.relationship)}
                        <span className="text-sm text-slate-500 capitalize">
                          {dependent.relationship}
                        </span>
                        {dependent.date_of_birth && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="text-sm text-slate-500">
                              Age {calculateAge(dependent.date_of_birth)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenDialog(dependent)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit info
                      </DropdownMenuItem>
                      {isCurrentlyCovered(dependent) ? (
                        <DropdownMenuItem onClick={() => openCoverageAction(dependent, 'end')}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          End coverage…
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => openCoverageAction(dependent, 'start')}>
                          <UserPlus className="mr-2 h-4 w-4" />
                          Add to coverage…
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => openCoverageAction(dependent, 'log_historical')}>
                        <Calendar className="mr-2 h-4 w-4" />
                        Log historical period…
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handlePurgeDependent(dependent)}
                        className="text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Purge record (and history)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="mt-4 pt-4 border-t flex items-center justify-between">
                  <div className="text-sm text-slate-500">
                    {dependent.gender && <span className="capitalize">{dependent.gender}</span>}
                    {dependent.date_of_birth && (
                      <>
                        <span className="mx-2">•</span>
                        <span>Born {new Date(dependent.date_of_birth).toLocaleDateString()}</span>
                      </>
                    )}
                  </div>
                  <Badge variant={isCurrentlyCovered(dependent) ? 'default' : 'secondary'}>
                    {isCurrentlyCovered(dependent) ? 'Currently covered' : 'Not on plan'}
                  </Badge>
                </div>

                {/* Coverage history / quick actions (the requested tracking) */}
                {(() => {
                  const hist = getCoverageHistory(dependent);
                  const since = getCoverageSince(dependent);
                  return (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                        <span>Coverage history</span>
                        {since && isCurrentlyCovered(dependent) && (
                          <span className="text-teal-600">Since {new Date(since).toLocaleDateString()}</span>
                        )}
                      </div>

                      {hist.length === 0 ? (
                        <div className="text-xs text-slate-400">No periods recorded yet — use the actions below to log add/remove dates (past dates supported).</div>
                      ) : (
                        <ul className="space-y-1">
                          {hist.slice(0, 3).map((p) => (
                            <li key={p.id} className="text-xs text-slate-600 flex gap-2">
                              <span className="font-mono tabular-nums text-slate-500">
                                {new Date(p.effective_from).toLocaleDateString()}
                                {p.effective_to ? ` – ${new Date(p.effective_to).toLocaleDateString()}` : ' – present'}
                              </span>
                              {p.reason && <span className="text-slate-400">· {p.reason.replace(/_/g, ' ')}</span>}
                            </li>
                          ))}
                          {hist.length > 3 && (
                            <li className="text-[10px] text-slate-400">+{hist.length - 3} more…</li>
                          )}
                        </ul>
                      )}

                      <div className="mt-2 flex flex-wrap gap-2">
                        {isCurrentlyCovered(dependent) ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => openCoverageAction(dependent, 'end')}
                          >
                            End coverage…
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => openCoverageAction(dependent, 'start')}
                          >
                            Add to coverage…
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => openCoverageAction(dependent, 'log_historical')}
                        >
                          Log historical period…
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDependent ? 'Edit Dependent' : 'Add Dependent'}
            </DialogTitle>
            <DialogDescription>
              {editingDependent 
                ? 'Update the information for this dependent.'
                : 'Add a family member to your health sharing membership.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="relationship">Relationship</Label>
              <Select 
                value={formData.relationship} 
                onValueChange={(value) => setFormData({ ...formData, relationship: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select relationship" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Spouse">Spouse</SelectItem>
                  <SelectItem value="Child">Child</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date_of_birth">Date of Birth</Label>
                <Input
                  id="date_of_birth"
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <Select 
                  value={formData.gender} 
                  onValueChange={(value) => setFormData({ ...formData, gender: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* For new dependents only: choose the coverage start date up front (supports back-dating) */}
            {!editingDependent && (
              <div className="space-y-2">
                <Label htmlFor="coverage_start_date">Coverage start date</Label>
                <Input
                  id="coverage_start_date"
                  type="date"
                  value={formData.coverage_start_date}
                  onChange={(e) => setFormData({ ...formData, coverage_start_date: e.target.value })}
                />
                <p className="text-[11px] text-slate-500">
                  Use today for normal adds, or a past date to log historical coverage from the start.
                </p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={saving || !formData.first_name || !formData.last_name || !formData.relationship}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                editingDependent ? 'Update' : 'Add Dependent'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Coverage action dialog (add/end/log historical with explicit dates — back-dating supported) */}
      <Dialog open={!!coverageAction} onOpenChange={(o) => !o && closeCoverageAction()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {coverageAction?.mode === 'end' && 'End coverage'}
              {coverageAction?.mode === 'start' && 'Add / resume coverage'}
              {coverageAction?.mode === 'log_historical' && 'Log historical coverage period'}
            </DialogTitle>
            <DialogDescription>
              {coverageAction && (
                <>
                  For <span className="font-medium">{coverageAction.dependent.first_name} {coverageAction.dependent.last_name}</span>.
                  Dates can be in the past to record school, summer work, or corrections.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{coverageAction?.mode === 'end' ? 'Coverage end date' : 'Start date'}</Label>
                <Input
                  type="date"
                  value={coverageForm.date}
                  onChange={(e) => setCoverageForm({ ...coverageForm, date: e.target.value })}
                />
              </div>

              {coverageAction?.mode === 'log_historical' && (
                <div className="space-y-2">
                  <Label>End date (for closed historical period)</Label>
                  <Input
                    type="date"
                    value={coverageForm.endDate}
                    onChange={(e) => setCoverageForm({ ...coverageForm, endDate: e.target.value })}
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Select
                value={coverageForm.reason}
                onValueChange={(v) => setCoverageForm({ ...coverageForm, reason: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="initial_enrollment">Initial enrollment</SelectItem>
                  <SelectItem value="resumed">Resumed / returned</SelectItem>
                  <SelectItem value="school_break">School break (on)</SelectItem>
                  <SelectItem value="summer_employment">Summer employment (off)</SelectItem>
                  <SelectItem value="age_out">Age-out / eligibility change</SelectItem>
                  <SelectItem value="marriage">Marriage / new dependent status</SelectItem>
                  <SelectItem value="manual_removal">Manual removal / plan change</SelectItem>
                  <SelectItem value="historical_period">Historical / back-dated period</SelectItem>
                  <SelectItem value="correction">Data correction</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input
                value={coverageForm.notes}
                onChange={(e) => setCoverageForm({ ...coverageForm, notes: e.target.value })}
                placeholder="e.g. Returned after summer job at camp"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={closeCoverageAction} disabled={coverageSaving}>
              Cancel
            </Button>
            <Button onClick={handleCoverageActionSave} disabled={coverageSaving || !coverageForm.date}>
              {coverageSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {coverageAction?.mode === 'end' ? 'End coverage' : 'Save period'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
