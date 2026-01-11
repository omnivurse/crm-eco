'use client';

import { format } from 'date-fns';
import { Badge } from '@crm-eco/ui/components/badge';
import { cn } from '@crm-eco/ui/lib/utils';
import type { CrmField } from '@/lib/crm/types';
import { Mail, Phone, ExternalLink, Check, X } from 'lucide-react';

interface FieldRendererProps {
  field: CrmField;
  value: unknown;
  className?: string;
}

export function FieldRenderer({ field, value, className }: FieldRendererProps) {
  if (value === null || value === undefined || value === '') {
    return <span className={cn('text-muted-foreground', className)}>—</span>;
  }

  switch (field.type) {
    case 'text':
    case 'textarea':
      return <span className={className}>{String(value)}</span>;

    case 'email':
      return (
        <a
          href={`mailto:${value}`}
          className={cn('inline-flex items-center gap-1 text-brand-teal-600 hover:underline', className)}
        >
          <Mail className="w-3 h-3" />
          {String(value)}
        </a>
      );

    case 'phone':
      return (
        <a
          href={`tel:${String(value).replace(/[^\d+]/g, '')}`}
          className={cn('inline-flex items-center gap-1 text-brand-teal-600 hover:underline', className)}
        >
          <Phone className="w-3 h-3" />
          {String(value)}
        </a>
      );

    case 'url':
      return (
        <a
          href={String(value)}
          target="_blank"
          rel="noopener noreferrer"
          className={cn('inline-flex items-center gap-1 text-brand-teal-600 hover:underline', className)}
        >
          <ExternalLink className="w-3 h-3" />
          {new URL(String(value)).hostname}
        </a>
      );

    case 'number':
      return (
        <span className={className}>
          {typeof value === 'number' ? value.toLocaleString() : String(value)}
        </span>
      );

    case 'currency':
      return (
        <span className={cn('font-medium', className)}>
          {new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
          }).format(Number(value))}
        </span>
      );

    case 'date':
      try {
        const date = new Date(String(value));
        return (
          <span className={className}>
            {format(date, 'MMM d, yyyy')}
          </span>
        );
      } catch {
        return <span className={className}>{String(value)}</span>;
      }

    case 'datetime':
      try {
        const datetime = new Date(String(value));
        return (
          <span className={className}>
            {format(datetime, 'MMM d, yyyy h:mm a')}
          </span>
        );
      } catch {
        return <span className={className}>{String(value)}</span>;
      }

    case 'boolean':
      return value ? (
        <span className={cn('inline-flex items-center gap-1 text-brand-emerald-600', className)}>
          <Check className="w-4 h-4" />
          Yes
        </span>
      ) : (
        <span className={cn('inline-flex items-center gap-1 text-muted-foreground', className)}>
          <X className="w-4 h-4" />
          No
        </span>
      );

    case 'select':
      return (
        <Badge variant="secondary" className={className}>
          {String(value)}
        </Badge>
      );

    case 'multiselect':
      const values = Array.isArray(value) ? value : [value];
      return (
        <div className={cn('flex flex-wrap gap-1', className)}>
          {values.map((v, i) => (
            <Badge key={i} variant="secondary">
              {String(v)}
            </Badge>
          ))}
        </div>
      );

    case 'user':
    case 'lookup':
      // These would typically show linked record names
      return <span className={cn('text-brand-teal-600', className)}>{String(value)}</span>;

    default:
      return <span className={className}>{String(value)}</span>;
  }
}

// Helper to render value in table cell (compact view)
export function renderCellValue(field: CrmField, value: unknown): React.ReactNode {
  return <FieldRenderer field={field} value={value} />;
}

// Helper to get display value as string (for exports, etc.)
export function getDisplayValue(field: CrmField, value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  switch (field.type) {
    case 'boolean':
      return value ? 'Yes' : 'No';

    case 'date':
      try {
        return format(new Date(String(value)), 'yyyy-MM-dd');
      } catch {
        return String(value);
      }

    case 'datetime':
      try {
        return format(new Date(String(value)), 'yyyy-MM-dd HH:mm');
      } catch {
        return String(value);
      }

    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(Number(value));

    case 'number':
      return typeof value === 'number' ? value.toLocaleString() : String(value);

    case 'multiselect':
      return Array.isArray(value) ? value.join(', ') : String(value);

    default:
      return String(value);
  }
}
