'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft,
    Plus,
    GripVertical,
    Pencil,
    Trash2,
    Star,
    Loader2,
    Check,
    X,
    Save,
    AlertCircle,
    ChevronDown,
    ChevronUp,
    Eye,
    EyeOff,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Switch } from '@crm-eco/ui/components/switch';
import { Textarea } from '@crm-eco/ui/components/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@crm-eco/ui/components/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@crm-eco/ui/components/dialog';
import { cn } from '@crm-eco/ui/lib/utils';
import type { CrmModule, CrmField, FieldType } from '@/lib/crm/types';

// ============================================================================
// Types
// ============================================================================

interface FieldsManagerClientProps {
    modules: CrmModule[];
    selectedModule: CrmModule | null;
    initialFields: CrmField[];
    orgId: string;
}

interface FieldUpdate {
    id: string;
    display_order?: number;
    is_pinned?: boolean;
    label?: string;
    required?: boolean;
    options?: string[];
    tooltip?: string;
}

// ============================================================================
// Constants
// ============================================================================

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
    text: 'Text',
    textarea: 'Long Text',
    number: 'Number',
    currency: 'Currency',
    date: 'Date',
    datetime: 'Date & Time',
    boolean: 'Checkbox',
    select: 'Dropdown',
    multiselect: 'Multi-Select',
    email: 'Email',
    phone: 'Phone',
    url: 'URL',
    lookup: 'Lookup',
    user: 'User',
};

const FIELD_TYPE_OPTIONS: FieldType[] = [
    'text', 'textarea', 'number', 'currency', 'date', 'datetime',
    'boolean', 'select', 'multiselect', 'email', 'phone', 'url',
];

// ============================================================================
// Helper Components
// ============================================================================

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={cn(
            'fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg',
            type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        )}>
            {type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {message}
            <button onClick={onClose} className="ml-2 hover:opacity-80">
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}

// ============================================================================
// Field Row Component with Drag Handle
// ============================================================================

interface FieldRowProps {
    field: CrmField;
    index: number;
    onDragStart: (index: number) => void;
    onDragEnter: (index: number) => void;
    onDragEnd: () => void;
    onTogglePin: (field: CrmField) => void;
    onToggleVisibility: (field: CrmField) => void;
    onEdit: (field: CrmField) => void;
    onDelete: (field: CrmField) => void;
    isDragging: boolean;
    isPinLoading: string | null;
}

function FieldRow({
    field,
    index,
    onDragStart,
    onDragEnter,
    onDragEnd,
    onTogglePin,
    onToggleVisibility,
    onEdit,
    onDelete,
    isDragging,
    isPinLoading,
}: FieldRowProps) {
    const isLoading = isPinLoading === field.id;

    return (
        <div
            draggable
            onDragStart={() => onDragStart(index)}
            onDragEnter={() => onDragEnter(index)}
            onDragEnd={onDragEnd}
            onDragOver={(e) => e.preventDefault()}
            className={cn(
                'flex items-center gap-3 p-3 rounded-lg transition-all duration-200 group',
                'bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700',
                'hover:border-slate-300 dark:hover:border-slate-600',
                isDragging && 'opacity-50 scale-[0.98]',
                !field.is_pinned && 'opacity-60'
            )}
        >
            {/* Drag Handle */}
            <div className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 touch-none">
                <GripVertical className="w-5 h-5" />
            </div>

            {/* Visibility Toggle */}
            <button
                onClick={() => onToggleVisibility(field)}
                disabled={isLoading || field.is_system}
                className={cn(
                    'p-1.5 rounded-md transition-colors',
                    field.is_pinned
                        ? 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10'
                        : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700',
                    (isLoading || field.is_system) && 'opacity-50 cursor-not-allowed'
                )}
                title={field.is_pinned ? 'Visible in views (click to hide)' : 'Hidden from views (click to show)'}
            >
                {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : field.is_pinned ? (
                    <Eye className="w-4 h-4" />
                ) : (
                    <EyeOff className="w-4 h-4" />
                )}
            </button>

            {/* Pin/Star Toggle */}
            <button
                onClick={() => onTogglePin(field)}
                disabled={isLoading}
                className={cn(
                    'p-1.5 rounded-md transition-colors',
                    field.is_pinned
                        ? 'text-amber-500 hover:text-amber-600'
                        : 'text-slate-300 dark:text-slate-600 hover:text-amber-400',
                    isLoading && 'opacity-50'
                )}
                title={field.is_pinned ? 'Unpin field' : 'Pin field (always visible)'}
            >
                <Star className={cn('w-4 h-4', field.is_pinned && 'fill-current')} />
            </button>

            {/* Field Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900 dark:text-white">{field.label}</span>
                    {field.required && (
                        <span className="text-red-500 dark:text-red-400 text-xs font-bold">*</span>
                    )}
                    {field.is_system && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium uppercase bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded">
                            System
                        </span>
                    )}
                </div>
                <span className="text-sm text-slate-500 dark:text-slate-400 font-mono">{field.key}</span>
            </div>

            {/* Field Type Badge */}
            <span className="px-2.5 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md">
                {FIELD_TYPE_LABELS[field.type] || field.type}
            </span>

            {/* Section */}
            <span className="w-20 text-sm text-slate-500 dark:text-slate-400 text-right truncate">
                {field.section}
            </span>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {!field.is_system && (
                    <>
                        <button
                            onClick={() => onEdit(field)}
                            className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            title="Edit field"
                        >
                            <Pencil className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => onDelete(field)}
                            className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                            title="Delete field"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

// ============================================================================
// Main Component
// ============================================================================

export function FieldsManagerClient({
    modules,
    selectedModule,
    initialFields,
    orgId,
}: FieldsManagerClientProps) {
    const router = useRouter();
    const [fields, setFields] = useState<CrmField[]>(initialFields);
    const [hasChanges, setHasChanges] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isPinLoading, setIsPinLoading] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // Drag state
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    // Dialog states
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [editingField, setEditingField] = useState<CrmField | null>(null);
    const [deletingField, setDeletingField] = useState<CrmField | null>(null);

    // New field form
    const [newField, setNewField] = useState({
        label: '',
        key: '',
        type: 'text' as FieldType,
        required: false,
        options: '',
        section: 'core',
        tooltip: '',
    });
    const [isCreating, setIsCreating] = useState(false);

    // Group fields by section
    const fieldsBySection = fields.reduce((acc, field) => {
        const section = field.section || 'core';
        if (!acc[section]) acc[section] = [];
        acc[section].push(field);
        return acc;
    }, {} as Record<string, CrmField[]>);

    // Sort sections and fields
    const sortedSections = Object.keys(fieldsBySection).sort((a, b) => {
        if (a === 'core') return -1;
        if (b === 'core') return 1;
        return a.localeCompare(b);
    });

    // Create field index lookup map for O(1) access instead of O(n) findIndex
    const fieldIndexMap = useMemo(() => {
        return fields.reduce((acc, field, index) => {
            acc[field.id] = index;
            return acc;
        }, {} as Record<string, number>);
    }, [fields]);

    // ========================================================================
    // Drag and Drop Handlers
    // ========================================================================

    const handleDragStart = useCallback((index: number) => {
        setDragIndex(index);
    }, []);

    const handleDragEnter = useCallback((index: number) => {
        setDragOverIndex(index);
    }, []);

    const handleDragEnd = useCallback(() => {
        if (dragIndex === null || dragOverIndex === null || dragIndex === dragOverIndex) {
            setDragIndex(null);
            setDragOverIndex(null);
            return;
        }

        // Reorder fields
        const newFields = [...fields];
        const [draggedItem] = newFields.splice(dragIndex, 1);
        newFields.splice(dragOverIndex, 0, draggedItem);

        // Update display_order for all fields
        const updatedFields = newFields.map((field, idx) => ({
            ...field,
            display_order: idx + 1,
        }));

        setFields(updatedFields);
        setHasChanges(true);
        setDragIndex(null);
        setDragOverIndex(null);
    }, [dragIndex, dragOverIndex, fields]);

    // ========================================================================
    // API Handlers
    // ========================================================================

    const saveFieldOrder = useCallback(async () => {
        if (!hasChanges || !selectedModule) return;

        setIsSaving(true);
        try {
            const updates = fields.map((field, index) => ({
                id: field.id,
                display_order: index + 1,
            }));

            const response = await fetch('/api/crm/fields/reorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fields: updates }),
            });

            if (response.ok) {
                setHasChanges(false);
                setToast({ message: 'Field order saved successfully', type: 'success' });
            } else {
                throw new Error('Failed to save');
            }
        } catch (error) {
            console.error('Error saving field order:', error);
            setToast({ message: 'Failed to save field order', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    }, [hasChanges, fields, selectedModule]);

    const toggleFieldPin = useCallback(async (field: CrmField) => {
        setIsPinLoading(field.id);
        try {
            const response = await fetch(`/api/crm/fields/${field.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_pinned: !field.is_pinned }),
            });

            if (response.ok) {
                setFields(prev => prev.map(f =>
                    f.id === field.id ? { ...f, is_pinned: !f.is_pinned } : f
                ));
                setToast({ message: field.is_pinned ? 'Field unpinned' : 'Field pinned', type: 'success' });
            } else {
                throw new Error('Failed to update');
            }
        } catch (error) {
            console.error('Error toggling pin:', error);
            setToast({ message: 'Failed to update field', type: 'error' });
        } finally {
            setIsPinLoading(null);
        }
    }, []);

    const toggleFieldVisibility = useCallback(async (field: CrmField) => {
        // For now, visibility is tied to is_pinned
        await toggleFieldPin(field);
    }, [toggleFieldPin]);

    const createField = useCallback(async () => {
        if (!newField.label.trim() || !selectedModule) return;

        setIsCreating(true);
        try {
            const options = newField.options
                .split('\n')
                .map(o => o.trim())
                .filter(Boolean);

            const response = await fetch('/api/crm/fields', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    org_id: orgId,
                    module_id: selectedModule.id,
                    label: newField.label,
                    key: newField.key || newField.label.toLowerCase().replace(/[^a-z0-9]/g, '_'),
                    type: newField.type,
                    required: newField.required,
                    options: ['select', 'multiselect'].includes(newField.type) ? options : [],
                    section: newField.section || 'core',
                    tooltip: newField.tooltip,
                }),
            });

            if (response.ok) {
                const field = await response.json();
                setFields(prev => [...prev, field]);
                setShowCreateDialog(false);
                setNewField({
                    label: '',
                    key: '',
                    type: 'text',
                    required: false,
                    options: '',
                    section: 'core',
                    tooltip: '',
                });
                setToast({ message: 'Field created successfully', type: 'success' });
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create field');
            }
        } catch (error) {
            console.error('Error creating field:', error);
            setToast({ message: 'Failed to create field', type: 'error' });
        } finally {
            setIsCreating(false);
        }
    }, [newField, selectedModule, orgId]);

    const updateField = useCallback(async () => {
        if (!editingField) return;

        setIsSaving(true);
        try {
            const response = await fetch(`/api/crm/fields/${editingField.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    label: editingField.label,
                    required: editingField.required,
                    options: editingField.options,
                    tooltip: editingField.tooltip,
                }),
            });

            if (response.ok) {
                setFields(prev => prev.map(f =>
                    f.id === editingField.id ? editingField : f
                ));
                setShowEditDialog(false);
                setEditingField(null);
                setToast({ message: 'Field updated successfully', type: 'success' });
            } else {
                throw new Error('Failed to update');
            }
        } catch (error) {
            console.error('Error updating field:', error);
            setToast({ message: 'Failed to update field', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    }, [editingField]);

    const deleteField = useCallback(async () => {
        if (!deletingField) return;

        setIsSaving(true);
        try {
            const response = await fetch(`/api/crm/fields/${deletingField.id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setFields(prev => prev.filter(f => f.id !== deletingField.id));
                setShowDeleteDialog(false);
                setDeletingField(null);
                setToast({ message: 'Field deleted successfully', type: 'success' });
            } else {
                throw new Error('Failed to delete');
            }
        } catch (error) {
            console.error('Error deleting field:', error);
            setToast({ message: 'Failed to delete field', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    }, [deletingField]);

    // ========================================================================
    // Render
    // ========================================================================

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/crm/settings"
                        className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Fields</h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">
                            Customize fields for each module
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {hasChanges && (
                        <Button
                            onClick={saveFieldOrder}
                            disabled={isSaving}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white"
                        >
                            {isSaving ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4 mr-2" />
                            )}
                            Save Order
                        </Button>
                    )}
                    <Button
                        onClick={() => setShowCreateDialog(true)}
                        disabled={!selectedModule}
                        className="bg-teal-600 hover:bg-teal-500 text-white"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        New Field
                    </Button>
                </div>
            </div>

            {/* Module Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2">
                {modules.map((module) => (
                    <Link
                        key={module.id}
                        href={`/crm/settings/fields?module=${module.id}`}
                        className={cn(
                            'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                            selectedModule?.id === module.id
                                ? 'bg-teal-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        )}
                    >
                        {module.name}
                    </Link>
                ))}
            </div>

            {/* Fields List */}
            {selectedModule ? (
                <div className="space-y-6">
                    {sortedSections.map((section) => {
                        const sectionFields = fieldsBySection[section].sort(
                            (a, b) => a.display_order - b.display_order
                        );
                        const sectionStartIndex = fields.findIndex(f => f.section === section);

                        return (
                            <div
                                key={section}
                                className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden"
                            >
                                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white capitalize">
                                        {section.replace(/_/g, ' ')} ({sectionFields.length})
                                    </h2>
                                </div>
                                <div className="p-3 space-y-2">
                                    {sectionFields.map((field, idx) => {
                                        // O(1) lookup instead of O(n) findIndex
                                        const globalIndex = fieldIndexMap[field.id];
                                        return (
                                            <FieldRow
                                                key={field.id}
                                                field={field}
                                                index={globalIndex}
                                                onDragStart={handleDragStart}
                                                onDragEnter={handleDragEnter}
                                                onDragEnd={handleDragEnd}
                                                onTogglePin={toggleFieldPin}
                                                onToggleVisibility={toggleFieldVisibility}
                                                onEdit={(f) => {
                                                    setEditingField(f);
                                                    setShowEditDialog(true);
                                                }}
                                                onDelete={(f) => {
                                                    setDeletingField(f);
                                                    setShowDeleteDialog(true);
                                                }}
                                                isDragging={dragIndex === globalIndex}
                                                isPinLoading={isPinLoading}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}

                    {fields.length === 0 && (
                        <div className="text-center py-12 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl">
                            <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                            <p className="text-slate-600 dark:text-slate-400">No fields configured for this module</p>
                            <Button
                                onClick={() => setShowCreateDialog(true)}
                                className="mt-4"
                                variant="outline"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Add the first field
                            </Button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-center py-12 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl">
                    <p className="text-slate-600 dark:text-slate-400">Select a module to manage its fields</p>
                </div>
            )}

            {/* Create Field Dialog */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900">
                    <DialogHeader>
                        <DialogTitle>Create New Field</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label>Field Label *</Label>
                            <Input
                                placeholder="e.g., Annual Revenue"
                                value={newField.label}
                                onChange={(e) => {
                                    setNewField(prev => ({
                                        ...prev,
                                        label: e.target.value,
                                        key: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_'),
                                    }));
                                }}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label>Field Key</Label>
                            <Input
                                placeholder="e.g., annual_revenue"
                                value={newField.key}
                                onChange={(e) => setNewField(prev => ({ ...prev, key: e.target.value }))}
                                className="mt-1 font-mono text-sm"
                            />
                            <p className="text-xs text-slate-500 mt-1">Auto-generated from label</p>
                        </div>
                        <div>
                            <Label>Field Type</Label>
                            <Select
                                value={newField.type}
                                onValueChange={(value) => setNewField(prev => ({ ...prev, type: value as FieldType }))}
                            >
                                <SelectTrigger className="mt-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-white dark:bg-slate-900">
                                    {FIELD_TYPE_OPTIONS.map((type) => (
                                        <SelectItem key={type} value={type}>
                                            {FIELD_TYPE_LABELS[type]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {['select', 'multiselect'].includes(newField.type) && (
                            <div>
                                <Label>Options (one per line)</Label>
                                <Textarea
                                    placeholder="Option 1&#10;Option 2&#10;Option 3"
                                    value={newField.options}
                                    onChange={(e) => setNewField(prev => ({ ...prev, options: e.target.value }))}
                                    rows={4}
                                    className="mt-1"
                                />
                            </div>
                        )}
                        <div>
                            <Label>Section</Label>
                            <Input
                                placeholder="e.g., financial, contact_info"
                                value={newField.section}
                                onChange={(e) => setNewField(prev => ({ ...prev, section: e.target.value }))}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label>Tooltip (optional)</Label>
                            <Input
                                placeholder="Help text for this field"
                                value={newField.tooltip}
                                onChange={(e) => setNewField(prev => ({ ...prev, tooltip: e.target.value }))}
                                className="mt-1"
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <Switch
                                id="required"
                                checked={newField.required}
                                onCheckedChange={(checked) => setNewField(prev => ({ ...prev, required: checked }))}
                            />
                            <Label htmlFor="required">Required field</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={createField}
                            disabled={!newField.label.trim() || isCreating}
                            className="bg-teal-600 hover:bg-teal-500 text-white"
                        >
                            {isCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                            Create Field
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Field Dialog */}
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900">
                    <DialogHeader>
                        <DialogTitle>Edit Field</DialogTitle>
                    </DialogHeader>
                    {editingField && (
                        <div className="space-y-4 py-4">
                            <div>
                                <Label>Field Label</Label>
                                <Input
                                    value={editingField.label}
                                    onChange={(e) => setEditingField(prev => prev ? { ...prev, label: e.target.value } : null)}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label>Field Key</Label>
                                <Input
                                    value={editingField.key}
                                    disabled
                                    className="mt-1 font-mono text-sm bg-slate-100 dark:bg-slate-800"
                                />
                                <p className="text-xs text-slate-500 mt-1">Key cannot be changed</p>
                            </div>
                            <div>
                                <Label>Type</Label>
                                <Input
                                    value={FIELD_TYPE_LABELS[editingField.type] || editingField.type}
                                    disabled
                                    className="mt-1 bg-slate-100 dark:bg-slate-800"
                                />
                            </div>
                            {['select', 'multiselect'].includes(editingField.type) && (
                                <div>
                                    <Label>Options (one per line)</Label>
                                    <Textarea
                                        value={editingField.options?.join('\n') || ''}
                                        onChange={(e) => setEditingField(prev => prev ? {
                                            ...prev,
                                            options: e.target.value.split('\n').map(o => o.trim()).filter(Boolean)
                                        } : null)}
                                        rows={4}
                                        className="mt-1"
                                    />
                                </div>
                            )}
                            <div>
                                <Label>Tooltip</Label>
                                <Input
                                    value={editingField.tooltip || ''}
                                    onChange={(e) => setEditingField(prev => prev ? { ...prev, tooltip: e.target.value } : null)}
                                    className="mt-1"
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                <Switch
                                    id="edit-required"
                                    checked={editingField.required}
                                    onCheckedChange={(checked) => setEditingField(prev => prev ? { ...prev, required: checked } : null)}
                                />
                                <Label htmlFor="edit-required">Required field</Label>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={updateField}
                            disabled={isSaving}
                            className="bg-teal-600 hover:bg-teal-500 text-white"
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900">
                    <DialogHeader>
                        <DialogTitle className="text-red-600">Delete Field</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <p className="text-slate-600 dark:text-slate-400">
                            Are you sure you want to delete the field <strong className="text-slate-900 dark:text-white">&quot;{deletingField?.label}&quot;</strong>?
                        </p>
                        <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                            This action cannot be undone. All data stored in this field will be lost.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={deleteField}
                            disabled={isSaving}
                            className="bg-red-600 hover:bg-red-500 text-white"
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                            Delete Field
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Toast Notification */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
}
