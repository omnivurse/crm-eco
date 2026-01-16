'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Checkbox,
} from '@crm-eco/ui';
import { Loader2 } from 'lucide-react';

interface ProductFormProps {
  initialData?: {
    id: string;
    name: string;
    code: string;
    label: string | null;
    description: string | null;
    product_line: string | null;
    coverage_category: string | null;
    provider: string | null;
    tier: string | null;
    monthly_share: number | null;
    enrollment_fee: number | null;
    iua_amount: number | null;
    max_annual_share: number | null;
    default_iua: number | null;
    effective_start_date: string | null;
    effective_end_date: string | null;
    is_active: boolean;
    require_dependent_info: boolean;
    require_dependent_address_match: boolean;
    hide_from_public: boolean;
  };
}

const CATEGORIES = [
  'Primary Health',
  'Supplemental',
  'Dental',
  'Vision',
  'Life',
  'Accident',
  'Critical Illness',
  'Other',
];

const TIERS = ['Bronze', 'Silver', 'Gold', 'Platinum'];

export function ProductForm({ initialData }: ProductFormProps) {
  const router = useRouter();
  const isEditing = !!initialData;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: initialData?.name ?? '',
    code: initialData?.code ?? '',
    label: initialData?.label ?? '',
    description: initialData?.description ?? '',
    product_line: initialData?.product_line ?? '',
    coverage_category: initialData?.coverage_category ?? '',
    provider: initialData?.provider ?? '',
    tier: initialData?.tier ?? '',
    monthly_share: initialData?.monthly_share?.toString() ?? '',
    enrollment_fee: initialData?.enrollment_fee?.toString() ?? '',
    iua_amount: initialData?.iua_amount?.toString() ?? '',
    max_annual_share: initialData?.max_annual_share?.toString() ?? '',
    default_iua: initialData?.default_iua?.toString() ?? '',
    effective_start_date: initialData?.effective_start_date ?? '',
    effective_end_date: initialData?.effective_end_date ?? '',
    is_active: initialData?.is_active ?? true,
    require_dependent_info: initialData?.require_dependent_info ?? false,
    require_dependent_address_match: initialData?.require_dependent_address_match ?? false,
    hide_from_public: initialData?.hide_from_public ?? false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      setError('Profile not found');
      setLoading(false);
      return;
    }

    const productData = {
      name: formData.name,
      code: formData.code,
      label: formData.label || null,
      description: formData.description || null,
      product_line: formData.product_line || null,
      coverage_category: formData.coverage_category || null,
      provider: formData.provider || null,
      tier: formData.tier || null,
      monthly_share: formData.monthly_share ? parseFloat(formData.monthly_share) : null,
      enrollment_fee: formData.enrollment_fee ? parseFloat(formData.enrollment_fee) : null,
      iua_amount: formData.iua_amount ? parseFloat(formData.iua_amount) : null,
      max_annual_share: formData.max_annual_share ? parseFloat(formData.max_annual_share) : null,
      default_iua: formData.default_iua ? parseFloat(formData.default_iua) : null,
      effective_start_date: formData.effective_start_date || null,
      effective_end_date: formData.effective_end_date || null,
      is_active: formData.is_active,
      require_dependent_info: formData.require_dependent_info,
      require_dependent_address_match: formData.require_dependent_address_match,
      hide_from_public: formData.hide_from_public,
      organization_id: profile.organization_id,
    };

    if (isEditing) {
      const { error: updateError } = await supabase
        .from('plans')
        .update(productData)
        .eq('id', initialData.id);

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      router.push(`/products/${initialData.id}`);
    } else {
      const { data: newProduct, error: insertError } = await supabase
        .from('plans')
        .insert(productData)
        .select('id')
        .single();

      if (insertError) {
        setError(insertError.message);
        setLoading(false);
        return;
      }

      router.push(`/products/${newProduct.id}`);
    }

    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="font-medium text-slate-900">Basic Information</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Product Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="code">Product Code *</Label>
            <Input
              id="code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              required
              disabled={loading}
              placeholder="e.g., HLTH-001"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="label">Display Label</Label>
          <Input
            id="label"
            value={formData.label}
            onChange={(e) => setFormData({ ...formData, label: e.target.value })}
            disabled={loading}
            placeholder="Optional display name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            disabled={loading}
            className="w-full min-h-[80px] px-3 py-2 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Product description..."
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="product_line">Product Line</Label>
            <Input
              id="product_line"
              value={formData.product_line}
              onChange={(e) => setFormData({ ...formData, product_line: e.target.value })}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="coverage_category">Category</Label>
            <Select
              value={formData.coverage_category}
              onValueChange={(value) => setFormData({ ...formData, coverage_category: value })}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tier">Tier</Label>
            <Select
              value={formData.tier}
              onValueChange={(value) => setFormData({ ...formData, tier: value })}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select tier" />
              </SelectTrigger>
              <SelectContent>
                {TIERS.map((tier) => (
                  <SelectItem key={tier} value={tier}>
                    {tier}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="provider">Provider</Label>
          <Input
            id="provider"
            value={formData.provider}
            onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
            disabled={loading}
            placeholder="Insurance/Healthshare provider"
          />
        </div>
      </div>

      {/* Pricing */}
      <div className="space-y-4">
        <h3 className="font-medium text-slate-900">Pricing</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="monthly_share">Monthly Share ($)</Label>
            <Input
              id="monthly_share"
              type="number"
              step="0.01"
              value={formData.monthly_share}
              onChange={(e) => setFormData({ ...formData, monthly_share: e.target.value })}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="enrollment_fee">Enrollment Fee ($)</Label>
            <Input
              id="enrollment_fee"
              type="number"
              step="0.01"
              value={formData.enrollment_fee}
              onChange={(e) => setFormData({ ...formData, enrollment_fee: e.target.value })}
              disabled={loading}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="iua_amount">IUA Amount ($)</Label>
            <Input
              id="iua_amount"
              type="number"
              step="0.01"
              value={formData.iua_amount}
              onChange={(e) => setFormData({ ...formData, iua_amount: e.target.value })}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="default_iua">Default IUA ($)</Label>
            <Input
              id="default_iua"
              type="number"
              step="0.01"
              value={formData.default_iua}
              onChange={(e) => setFormData({ ...formData, default_iua: e.target.value })}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max_annual_share">Max Annual Share ($)</Label>
            <Input
              id="max_annual_share"
              type="number"
              step="0.01"
              value={formData.max_annual_share}
              onChange={(e) => setFormData({ ...formData, max_annual_share: e.target.value })}
              disabled={loading}
            />
          </div>
        </div>
      </div>

      {/* Effective Dates */}
      <div className="space-y-4">
        <h3 className="font-medium text-slate-900">Effective Dates</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="effective_start_date">Start Date</Label>
            <Input
              id="effective_start_date"
              type="date"
              value={formData.effective_start_date}
              onChange={(e) => setFormData({ ...formData, effective_start_date: e.target.value })}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="effective_end_date">End Date</Label>
            <Input
              id="effective_end_date"
              type="date"
              value={formData.effective_end_date}
              onChange={(e) => setFormData({ ...formData, effective_end_date: e.target.value })}
              disabled={loading}
            />
          </div>
        </div>
      </div>

      {/* Settings */}
      <div className="space-y-4">
        <h3 className="font-medium text-slate-900">Settings</h3>
        
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, is_active: checked === true })
              }
              disabled={loading}
            />
            <Label htmlFor="is_active">Product is active</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="require_dependent_info"
              checked={formData.require_dependent_info}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, require_dependent_info: checked === true })
              }
              disabled={loading}
            />
            <Label htmlFor="require_dependent_info">Require dependent information</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="require_dependent_address_match"
              checked={formData.require_dependent_address_match}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, require_dependent_address_match: checked === true })
              }
              disabled={loading}
            />
            <Label htmlFor="require_dependent_address_match">
              Require dependent address to match member
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="hide_from_public"
              checked={formData.hide_from_public}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, hide_from_public: checked === true })
              }
              disabled={loading}
            />
            <Label htmlFor="hide_from_public">Hide from public enrollment</Label>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {isEditing ? 'Saving...' : 'Creating...'}
            </>
          ) : isEditing ? (
            'Save Changes'
          ) : (
            'Create Product'
          )}
        </Button>
      </div>
    </form>
  );
}
