'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import { Button, Input, Label, Separator } from '@crm-eco/ui';
import { Save, Loader2 } from 'lucide-react';
import type { Database } from '@crm-eco/lib/types';

type Organization = Database['public']['Tables']['organizations']['Row'];

interface OrganizationSettingsFormProps {
  organization: Organization;
}

export function OrganizationSettingsForm({ organization }: OrganizationSettingsFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: organization.name || '',
    slug: organization.slug || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      const supabase = createClient();

      const { error: updateError } = await (supabase
        .from('organizations') as any)
        .update({ 
          name: formData.name,
          updated_at: new Date().toISOString(),
        })
        .eq('id', organization.id);

      if (updateError) throw updateError;

      setSuccess(true);
      router.refresh();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update organization';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
          {error}
        </div>
      )}
      
      {success && (
        <div className="p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg">
          Organization settings saved successfully!
        </div>
      )}

      <div className="grid gap-6">
        <div className="space-y-2">
          <Label htmlFor="name">Organization Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="My Organization"
            required
          />
          <p className="text-xs text-slate-500">
            The display name for your organization
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">Organization Slug</Label>
          <Input
            id="slug"
            value={formData.slug}
            readOnly
            disabled
            className="bg-slate-50"
          />
          <p className="text-xs text-slate-500">
            The unique identifier for your organization (cannot be changed)
          </p>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label>Organization ID</Label>
          <Input
            value={organization.id}
            readOnly
            disabled
            className="bg-slate-50 font-mono text-xs"
          />
          <p className="text-xs text-slate-500">
            Unique identifier used for API integrations
          </p>
        </div>

        <div className="space-y-2">
          <Label>Created</Label>
          <Input
            value={new Date(organization.created_at).toLocaleString()}
            readOnly
            disabled
            className="bg-slate-50"
          />
        </div>
      </div>

      <Separator />

      <div className="flex justify-end">
        <Button type="submit" disabled={loading} className="gap-2">
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}

