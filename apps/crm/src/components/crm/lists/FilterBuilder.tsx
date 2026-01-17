'use client';

import { useState, useCallback } from 'react';
import { cn } from '@crm-eco/ui/lib/utils';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@crm-eco/ui/components/select';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@crm-eco/ui/components/sheet';
import {
    Filter,
    Plus,
    Trash2,
    X,
    ChevronDown,
} from 'lucide-react';
import type { CrmField, FieldType } from '@/lib/crm/types';

// ============================================================================
// Types
// ============================================================================

export type FilterOperator =
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'not_contains'
    | 'starts_with'
    | 'ends_with'
    | 'is_empty'
    | 'is_not_empty'
    | 'greater_than'
    | 'less_than'
    | 'greater_or_equal'
    | 'less_or_equal'
    | 'between'
    | 'in'
    | 'not_in';

export interface FilterCondition {
    id: string;
    fieldKey: string;
    operator: FilterOperator;
    value: string | string[];
}

export interface FilterGroup {
    id: string;
    logic: 'and' | 'or';
    conditions: FilterCondition[];
}

export interface FilterConfig {
    logic: 'and' | 'or';
    groups: FilterGroup[];
}

export interface FilterBuilderProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    fields: CrmField[];
    currentFilter?: FilterConfig;
    onApply: (filter: FilterConfig) => void;
    onClear: () => void;
}

// ============================================================================
// Operator Configurations
// ============================================================================

interface OperatorConfig {
    key: FilterOperator;
    label: string;
    requiresValue: boolean;
    supportsMultiple?: boolean;
}

const TEXT_OPERATORS: OperatorConfig[] = [
    { key: 'equals', label: 'equals', requiresValue: true },
    { key: 'not_equals', label: 'does not equal', requiresValue: true },
    { key: 'contains', label: 'contains', requiresValue: true },
    { key: 'not_contains', label: 'does not contain', requiresValue: true },
    { key: 'starts_with', label: 'starts with', requiresValue: true },
    { key: 'ends_with', label: 'ends with', requiresValue: true },
    { key: 'is_empty', label: 'is empty', requiresValue: false },
    { key: 'is_not_empty', label: 'is not empty', requiresValue: false },
];

const NUMBER_OPERATORS: OperatorConfig[] = [
    { key: 'equals', label: 'equals', requiresValue: true },
    { key: 'not_equals', label: 'does not equal', requiresValue: true },
    { key: 'greater_than', label: 'greater than', requiresValue: true },
    { key: 'less_than', label: 'less than', requiresValue: true },
    { key: 'greater_or_equal', label: 'greater or equal', requiresValue: true },
    { key: 'less_or_equal', label: 'less or equal', requiresValue: true },
    { key: 'between', label: 'between', requiresValue: true },
    { key: 'is_empty', label: 'is empty', requiresValue: false },
    { key: 'is_not_empty', label: 'is not empty', requiresValue: false },
];

const DATE_OPERATORS: OperatorConfig[] = [
    { key: 'equals', label: 'equals', requiresValue: true },
    { key: 'not_equals', label: 'does not equal', requiresValue: true },
    { key: 'greater_than', label: 'after', requiresValue: true },
    { key: 'less_than', label: 'before', requiresValue: true },
    { key: 'between', label: 'between', requiresValue: true },
    { key: 'is_empty', label: 'is empty', requiresValue: false },
    { key: 'is_not_empty', label: 'is not empty', requiresValue: false },
];

const SELECT_OPERATORS: OperatorConfig[] = [
    { key: 'equals', label: 'is', requiresValue: true },
    { key: 'not_equals', label: 'is not', requiresValue: true },
    { key: 'in', label: 'is any of', requiresValue: true, supportsMultiple: true },
    { key: 'not_in', label: 'is none of', requiresValue: true, supportsMultiple: true },
    { key: 'is_empty', label: 'is empty', requiresValue: false },
    { key: 'is_not_empty', label: 'is not empty', requiresValue: false },
];

const BOOLEAN_OPERATORS: OperatorConfig[] = [
    { key: 'equals', label: 'is', requiresValue: true },
];

function getOperatorsForFieldType(fieldType: FieldType): OperatorConfig[] {
    switch (fieldType) {
        case 'number':
        case 'currency':
            return NUMBER_OPERATORS;
        case 'date':
        case 'datetime':
            return DATE_OPERATORS;
        case 'select':
        case 'multiselect':
        case 'user':
        case 'lookup':
            return SELECT_OPERATORS;
        case 'boolean':
            return BOOLEAN_OPERATORS;
        default:
            return TEXT_OPERATORS;
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(): string {
    return Math.random().toString(36).slice(2, 11);
}

function createEmptyCondition(): FilterCondition {
    return {
        id: generateId(),
        fieldKey: '',
        operator: 'equals',
        value: '',
    };
}

function createEmptyGroup(): FilterGroup {
    return {
        id: generateId(),
        logic: 'and',
        conditions: [createEmptyCondition()],
    };
}

function createEmptyFilter(): FilterConfig {
    return {
        logic: 'and',
        groups: [createEmptyGroup()],
    };
}

// ============================================================================
// Subcomponents
// ============================================================================

interface ConditionRowProps {
    condition: FilterCondition;
    fields: CrmField[];
    isFirst: boolean;
    groupLogic: 'and' | 'or';
    onUpdate: (condition: FilterCondition) => void;
    onRemove: () => void;
}

function ConditionRow({
    condition,
    fields,
    isFirst,
    groupLogic,
    onUpdate,
    onRemove,
}: ConditionRowProps) {
    const selectedField = fields.find(f => f.key === condition.fieldKey);
    const operators = selectedField ? getOperatorsForFieldType(selectedField.type) : TEXT_OPERATORS;
    const selectedOperator = operators.find(o => o.key === condition.operator);

    const handleFieldChange = (fieldKey: string) => {
        const field = fields.find(f => f.key === fieldKey);
        const newOperators = field ? getOperatorsForFieldType(field.type) : TEXT_OPERATORS;
        onUpdate({
            ...condition,
            fieldKey,
            operator: newOperators[0].key,
            value: '',
        });
    };

    const renderValueInput = () => {
        if (!selectedOperator?.requiresValue) return null;
        if (!selectedField) return null;

        if (selectedField.type === 'select' || selectedField.type === 'multiselect') {
            return (
                <Select
                    value={Array.isArray(condition.value) ? condition.value[0] : condition.value}
                    onValueChange={(value) => onUpdate({ ...condition, value })}
                >
                    <SelectTrigger className="w-[180px] h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                        <SelectValue placeholder="Select value" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-900">
                        {selectedField.options.map((option) => (
                            <SelectItem key={option} value={option}>
                                {option}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            );
        }

        if (selectedField.type === 'boolean') {
            return (
                <Select
                    value={Array.isArray(condition.value) ? condition.value[0] : condition.value}
                    onValueChange={(value) => onUpdate({ ...condition, value })}
                >
                    <SelectTrigger className="w-[120px] h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                        <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-900">
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                </Select>
            );
        }

        if (selectedField.type === 'date' || selectedField.type === 'datetime') {
            return (
                <Input
                    type="date"
                    value={Array.isArray(condition.value) ? condition.value[0] : condition.value}
                    onChange={(e) => onUpdate({ ...condition, value: e.target.value })}
                    className="w-[160px] h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                />
            );
        }

        if (selectedField.type === 'number' || selectedField.type === 'currency') {
            return (
                <Input
                    type="number"
                    placeholder="Enter value"
                    value={Array.isArray(condition.value) ? condition.value[0] : condition.value}
                    onChange={(e) => onUpdate({ ...condition, value: e.target.value })}
                    className="w-[140px] h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                />
            );
        }

        return (
            <Input
                type="text"
                placeholder="Enter value"
                value={Array.isArray(condition.value) ? condition.value[0] : condition.value}
                onChange={(e) => onUpdate({ ...condition, value: e.target.value })}
                className="w-[180px] h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
            />
        );
    };

    return (
        <div className="flex items-center gap-2 py-2">
            {/* Logic Label */}
            <div className="w-14 flex-shrink-0">
                {!isFirst && (
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                        {groupLogic}
                    </span>
                )}
            </div>

            {/* Field Select */}
            <Select value={condition.fieldKey} onValueChange={handleFieldChange}>
                <SelectTrigger className="w-[160px] h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                    <SelectValue placeholder="Select field" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900 max-h-[300px]">
                    {fields.map((field) => (
                        <SelectItem key={field.key} value={field.key}>
                            {field.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/* Operator Select */}
            <Select
                value={condition.operator}
                onValueChange={(op) => onUpdate({ ...condition, operator: op as FilterOperator })}
            >
                <SelectTrigger className="w-[150px] h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                    <SelectValue placeholder="Select operator" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900">
                    {operators.map((op) => (
                        <SelectItem key={op.key} value={op.key}>
                            {op.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/* Value Input */}
            {renderValueInput()}

            {/* Remove Button */}
            <Button
                variant="ghost"
                size="icon"
                onClick={onRemove}
                className="h-9 w-9 text-slate-400 hover:text-red-500 flex-shrink-0"
            >
                <X className="w-4 h-4" />
            </Button>
        </div>
    );
}

// ============================================================================
// Main Component
// ============================================================================

export function FilterBuilder({
    open,
    onOpenChange,
    fields,
    currentFilter,
    onApply,
    onClear,
}: FilterBuilderProps) {
    const [filter, setFilter] = useState<FilterConfig>(
        currentFilter || createEmptyFilter()
    );

    const handleAddCondition = useCallback((groupId: string) => {
        setFilter(prev => ({
            ...prev,
            groups: prev.groups.map(g =>
                g.id === groupId
                    ? { ...g, conditions: [...g.conditions, createEmptyCondition()] }
                    : g
            ),
        }));
    }, []);

    const handleUpdateCondition = useCallback((groupId: string, condition: FilterCondition) => {
        setFilter(prev => ({
            ...prev,
            groups: prev.groups.map(g =>
                g.id === groupId
                    ? {
                          ...g,
                          conditions: g.conditions.map(c =>
                              c.id === condition.id ? condition : c
                          ),
                      }
                    : g
            ),
        }));
    }, []);

    const handleRemoveCondition = useCallback((groupId: string, conditionId: string) => {
        setFilter(prev => ({
            ...prev,
            groups: prev.groups.map(g =>
                g.id === groupId
                    ? { ...g, conditions: g.conditions.filter(c => c.id !== conditionId) }
                    : g
            ).filter(g => g.conditions.length > 0),
        }));
    }, []);

    const handleAddGroup = useCallback(() => {
        setFilter(prev => ({
            ...prev,
            groups: [...prev.groups, createEmptyGroup()],
        }));
    }, []);

    const handleRemoveGroup = useCallback((groupId: string) => {
        setFilter(prev => ({
            ...prev,
            groups: prev.groups.filter(g => g.id !== groupId),
        }));
    }, []);

    const handleGroupLogicChange = useCallback((groupId: string, logic: 'and' | 'or') => {
        setFilter(prev => ({
            ...prev,
            groups: prev.groups.map(g =>
                g.id === groupId ? { ...g, logic } : g
            ),
        }));
    }, []);

    const handleApply = () => {
        // Filter out incomplete conditions
        const validFilter: FilterConfig = {
            ...filter,
            groups: filter.groups
                .map(g => ({
                    ...g,
                    conditions: g.conditions.filter(c => c.fieldKey && c.operator),
                }))
                .filter(g => g.conditions.length > 0),
        };
        onApply(validFilter);
        onOpenChange(false);
    };

    const handleClear = () => {
        setFilter(createEmptyFilter());
        onClear();
        onOpenChange(false);
    };

    const activeFilterCount = filter.groups.reduce(
        (sum, g) => sum + g.conditions.filter(c => c.fieldKey && c.operator).length,
        0
    );

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-2xl bg-white dark:bg-slate-950 overflow-y-auto">
                <SheetHeader className="pb-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-teal-100 dark:bg-teal-500/20 rounded-lg">
                            <Filter className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                        </div>
                        <div>
                            <SheetTitle className="text-slate-900 dark:text-white">
                                Filter Records
                            </SheetTitle>
                            <SheetDescription>
                                Build advanced filters to find specific records
                            </SheetDescription>
                        </div>
                    </div>
                </SheetHeader>

                <div className="py-6 space-y-6">
                    {/* Filter Groups */}
                    {filter.groups.map((group, groupIndex) => (
                        <div
                            key={group.id}
                            className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800"
                        >
                            {/* Group Header */}
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    {groupIndex > 0 && (
                                        <span className="text-xs font-medium text-slate-500 uppercase px-2 py-1 bg-slate-200 dark:bg-slate-800 rounded">
                                            {filter.logic}
                                        </span>
                                    )}
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Filter Group {groupIndex + 1}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* Group Logic Toggle */}
                                    <div className="flex items-center bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-0.5">
                                        <button
                                            onClick={() => handleGroupLogicChange(group.id, 'and')}
                                            className={cn(
                                                'px-2.5 py-1 text-xs font-medium rounded transition-colors',
                                                group.logic === 'and'
                                                    ? 'bg-teal-500 text-white'
                                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                            )}
                                        >
                                            AND
                                        </button>
                                        <button
                                            onClick={() => handleGroupLogicChange(group.id, 'or')}
                                            className={cn(
                                                'px-2.5 py-1 text-xs font-medium rounded transition-colors',
                                                group.logic === 'or'
                                                    ? 'bg-teal-500 text-white'
                                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                            )}
                                        >
                                            OR
                                        </button>
                                    </div>
                                    {filter.groups.length > 1 && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleRemoveGroup(group.id)}
                                            className="h-8 w-8 text-slate-400 hover:text-red-500"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Conditions */}
                            <div className="space-y-1">
                                {group.conditions.map((condition, conditionIndex) => (
                                    <ConditionRow
                                        key={condition.id}
                                        condition={condition}
                                        fields={fields}
                                        isFirst={conditionIndex === 0}
                                        groupLogic={group.logic}
                                        onUpdate={(c) => handleUpdateCondition(group.id, c)}
                                        onRemove={() => handleRemoveCondition(group.id, condition.id)}
                                    />
                                ))}
                            </div>

                            {/* Add Condition Button */}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleAddCondition(group.id)}
                                className="mt-2 text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300"
                            >
                                <Plus className="w-4 h-4 mr-1" />
                                Add condition
                            </Button>
                        </div>
                    ))}

                    {/* Add Group Button */}
                    <Button
                        variant="outline"
                        onClick={handleAddGroup}
                        className="w-full border-dashed border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-teal-500 hover:text-teal-600 dark:hover:text-teal-400"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Add filter group
                    </Button>
                </div>

                {/* Footer Actions */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <Button
                        variant="ghost"
                        onClick={handleClear}
                        className="text-slate-600 dark:text-slate-400"
                    >
                        Clear all
                    </Button>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleApply}
                            className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white"
                        >
                            Apply {activeFilterCount > 0 && `(${activeFilterCount})`}
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
