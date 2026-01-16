'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Switch,
} from '@crm-eco/ui';
import { Loader2, Save, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
// Commission tier type (tables may not be in generated types yet)
interface CommissionTier {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  level: number;
  base_rate_pct: number;
  bonus_rate_pct: number | null;
  override_rate_pct: number | null;
  min_personal_production: number | null;
  min_team_production: number | null;
  min_active_members: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const tierFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required').max(20, 'Code must be 20 characters or less'),
  level: z.number().min(1, 'Level must be at least 1').max(99, 'Level must be less than 100'),
  base_rate_pct: z.number().min(0, 'Rate cannot be negative').max(100, 'Rate cannot exceed 100%'),
  bonus_rate_pct: z.number().min(0).max(100).optional(),
  override_rate_pct: z.number().min(0).max(100).optional(),
  min_personal_production: z.number().min(0).optional(),
  min_team_production: z.number().min(0).optional(),
  min_active_members: z.number().min(0).optional(),
  is_active: z.boolean(),
  sort_order: z.number().min(0).optional(),
});

type TierFormData = z.infer<typeof tierFormSchema>;

interface CommissionTierFormProps {
  tier?: CommissionTier;
  organizationId: string;
}

export function CommissionTierForm({ tier, organizationId }: CommissionTierFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isEdit = !!tier;

  const form = useForm<TierFormData>({
    resolver: zodResolver(tierFormSchema),
    defaultValues: {
      name: tier?.name ?? '',
      code: tier?.code ?? '',
      level: tier?.level ?? 1,
      base_rate_pct: tier?.base_rate_pct ?? 0,
      bonus_rate_pct: tier?.bonus_rate_pct ?? 0,
      override_rate_pct: tier?.override_rate_pct ?? 0,
      min_personal_production: tier?.min_personal_production ?? 0,
      min_team_production: tier?.min_team_production ?? 0,
      min_active_members: tier?.min_active_members ?? 0,
      is_active: tier?.is_active ?? true,
      sort_order: tier?.sort_order ?? 0,
    },
  });

  async function onSubmit(data: TierFormData) {
    setSaving(true);
    try {
      const tierData = {
        organization_id: organizationId,
        name: data.name,
        code: data.code.toUpperCase(),
        level: data.level,
        base_rate_pct: data.base_rate_pct,
        bonus_rate_pct: data.bonus_rate_pct || 0,
        override_rate_pct: data.override_rate_pct || 0,
        min_personal_production: data.min_personal_production || 0,
        min_team_production: data.min_team_production || 0,
        min_active_members: data.min_active_members || 0,
        is_active: data.is_active,
        sort_order: data.sort_order || 0,
      };

      if (isEdit && tier) {
        const { error } = await (supabase
          .from('commission_tiers') as any)
          .update(tierData)
          .eq('id', tier.id);

        if (error) throw error;
        toast.success('Commission tier updated successfully');
      } else {
        const { error } = await (supabase
          .from('commission_tiers') as any)
          .insert(tierData);

        if (error) throw error;
        toast.success('Commission tier created successfully');
      }

      // Log activity
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .single() as { data: { id: string } | null };

        if (profile) {
          await (supabase as any).rpc('log_admin_activity', {
            p_organization_id: organizationId,
            p_actor_profile_id: profile.id,
            p_entity_type: 'commission_tier',
            p_entity_id: tier?.id || 'new',
            p_action: isEdit ? 'update' : 'create',
            p_metadata: { name: data.name, code: data.code },
          });
        }
      }

      router.push('/commissions/tiers');
      router.refresh();
    } catch (error) {
      console.error('Error saving tier:', error);
      toast.error('Failed to save commission tier');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!tier) return;
    if (!confirm('Are you sure you want to delete this commission tier? This cannot be undone.')) {
      return;
    }

    setDeleting(true);
    try {
      // Check if any agents are assigned to this tier
      const { count } = await supabase
        .from('advisors')
        .select('id', { count: 'exact', head: true })
        .eq('commission_tier_id', tier.id);

      if (count && count > 0) {
        toast.error(`Cannot delete tier: ${count} agent(s) are still assigned to it.`);
        return;
      }

      const { error } = await (supabase
        .from('commission_tiers') as any)
        .delete()
        .eq('id', tier.id);

      if (error) throw error;

      toast.success('Commission tier deleted');
      router.push('/commissions/tiers');
      router.refresh();
    } catch (error) {
      console.error('Error deleting tier:', error);
      toast.error('Failed to delete commission tier');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/commissions/tiers">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {isEdit ? 'Edit Commission Tier' : 'New Commission Tier'}
            </h1>
            <p className="text-slate-500">
              {isEdit ? `Editing ${tier.name}` : 'Define a new commission level'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {isEdit && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting || saving}
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          )}
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Save className="h-4 w-4 mr-2" />
            {isEdit ? 'Save Changes' : 'Create Tier'}
          </Button>
        </div>
      </div>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Set the tier name, code, and hierarchy level</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <Label htmlFor="name">Tier Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Senior Agent"
              {...form.register('name')}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">Tier Code *</Label>
            <Input
              id="code"
              placeholder="e.g., SENIOR"
              {...form.register('code')}
              className="uppercase"
            />
            {form.formState.errors.code && (
              <p className="text-sm text-red-500">{form.formState.errors.code.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="level">Hierarchy Level *</Label>
            <Input
              id="level"
              type="number"
              min={1}
              max={99}
              {...form.register('level', { valueAsNumber: true })}
            />
            <p className="text-xs text-slate-500">Lower = higher in hierarchy (1 = top)</p>
            {form.formState.errors.level && (
              <p className="text-sm text-red-500">{form.formState.errors.level.message}</p>
            )}
          </div>

          <div className="flex items-center justify-between md:col-span-3 pt-4 border-t">
            <div>
              <Label htmlFor="is_active">Active Status</Label>
              <p className="text-sm text-slate-500">Enable or disable this tier</p>
            </div>
            <Switch
              id="is_active"
              checked={form.watch('is_active')}
              onCheckedChange={(checked) => form.setValue('is_active', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Commission Rates */}
      <Card>
        <CardHeader>
          <CardTitle>Commission Rates</CardTitle>
          <CardDescription>Define the commission percentages for this tier</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <Label htmlFor="base_rate_pct">Base Rate (%) *</Label>
            <Input
              id="base_rate_pct"
              type="number"
              step="0.01"
              min={0}
              max={100}
              {...form.register('base_rate_pct', { valueAsNumber: true })}
            />
            <p className="text-xs text-slate-500">Commission on direct sales</p>
            {form.formState.errors.base_rate_pct && (
              <p className="text-sm text-red-500">{form.formState.errors.base_rate_pct.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bonus_rate_pct">Bonus Rate (%)</Label>
            <Input
              id="bonus_rate_pct"
              type="number"
              step="0.01"
              min={0}
              max={100}
              {...form.register('bonus_rate_pct', { valueAsNumber: true })}
            />
            <p className="text-xs text-slate-500">Additional bonus percentage</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="override_rate_pct">Override Rate (%)</Label>
            <Input
              id="override_rate_pct"
              type="number"
              step="0.01"
              min={0}
              max={100}
              {...form.register('override_rate_pct', { valueAsNumber: true })}
            />
            <p className="text-xs text-slate-500">Commission on downline sales</p>
          </div>
        </CardContent>
      </Card>

      {/* Qualification Thresholds */}
      <Card>
        <CardHeader>
          <CardTitle>Qualification Thresholds</CardTitle>
          <CardDescription>Minimum requirements to qualify for this tier</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <Label htmlFor="min_personal_production">Min Personal Production ($)</Label>
            <Input
              id="min_personal_production"
              type="number"
              step="0.01"
              min={0}
              {...form.register('min_personal_production', { valueAsNumber: true })}
            />
            <p className="text-xs text-slate-500">Personal sales volume required</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="min_team_production">Min Team Production ($)</Label>
            <Input
              id="min_team_production"
              type="number"
              step="0.01"
              min={0}
              {...form.register('min_team_production', { valueAsNumber: true })}
            />
            <p className="text-xs text-slate-500">Team sales volume required</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="min_active_members">Min Active Members</Label>
            <Input
              id="min_active_members"
              type="number"
              min={0}
              {...form.register('min_active_members', { valueAsNumber: true })}
            />
            <p className="text-xs text-slate-500">Active member count required</p>
          </div>
        </CardContent>
      </Card>

      {/* Display Order */}
      <Card>
        <CardHeader>
          <CardTitle>Display Settings</CardTitle>
          <CardDescription>Control how this tier appears in lists</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-w-xs">
            <Label htmlFor="sort_order">Sort Order</Label>
            <Input
              id="sort_order"
              type="number"
              min={0}
              {...form.register('sort_order', { valueAsNumber: true })}
            />
            <p className="text-xs text-slate-500">Lower numbers appear first in lists</p>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
