'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Textarea } from '@crm-eco/ui/components/textarea';
import { Label } from '@crm-eco/ui/components/label';
import { Checkbox } from '@crm-eco/ui/components/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui/components/card';
import { cn } from '@crm-eco/ui/lib/utils';
import type { CrmField, CrmLayout, LayoutSection } from '@/lib/crm/types';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';

interface DynamicRecordFormProps {
  fields: CrmField[];
  layout: CrmLayout;
  defaultValues?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  mode?: 'create' | 'edit';
}

export function DynamicRecordForm({
  fields,
  layout,
  defaultValues = {},
  onSubmit,
  onCancel,
  isLoading = false,
  mode = 'create',
}: DynamicRecordFormProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set(
      (layout.config.sections || [])
        .filter((s: LayoutSection) => s.collapsed)
        .map((s: LayoutSection) => s.key)
    )
  );

  // Build dynamic Zod schema based on fields
  const schema = useMemo(() => {
    const schemaShape: Record<string, z.ZodType> = {};

    for (const field of fields) {
      let fieldSchema: z.ZodType;

      switch (field.type) {
        case 'text':
        case 'textarea':
          fieldSchema = z.string();
          if (field.validation?.minLength) {
            fieldSchema = (fieldSchema as z.ZodString).min(field.validation.minLength);
          }
          if (field.validation?.maxLength) {
            fieldSchema = (fieldSchema as z.ZodString).max(field.validation.maxLength);
          }
          break;

        case 'email':
          fieldSchema = z.string().email('Invalid email address');
          break;

        case 'phone':
          fieldSchema = z.string();
          break;

        case 'url':
          fieldSchema = z.string().url('Invalid URL');
          break;

        case 'number':
        case 'currency':
          fieldSchema = z.coerce.number();
          if (field.validation?.min !== undefined) {
            fieldSchema = (fieldSchema as z.ZodNumber).min(field.validation.min);
          }
          if (field.validation?.max !== undefined) {
            fieldSchema = (fieldSchema as z.ZodNumber).max(field.validation.max);
          }
          break;

        case 'date':
        case 'datetime':
          fieldSchema = z.string();
          break;

        case 'boolean':
          fieldSchema = z.boolean();
          break;

        case 'select':
          fieldSchema = z.string();
          break;

        case 'multiselect':
          fieldSchema = z.array(z.string());
          break;

        case 'lookup':
        case 'user':
          fieldSchema = z.string().uuid();
          break;

        default:
          fieldSchema = z.unknown();
      }

      // Make optional if not required
      if (!field.required) {
        fieldSchema = fieldSchema.optional().nullable();
      }

      schemaShape[field.key] = fieldSchema;
    }

    return z.object(schemaShape);
  }, [fields]);

  // Group fields by section
  const fieldsBySection = useMemo(() => {
    const grouped: Record<string, CrmField[]> = {};
    for (const field of fields) {
      const section = field.section || 'main';
      if (!grouped[section]) grouped[section] = [];
      grouped[section].push(field);
    }
    // Sort fields within each section by display_order
    for (const key of Object.keys(grouped)) {
      grouped[key].sort((a, b) => a.display_order - b.display_order);
    }
    return grouped;
  }, [fields]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: defaultValues as Record<string, unknown>,
  });

  const toggleSection = (key: string) => {
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(key)) {
      newCollapsed.delete(key);
    } else {
      newCollapsed.add(key);
    }
    setCollapsedSections(newCollapsed);
  };

  const renderField = (field: CrmField) => {
    const error = errors[field.key];
    const value = watch(field.key);

    const commonProps = {
      id: field.key,
      ...register(field.key),
      className: cn(error && 'border-destructive'),
      placeholder: field.tooltip || `Enter ${field.label.toLowerCase()}`,
    };

    switch (field.type) {
      case 'text':
      case 'email':
      case 'phone':
      case 'url':
        return <Input {...commonProps} type={field.type === 'email' ? 'email' : 'text'} />;

      case 'textarea':
        return <Textarea {...commonProps} rows={3} />;

      case 'number':
      case 'currency':
        return (
          <Input
            {...commonProps}
            type="number"
            step={field.type === 'currency' ? '0.01' : '1'}
          />
        );

      case 'date':
        return <Input {...commonProps} type="date" />;

      case 'datetime':
        return <Input {...commonProps} type="datetime-local" />;

      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={field.key}
              checked={!!value}
              onCheckedChange={(checked) => setValue(field.key, checked)}
            />
            <Label htmlFor={field.key} className="text-sm font-normal">
              {field.tooltip || 'Yes'}
            </Label>
          </div>
        );

      case 'select':
        return (
          <Select
            value={value as string}
            onValueChange={(val) => setValue(field.key, val)}
          >
            <SelectTrigger className={cn(error && 'border-destructive')}>
              <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {(field.options || []).map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'multiselect':
        const selectedValues = (value as string[]) || [];
        return (
          <div className="space-y-2 border rounded-md p-3 max-h-40 overflow-y-auto">
            {(field.options || []).map((option) => (
              <div key={option} className="flex items-center space-x-2">
                <Checkbox
                  id={`${field.key}-${option}`}
                  checked={selectedValues.includes(option)}
                  onCheckedChange={(checked) => {
                    const newValues = checked
                      ? [...selectedValues, option]
                      : selectedValues.filter((v) => v !== option);
                    setValue(field.key, newValues);
                  }}
                />
                <Label htmlFor={`${field.key}-${option}`} className="text-sm font-normal">
                  {option}
                </Label>
              </div>
            ))}
          </div>
        );

      case 'user':
      case 'lookup':
        // Simplified - in real app would be a searchable dropdown
        return (
          <Input {...commonProps} placeholder={`Enter ${field.label.toLowerCase()} ID`} />
        );

      default:
        return <Input {...commonProps} />;
    }
  };

  const sections = layout.config.sections || [{ key: 'main', label: 'General', columns: 2 }];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {sections.map((section) => {
        const sectionFields = fieldsBySection[section.key] || [];
        if (sectionFields.length === 0) return null;

        const isCollapsed = collapsedSections.has(section.key);

        return (
          <Card key={section.key}>
            <CardHeader
              className="cursor-pointer hover:bg-muted/50 transition-colors py-3"
              onClick={() => toggleSection(section.key)}
            >
              <CardTitle className="text-base font-medium flex items-center gap-2">
                {isCollapsed ? (
                  <ChevronRight className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                {section.label}
                <span className="text-muted-foreground font-normal text-sm">
                  ({sectionFields.length} field{sectionFields.length !== 1 ? 's' : ''})
                </span>
              </CardTitle>
            </CardHeader>
            {!isCollapsed && (
              <CardContent>
                <div
                  className={cn(
                    'grid gap-4',
                    section.columns === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
                  )}
                >
                  {sectionFields.map((field) => (
                    <div
                      key={field.key}
                      className={cn(field.width === 'full' && 'md:col-span-2')}
                    >
                      <Label htmlFor={field.key} className="mb-1.5 block">
                        {field.label}
                        {field.required && <span className="text-destructive ml-1">*</span>}
                      </Label>
                      {renderField(field)}
                      {errors[field.key] && (
                        <p className="text-sm text-destructive mt-1">
                          {errors[field.key]?.message as string}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Form Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isLoading} className="min-w-24">
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : mode === 'create' ? (
            'Create Record'
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </form>
  );
}
