'use client';

import { useState } from 'react';
import { GripVertical, Pencil, Trash2, Star, Loader2 } from 'lucide-react';
import type { CrmField } from '@/lib/crm/types';

const FIELD_TYPE_LABELS: Record<string, string> = {
    text: 'Text',
    textarea: 'Long Text',
    number: 'Number',
    date: 'Date',
    datetime: 'Date & Time',
    select: 'Dropdown',
    multiselect: 'Multi-Select',
    boolean: 'Checkbox',
    email: 'Email',
    phone: 'Phone',
    url: 'URL',
    currency: 'Currency',
    lookup: 'Lookup',
    user: 'User',
};

interface FieldRowClientProps {
    field: CrmField;
    onEdit?: (field: CrmField) => void;
    onDelete?: (field: CrmField) => void;
}

export function FieldRowClient({ field, onEdit, onDelete }: FieldRowClientProps) {
    const [isPinned, setIsPinned] = useState(field.is_pinned);
    const [isToggling, setIsToggling] = useState(false);

    const togglePin = async () => {
        setIsToggling(true);
        try {
            const res = await fetch(`/api/crm/fields/${field.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_pinned: !isPinned }),
            });

            if (res.ok) {
                setIsPinned(!isPinned);
            } else {
                console.error('Failed to toggle pin');
            }
        } catch (error) {
            console.error('Error toggling pin:', error);
        } finally {
            setIsToggling(false);
        }
    };

    return (
        <div className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg group">
            {/* Drag handle */}
            <button className="text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-grab">
                <GripVertical className="w-4 h-4" />
            </button>

            {/* Pin/Star toggle - clickable to ensure field shows in views */}
            <button
                onClick={togglePin}
                disabled={isToggling}
                className={`p-1 rounded transition-colors ${isPinned
                        ? 'text-teal-500 hover:text-teal-600'
                        : 'text-slate-300 dark:text-slate-600 hover:text-teal-400'
                    } disabled:opacity-50`}
                title={isPinned ? 'Unpin field (will hide from default views)' : 'Pin field (will always show in views)'}
            >
                {isToggling ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <Star className={`w-4 h-4 ${isPinned ? 'fill-current' : ''}`} />
                )}
            </button>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-slate-900 dark:text-white font-medium">{field.label}</span>
                    {field.required && (
                        <span className="text-amber-500 dark:text-amber-400 text-xs font-bold">*</span>
                    )}
                    {field.is_system && (
                        <span className="px-1.5 py-0.5 text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded">
                            System
                        </span>
                    )}
                </div>
                <span className="text-sm text-slate-500">{field.key}</span>
            </div>

            <span className="px-2 py-1 text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded">
                {FIELD_TYPE_LABELS[field.type] || field.type}
            </span>

            <span className="text-sm text-slate-500 dark:text-slate-400 w-24 text-right">
                {field.section}
            </span>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {!field.is_system && (
                    <>
                        <button
                            className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                            title="Edit field"
                            onClick={() => onEdit?.(field)}
                        >
                            <Pencil className="w-4 h-4" />
                        </button>
                        <button
                            className="p-1.5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                            title="Delete field"
                            onClick={() => onDelete?.(field)}
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
