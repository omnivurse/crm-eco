'use client';

import { format } from 'date-fns';
import { Badge } from '@crm-eco/ui';
import { Check, X } from 'lucide-react';
import type { Database } from '@crm-eco/lib/types';

type CustomFieldDefinition = Database['public']['Tables']['custom_field_definitions']['Row'];

interface CustomFieldsDisplayProps {
  definitions: CustomFieldDefinition[];
  values: Record<string, any> | null;
}

export function CustomFieldsDisplay({ definitions, values }: CustomFieldsDisplayProps) {
  if (!definitions.length || !values || Object.keys(values).length === 0) {
    return null;
  }

  // Filter to only visible fields that have values
  const visibleFields = definitions.filter(
    (field) => (field.is_visible !== false) && values[field.field_name] !== undefined && values[field.field_name] !== null
  );

  if (visibleFields.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {visibleFields.map((field) => (
        <div key={field.id} className="flex justify-between items-start">
          <span className="text-slate-500 text-sm">{field.field_label}</span>
          <div className="text-right">
            {renderValue(field, values[field.field_name])}
          </div>
        </div>
      ))}
    </div>
  );
}

function renderValue(field: CustomFieldDefinition, value: any) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-slate-400">—</span>;
  }

  switch (field.field_type) {
    case 'text':
      return <span className="font-medium">{value}</span>;

    case 'number':
      return <span className="font-medium">{Number(value).toLocaleString()}</span>;

    case 'date':
      try {
        return <span className="font-medium">{format(new Date(value), 'MMM d, yyyy')}</span>;
      } catch {
        return <span className="font-medium">{value}</span>;
      }

    case 'boolean':
      return value ? (
        <Badge className="bg-green-100 text-green-700 gap-1">
          <Check className="w-3 h-3" />
          Yes
        </Badge>
      ) : (
        <Badge className="bg-slate-100 text-slate-700 gap-1">
          <X className="w-3 h-3" />
          No
        </Badge>
      );

    case 'select':
      return <Badge variant="outline" className="font-medium">{value}</Badge>;

    case 'multiselect':
      if (!Array.isArray(value) || value.length === 0) {
        return <span className="text-slate-400">—</span>;
      }
      return (
        <div className="flex flex-wrap gap-1 justify-end">
          {value.map((v: string, i: number) => (
            <Badge key={i} variant="outline" className="font-medium">
              {v}
            </Badge>
          ))}
        </div>
      );

    default:
      return <span className="font-medium">{String(value)}</span>;
  }
}

