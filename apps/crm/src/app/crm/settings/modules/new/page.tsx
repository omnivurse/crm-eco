'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Textarea } from '@crm-eco/ui/components/textarea';
import { toast } from 'sonner';
import { createBrowserClient } from '@supabase/ssr';

const iconOptions = [
  { value: 'file', label: 'File' },
  { value: 'users', label: 'Users' },
  { value: 'briefcase', label: 'Briefcase' },
  { value: 'building', label: 'Building' },
  { value: 'dollar-sign', label: 'Dollar Sign' },
  { value: 'shopping-cart', label: 'Shopping Cart' },
  { value: 'package', label: 'Package' },
  { value: 'tag', label: 'Tag' },
  { value: 'folder', label: 'Folder' },
  { value: 'clipboard', label: 'Clipboard' },
  { value: 'heart', label: 'Heart' },
  { value: 'star', label: 'Star' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'mail', label: 'Mail' },
  { value: 'phone', label: 'Phone' },
  { value: 'globe', label: 'Globe' },
];

export default function NewModulePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    name_plural: '',
    key: '',
    icon: 'file',
    description: '',
  });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Auto-generate key from name
  const handleNameChange = (name: string) => {
    const key = name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 50);

    setFormData(prev => ({
      ...prev,
      name,
      key: prev.key === '' || prev.key === generateKey(prev.name) ? key : prev.key,
    }));
  };

  const generateKey = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 50);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Module name is required');
      return;
    }

    if (!formData.key.trim()) {
      toast.error('Module key is required');
      return;
    }

    setSaving(true);

    try {
      // Get current user's org_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Not authenticated');
        router.push('/crm-login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, crm_role')
        .eq('user_id', user.id)
        .single();

      if (!profile) {
        toast.error('Profile not found');
        return;
      }

      if (profile.crm_role !== 'crm_admin') {
        toast.error('Only CRM admins can create modules');
        return;
      }

      const response = await fetch('/api/crm/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: profile.organization_id,
          key: formData.key,
          name: formData.name,
          name_plural: formData.name_plural || formData.name + 's',
          icon: formData.icon,
          description: formData.description,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create module');
      }

      toast.success('Module created successfully');
      router.push('/crm/settings/modules');
      router.refresh();
    } catch (error) {
      console.error('Error creating module:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create module');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/crm/settings/modules"
          className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">New Module</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Create a custom module to track your data
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Module Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Module Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g., Project, Campaign, Vendor"
                className="bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10"
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                The singular name for this type of record
              </p>
            </div>

            {/* Plural Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Plural Name
              </label>
              <Input
                value={formData.name_plural}
                onChange={(e) => setFormData(prev => ({ ...prev, name_plural: e.target.value }))}
                placeholder={formData.name ? formData.name + 's' : 'e.g., Projects, Campaigns'}
                className="bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10"
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Used in navigation and list views
              </p>
            </div>

            {/* Module Key */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Module Key <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.key}
                onChange={(e) => setFormData(prev => ({ ...prev, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))}
                placeholder="e.g., project, campaign, vendor"
                className="bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 font-mono"
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Unique identifier used in URLs and API (lowercase, no spaces)
              </p>
            </div>

            {/* Icon */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Icon
              </label>
              <select
                value={formData.icon}
                onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
              >
                {iconOptions.map((icon) => (
                  <option key={icon.value} value={icon.value}>
                    {icon.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Icon displayed in the sidebar navigation
              </p>
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Description
              </label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what this module is used for..."
                rows={3}
                className="bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10"
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Optional description for this module
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link href="/crm/settings/modules">
            <Button type="button" variant="outline" className="border-slate-200 dark:border-white/10">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={saving || !formData.name.trim() || !formData.key.trim()}
            className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Create Module
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Help Text */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          <strong className="text-slate-700 dark:text-slate-300">Note:</strong> After creating a module,
          you can add custom fields from the Fields settings page. The module will appear in your
          sidebar once enabled.
        </p>
      </div>
    </div>
  );
}
