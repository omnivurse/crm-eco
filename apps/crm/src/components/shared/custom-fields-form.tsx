'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import { Input, Label, Textarea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@crm-eco/ui';
import type { Database } from '@crm-eco/lib/types';

type CustomFieldDefinition = Database['public']['Tables']['custom_field_definitions']['Row'];

interface CustomFieldsFormProps {
  entityType: 'lead' | 'member' | 'advisor' | 'ticket' | 'need';
  values: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
}

export function CustomFieldsForm({ entityType, values, onChange }: CustomFieldsFormProps) {
  const [definitions, setDefinitions] = useState<CustomFieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDefinitions = async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        
        // Get the user's organization
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profileData } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('user_id', user.id)
          .single();

        const profile = profileData as { organization_id: string } | null;
        if (!profile) return;

        // Get custom field definitions for this entity type
        const { data } = await supabase
          .from('custom_field_definitions')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .eq('entity_type', entityType)
          .eq('is_visible', true)
          .order('order_index');

        if (data) {
          setDefinitions(data as CustomFieldDefinition[]);
        }
      } catch (err) {
        console.error('Error fetching custom field definitions:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDefinitions();
  }, [entityType]);

  const handleFieldChange = (fieldName: string, value: any) => {
    onChange({
      ...values,
      [fieldName]: value,
    });
  };

  if (loading) {
    return null; // Don't show loading state, just return null
  }

  if (definitions.length === 0) {
    return null; // No custom fields defined
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-slate-700 flex items-center gap-2">
        <span className="w-5 h-px bg-slate-200" />
        Additional Fields
        <span className="w-full h-px bg-slate-200" />
      </h3>
      
      <div className="grid gap-4">
        {definitions.map((field) => (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.field_name}>
              {field.field_label}
              {field.is_required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            
            {renderField(field, values[field.field_name], (value) => handleFieldChange(field.field_name, value))}
            
            {field.description && (
              <p className="text-xs text-slate-400">{field.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function renderField(
  field: CustomFieldDefinition, 
  value: any, 
  onChange: (value: any) => void
) {
  switch (field.field_type) {
    case 'text':
      return (
        <Input
          id={field.field_name}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.is_required}
        />
      );

    case 'number':
      return (
        <Input
          id={field.field_name}
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : null)}
          required={field.is_required}
        />
      );

    case 'date':
      return (
        <Input
          id={field.field_name}
          type="date"
          value={value || ''}
          onChange={(e) => onChange(e.target.value || null)}
          required={field.is_required}
        />
      );

    case 'boolean':
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-600">Yes</span>
        </label>
      );

    case 'select':
      const options = Array.isArray(field.options) ? field.options as string[] : [];
      return (
        <Select
          value={value || '__none__'}
          onValueChange={(v) => onChange(v === '__none__' ? null : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None</SelectItem>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case 'multiselect':
      const multiOptions = Array.isArray(field.options) ? field.options as string[] : [];
      const selectedValues = Array.isArray(value) ? value : [];
      
      return (
        <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-slate-50">
          {multiOptions.map((option) => {
            const isSelected = selectedValues.includes(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() => {
                  const newValue = isSelected
                    ? selectedValues.filter((v: string) => v !== option)
                    : [...selectedValues, option];
                  onChange(newValue);
                }}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border'
                }`}
              >
                {option}
              </button>
            );
          })}
          {multiOptions.length === 0 && (
            <span className="text-sm text-slate-400">No options configured</span>
          )}
        </div>
      );

    default:
      return (
        <Input
          id={field.field_name || undefined}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

