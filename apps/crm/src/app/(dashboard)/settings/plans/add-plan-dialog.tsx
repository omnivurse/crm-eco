'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@crm-eco/ui';
import { Plus, Loader2 } from 'lucide-react';

export function AddPlanDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    coverageCategory: '',
    tier: '',
    productLine: '',
    networkType: '',
    monthlyShare: '',
    enrollmentFee: '',
    iuaAmount: '',
    maxAnnualShare: '',
    description: '',
  });

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      coverageCategory: '',
      tier: '',
      productLine: '',
      networkType: '',
      monthlyShare: '',
      enrollmentFee: '',
      iuaAmount: '',
      maxAnnualShare: '',
      description: '',
    });
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();

      // Get current user's profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      // Create plan
      const { error: insertError } = await supabase.from('plans').insert({
        organization_id: profile.organization_id,
        name: formData.name,
        code: formData.code,
        coverage_category: formData.coverageCategory || null,
        tier: formData.tier || null,
        product_line: formData.productLine || null,
        network_type: formData.networkType || null,
        monthly_share: formData.monthlyShare ? parseFloat(formData.monthlyShare) : null,
        enrollment_fee: formData.enrollmentFee ? parseFloat(formData.enrollmentFee) : null,
        iua_amount: formData.iuaAmount ? parseFloat(formData.iuaAmount) : null,
        max_annual_share: formData.maxAnnualShare ? parseFloat(formData.maxAnnualShare) : null,
        description: formData.description || null,
        is_active: true,
      });

      if (insertError) throw insertError;

      setOpen(false);
      resetForm();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Add Plan
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add New Plan</DialogTitle>
          <DialogDescription>
            Create a new plan that members can enroll in.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          )}
          
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Plan Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Essential Care"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Plan Code *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="e.g., ESS-001"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="coverageCategory">Coverage Category</Label>
                <Select
                  value={formData.coverageCategory}
                  onValueChange={(v) => setFormData({ ...formData, coverageCategory: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="healthshare">Healthshare</SelectItem>
                    <SelectItem value="medical">Medical</SelectItem>
                    <SelectItem value="dental">Dental</SelectItem>
                    <SelectItem value="vision">Vision</SelectItem>
                    <SelectItem value="supplemental">Supplemental</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tier">Tier</Label>
                <Select
                  value={formData.tier}
                  onValueChange={(v) => setFormData({ ...formData, tier: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select tier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bronze">Bronze</SelectItem>
                    <SelectItem value="silver">Silver</SelectItem>
                    <SelectItem value="gold">Gold</SelectItem>
                    <SelectItem value="platinum">Platinum</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="productLine">Product Line</Label>
                <Select
                  value={formData.productLine}
                  onValueChange={(v) => setFormData({ ...formData, productLine: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select product line" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="family">Family</SelectItem>
                    <SelectItem value="group">Group</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="networkType">Network Type</Label>
                <Select
                  value={formData.networkType}
                  onValueChange={(v) => setFormData({ ...formData, networkType: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select network" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ppo">PPO</SelectItem>
                    <SelectItem value="no_network">No Network</SelectItem>
                    <SelectItem value="limited">Limited Network</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="monthlyShare">Monthly Share ($)</Label>
                <Input
                  id="monthlyShare"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.monthlyShare}
                  onChange={(e) => setFormData({ ...formData, monthlyShare: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="enrollmentFee">Enrollment Fee ($)</Label>
                <Input
                  id="enrollmentFee"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.enrollmentFee}
                  onChange={(e) => setFormData({ ...formData, enrollmentFee: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="iuaAmount">IUA Amount ($)</Label>
                <Input
                  id="iuaAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.iuaAmount}
                  onChange={(e) => setFormData({ ...formData, iuaAmount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxAnnualShare">Max Annual Share ($)</Label>
                <Input
                  id="maxAnnualShare"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.maxAnnualShare}
                  onChange={(e) => setFormData({ ...formData, maxAnnualShare: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the plan..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="gap-2">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Plan'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

