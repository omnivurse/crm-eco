'use client';

import { useState } from 'react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { Badge } from '@crm-eco/ui/components/badge';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import type { CrmField } from '@/lib/crm/types';
import type { Condition, ConditionGroup, ConditionOperator } from '@/lib/automation/types';

interface ConditionBuilderProps {
  fields: CrmField[];
  conditions: ConditionGroup | Condition[];
  onChange: (conditions: ConditionGroup) => void;
  readOnly?: boolean;
}

const OPERATORS: { value: ConditionOperator; label: string; requiresValue: boolean }[] = [
  { value: 'eq', label: 'Equals', requiresValue: true },
  { value: 'ne', label: 'Not equals', requiresValue: true },
  { value: 'contains', label: 'Contains', requiresValue: true },
  { value: 'not_contains', label: 'Does not contain', requiresValue: true },
  { value: 'starts_with', label: 'Starts with', requiresValue: true },
  { value: 'ends_with', label: 'Ends with', requiresValue: true },
  { value: 'gt', label: 'Greater than', requiresValue: true },
  { value: 'gte', label: 'Greater or equal', requiresValue: true },
  { value: 'lt', label: 'Less than', requiresValue: true },
  { value: 'lte', label: 'Less or equal', requiresValue: true },
  { value: 'is_empty', label: 'Is empty', requiresValue: false },
  { value: 'not_empty', label: 'Is not empty', requiresValue: false },
  { value: 'changed', label: 'Changed', requiresValue: false },
  { value: 'changed_to', label: 'Changed to', requiresValue: true },
  { value: 'changed_from', label: 'Changed from', requiresValue: true },
];

// System fields available
const SYSTEM_FIELDS = [
  { key: 'title', label: 'Title', type: 'text' },
  { key: 'status', label: 'Status', type: 'text' },
  { key: 'stage', label: 'Stage', type: 'text' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'phone', label: 'Phone', type: 'phone' },
  { key: 'owner_id', label: 'Owner', type: 'user' },
];

function normalizeConditions(conditions: ConditionGroup | Condition[]): ConditionGroup {
  if (Array.isArray(conditions)) {
    return {
      logic: 'AND',
      conditions: conditions,
    };
  }
  return conditions;
}

export function ConditionBuilder({
  fields,
  conditions,
  onChange,
  readOnly = false,
}: ConditionBuilderProps) {
  const normalizedGroup = normalizeConditions(conditions);

  const allFields = [
    ...SYSTEM_FIELDS,
    ...fields.map(f => ({ key: f.key, label: f.label, type: f.type })),
  ];

  function updateCondition(index: number, updates: Partial<Condition>) {
    const newConditions = [...normalizedGroup.conditions] as Condition[];
    newConditions[index] = { ...(newConditions[index] as Condition), ...updates };
    onChange({ ...normalizedGroup, conditions: newConditions });
  }

  function addCondition() {
    const newCondition: Condition = {
      field: allFields[0]?.key || '',
      operator: 'eq',
      value: '',
    };
    onChange({
      ...normalizedGroup,
      conditions: [...normalizedGroup.conditions, newCondition],
    });
  }

  function removeCondition(index: number) {
    const newConditions = normalizedGroup.conditions.filter((_, i) => i !== index);
    onChange({ ...normalizedGroup, conditions: newConditions });
  }

  function toggleLogic() {
    onChange({
      ...normalizedGroup,
      logic: normalizedGroup.logic === 'AND' ? 'OR' : 'AND',
    });
  }

  const operatorRequiresValue = (operator: ConditionOperator) => {
    return OPERATORS.find(o => o.value === operator)?.requiresValue !== false;
  };

  return (
    <div className="space-y-3">
      {/* Logic Toggle */}
      {normalizedGroup.conditions.length > 1 && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-slate-500 dark:text-slate-400">Match</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleLogic}
            disabled={readOnly}
          >
            {normalizedGroup.logic === 'AND' ? 'All conditions' : 'Any condition'}
          </Button>
        </div>
      )}

      {/* Conditions List */}
      {(normalizedGroup.conditions as Condition[]).map((condition, index) => (
        <div
          key={index}
          className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
        >
          {!readOnly && (
            <GripVertical className="w-4 h-4 text-slate-400 cursor-grab" />
          )}

          {/* Field */}
          <Select
            value={condition.field}
            onValueChange={(value) => updateCondition(index, { field: value })}
            disabled={readOnly}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Field" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="" disabled>Select field</SelectItem>
              {allFields.map((field) => (
                <SelectItem key={field.key} value={field.key}>
                  {field.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Operator */}
          <Select
            value={condition.operator}
            onValueChange={(value) => updateCondition(index, { operator: value as ConditionOperator })}
            disabled={readOnly}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Operator" />
            </SelectTrigger>
            <SelectContent>
              {OPERATORS.map((op) => (
                <SelectItem key={op.value} value={op.value}>
                  {op.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Value */}
          {operatorRequiresValue(condition.operator) && (
            <Input
              value={condition.value as string || ''}
              onChange={(e) => updateCondition(index, { value: e.target.value })}
              placeholder="Value"
              className="flex-1"
              disabled={readOnly}
            />
          )}

          {/* Remove */}
          {!readOnly && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeCondition(index)}
              className="text-slate-400 hover:text-red-500"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}

          {/* AND/OR badge between conditions */}
          {index < normalizedGroup.conditions.length - 1 && (
            <Badge variant="outline" className="absolute -bottom-3 left-1/2 transform -translate-x-1/2">
              {normalizedGroup.logic}
            </Badge>
          )}
        </div>
      ))}

      {/* Add Condition Button */}
      {!readOnly && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addCondition}
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Condition
        </Button>
      )}

      {normalizedGroup.conditions.length === 0 && (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-4">
          No conditions defined. All records will match.
        </p>
      )}
    </div>
  );
}
