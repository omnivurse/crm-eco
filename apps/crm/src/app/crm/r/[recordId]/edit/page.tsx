'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Loader2, X } from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Textarea } from '@crm-eco/ui/components/textarea';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useEditRecordData } from '@/hooks/useEditRecordData';
import { queryKeys } from '@/lib/query-keys';
import { getFieldOptions } from '@/lib/crm/utils';

interface Field {
  id: string;
  key: string;
  label: string;
  field_type: string;
  is_required: boolean;
  options?: string[];
  placeholder?: string;
}

export default function EditRecordPage() {
  const { recordId } = useParams<{ recordId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [isInitialized, setIsInitialized] = useState(false);

  // Use TanStack Query for cached data fetching
  const { data, isLoading, error } = useEditRecordData(recordId);

  // Initialize form data when record loads, merging top-level indexed columns
  useEffect(() => {
    if (data?.record && !isInitialized) {
      const r = data.record;
      setFormData({
        ...r.data,
        ...(r.email && !r.data?.email && { email: r.email }),
        ...(r.phone && !r.data?.phone && { phone: r.phone }),
        ...(r.status && !r.data?.contact_status && { contact_status: r.status }),
      });
      setIsInitialized(true);
    }
  }, [data?.record, isInitialized]);

  // Show error toast if loading fails
  useEffect(() => {
    if (error) {
      toast.error('Failed to load record');
    }
  }, [error]);

  const record = data?.record;
  const fields = data?.fields || [];

  const handleFieldChange = (key: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!record) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/crm/records/${recordId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: formData }),
      });

      if (!response.ok) throw new Error('Failed to save');

      // Invalidate all record caches so detail/list pages show fresh data
      await queryClient.invalidateQueries({ queryKey: ['edit-record', recordId] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.records.detail(recordId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.records.drawer(recordId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.records.lists() });

      toast.success('Record updated successfully');
      router.refresh();
      router.push(`/crm/r/${recordId}`);
    } catch (error) {
      console.error('Error saving record:', error);
      toast.error('Failed to save record');
    } finally {
      setSaving(false);
    }
  };

  const renderField = (field: Field) => {
    const value = formData[field.key] as string | undefined;

    switch (field.field_type) {
      case 'text':
      case 'email':
      case 'phone':
      case 'url':
        return (
          <Input
            type={field.field_type === 'email' ? 'email' : field.field_type === 'url' ? 'url' : 'text'}
            value={value || ''}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
            className="bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10"
          />
        );

      case 'number':
      case 'currency':
        return (
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => handleFieldChange(field.key, e.target.value ? parseFloat(e.target.value) : '')}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
            className="bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10"
          />
        );

      case 'textarea':
        return (
          <Textarea
            value={value || ''}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
            rows={3}
            className="bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10"
          />
        );

      case 'select':
      case 'picklist':
        return (
          <select
            value={value || ''}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
          >
            <option value="">Select {field.label}...</option>
            {getFieldOptions(field.options).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );

      case 'date':
        return (
          <Input
            type="date"
            value={value || ''}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            className="bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10"
          />
        );

      case 'datetime':
        return (
          <Input
            type="datetime-local"
            value={value || ''}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            className="bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10"
          />
        );

      case 'checkbox':
      case 'boolean':
        return (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => handleFieldChange(field.key, e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-teal-500 focus:ring-teal-500"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">{field.label}</span>
          </label>
        );

      default:
        return (
          <Input
            value={value || ''}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
            className="bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10"
          />
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-slate-600 dark:text-slate-400 mb-4">Record not found</p>
        <Button variant="outline" asChild>
          <Link href="/crm">Back to CRM</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/crm/r/${recordId}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {record.title}
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Edit {record.module.name}
            </h1>
            <p className="text-slate-500 dark:text-slate-400">
              Editing: {record.title}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => router.push(`/crm/r/${recordId}`)}
              className="border-slate-200 dark:border-white/10"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-teal-500 hover:bg-teal-600 text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-white/10 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {fields.map((field) => (
            <div
              key={field.id}
              className={field.field_type === 'textarea' ? 'md:col-span-2' : ''}
            >
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {field.label}
                {field.is_required && <span className="text-red-500 ml-1">*</span>}
              </label>
              {renderField(field)}
            </div>
          ))}
        </div>

        {fields.length === 0 && (
          <p className="text-center text-slate-500 dark:text-slate-400 py-8">
            No editable fields found for this module.
          </p>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex justify-end gap-2 mt-6">
        <Button
          variant="outline"
          onClick={() => router.push(`/crm/r/${recordId}`)}
          className="border-slate-200 dark:border-white/10"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-teal-500 hover:bg-teal-600 text-white"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
