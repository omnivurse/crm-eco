'use client';

import { useState, useRef, useEffect } from 'react';
import { Input } from '@crm-eco/ui/components/input';
import { Button } from '@crm-eco/ui/components/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { cn } from '@crm-eco/ui/lib/utils';
import { Check, X, Pencil, Loader2 } from 'lucide-react';
import type { CrmField } from '@/lib/crm/types';

interface InlineFieldProps {
  field: CrmField;
  value: unknown;
  onSave: (value: unknown) => Promise<void>;
  readOnly?: boolean;
  className?: string;
}

export function InlineField({
  field,
  value,
  onSave,
  readOnly = false,
  className,
}: InlineFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<string>(formatValue(value));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function formatValue(val: unknown): string {
    if (val === null || val === undefined) return '';
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    if (val instanceof Date) return val.toISOString().split('T')[0];
    return String(val);
  }

  function parseValue(val: string): unknown {
    if (field.type === 'number' || field.type === 'currency') {
      const num = parseFloat(val);
      return isNaN(num) ? null : num;
    }
    if (field.type === 'boolean') {
      return val.toLowerCase() === 'yes' || val === 'true';
    }
    return val || null;
  }

  const displayValue = formatValue(value) || '—';

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    if (readOnly) return;
    setEditValue(formatValue(value));
    setError(null);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue(formatValue(value));
    setError(null);
  };

  const handleSave = async () => {
    const parsedValue = parseValue(editValue);
    
    // Validate required
    if (field.required && (parsedValue === null || parsedValue === '')) {
      setError('This field is required');
      return;
    }

    setSaving(true);
    setError(null);
    
    try {
      await onSave(parsedValue);
      setIsEditing(false);
    } catch (err) {
      setError('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const renderEditInput = () => {
    if (field.type === 'select' && field.options?.length) {
      return (
        <Select value={editValue} onValueChange={setEditValue}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (field.type === 'boolean') {
      return (
        <Select value={editValue} onValueChange={setEditValue}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Yes">Yes</SelectItem>
            <SelectItem value="No">No</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    const inputType = 
      field.type === 'number' || field.type === 'currency' ? 'number' :
      field.type === 'date' ? 'date' :
      field.type === 'datetime' ? 'datetime-local' :
      field.type === 'email' ? 'email' :
      field.type === 'phone' ? 'tel' :
      field.type === 'url' ? 'url' :
      'text';

    return (
      <Input
        ref={inputRef}
        type={inputType}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className="h-8 text-sm"
      />
    );
  };

  return (
    <div className={cn('group', className)}>
      <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      {isEditing ? (
        <div className="flex items-center gap-2">
          <div className="flex-1">{renderEditInput()}</div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSave}
            disabled={saving}
            className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCancel}
            disabled={saving}
            className="h-8 w-8 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-white/5"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <div
          onClick={handleStartEdit}
          className={cn(
            'flex items-center justify-between gap-2 px-2 py-1.5 -mx-2 rounded-md transition-colors',
            !readOnly && 'cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5'
          )}
        >
          <span className={cn(
            'text-sm',
            value ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-600'
          )}>
            {displayValue}
          </span>
          {!readOnly && (
            <Pencil className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
}
