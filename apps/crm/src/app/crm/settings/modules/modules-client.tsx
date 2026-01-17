'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Plus,
    GripVertical,
    Pencil,
    Trash2,
    Loader2,
    AlertCircle,
    Check,
    ChevronUp,
    ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import type { CrmModule } from '@/lib/crm/types';

interface ModulesClientProps {
    initialModules: CrmModule[];
    orgId: string;
}

export default function ModulesClient({ initialModules, orgId }: ModulesClientProps) {
    const router = useRouter();
    const [modules, setModules] = useState<CrmModule[]>(
        [...initialModules].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    );
    const [loading, setLoading] = useState<Record<string, boolean>>({});
    const [draggedId, setDraggedId] = useState<string | null>(null);

    // Toggle module enabled/disabled
    const toggleModule = useCallback(async (module: CrmModule) => {
        const newEnabled = !module.is_enabled;

        // Optimistic update
        setModules(prev => prev.map(m =>
            m.id === module.id ? { ...m, is_enabled: newEnabled } : m
        ));
        setLoading(prev => ({ ...prev, [module.id]: true }));

        try {
            const res = await fetch(`/api/crm/modules/${module.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_enabled: newEnabled }),
            });

            if (!res.ok) {
                throw new Error('Failed to update module');
            }

            toast.success(`${module.name} ${newEnabled ? 'enabled' : 'disabled'}`);
            router.refresh();
        } catch (error) {
            // Revert on error
            setModules(prev => prev.map(m =>
                m.id === module.id ? { ...m, is_enabled: module.is_enabled } : m
            ));
            toast.error('Failed to update module');
        } finally {
            setLoading(prev => ({ ...prev, [module.id]: false }));
        }
    }, [router]);

    // Move module up in order
    const moveUp = useCallback(async (index: number) => {
        if (index === 0) return;

        const newModules = [...modules];
        const temp = newModules[index];
        newModules[index] = newModules[index - 1];
        newModules[index - 1] = temp;

        // Update display orders
        const updates = newModules.map((m, i) => ({ id: m.id, display_order: i }));
        setModules(newModules.map((m, i) => ({ ...m, display_order: i })));

        try {
            // Update both modules
            await Promise.all([
                fetch(`/api/crm/modules/${updates[index].id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ display_order: updates[index].display_order }),
                }),
                fetch(`/api/crm/modules/${updates[index - 1].id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ display_order: updates[index - 1].display_order }),
                }),
            ]);
            router.refresh();
        } catch (error) {
            toast.error('Failed to reorder modules');
            setModules(initialModules);
        }
    }, [modules, initialModules, router]);

    // Move module down in order
    const moveDown = useCallback(async (index: number) => {
        if (index === modules.length - 1) return;

        const newModules = [...modules];
        const temp = newModules[index];
        newModules[index] = newModules[index + 1];
        newModules[index + 1] = temp;

        // Update display orders
        const updates = newModules.map((m, i) => ({ id: m.id, display_order: i }));
        setModules(newModules.map((m, i) => ({ ...m, display_order: i })));

        try {
            await Promise.all([
                fetch(`/api/crm/modules/${updates[index].id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ display_order: updates[index].display_order }),
                }),
                fetch(`/api/crm/modules/${updates[index + 1].id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ display_order: updates[index + 1].display_order }),
                }),
            ]);
            router.refresh();
        } catch (error) {
            toast.error('Failed to reorder modules');
            setModules(initialModules);
        }
    }, [modules, initialModules, router]);

    // Drag handlers
    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedId(id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();
        if (!draggedId) return;

        const sourceIndex = modules.findIndex(m => m.id === draggedId);
        if (sourceIndex === targetIndex) {
            setDraggedId(null);
            return;
        }

        const newModules = [...modules];
        const [removed] = newModules.splice(sourceIndex, 1);
        newModules.splice(targetIndex, 0, removed);

        // Update all display orders
        const updatedModules = newModules.map((m, i) => ({ ...m, display_order: i }));
        setModules(updatedModules);
        setDraggedId(null);

        try {
            // Update all modules that changed position
            await Promise.all(
                updatedModules.map((m, i) =>
                    fetch(`/api/crm/modules/${m.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ display_order: i }),
                    })
                )
            );
            router.refresh();
            toast.success('Module order updated');
        } catch (error) {
            toast.error('Failed to reorder modules');
            setModules(initialModules);
        }
    };

    const handleDragEnd = () => {
        setDraggedId(null);
    };

    // Delete module
    const deleteModule = useCallback(async (module: CrmModule) => {
        if (module.is_system) {
            toast.error('System modules cannot be deleted');
            return;
        }

        if (!confirm(`Are you sure you want to delete "${module.name}"? This cannot be undone.`)) {
            return;
        }

        setLoading(prev => ({ ...prev, [module.id]: true }));

        try {
            const res = await fetch(`/api/crm/modules/${module.id}`, {
                method: 'DELETE',
            });

            if (!res.ok) {
                throw new Error('Failed to delete module');
            }

            setModules(prev => prev.filter(m => m.id !== module.id));
            toast.success(`${module.name} deleted`);
            router.refresh();
        } catch (error) {
            toast.error('Failed to delete module');
        } finally {
            setLoading(prev => ({ ...prev, [module.id]: false }));
        }
    }, [router]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/crm/settings"
                        className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Modules</h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">
                            Enable, disable, and configure CRM modules
                        </p>
                    </div>
                </div>
                <Link
                    href="/crm/settings/modules/new"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white rounded-lg transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    New Module
                </Link>
            </div>

            {/* Module List */}
            <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        {modules.length} Modules
                    </h2>
                </div>
                <div className="p-4 space-y-2">
                    {modules.map((module, index) => (
                        <div
                            key={module.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, module.id)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDrop={(e) => handleDrop(e, index)}
                            onDragEnd={handleDragEnd}
                            className={`flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/30 rounded-lg group border transition-all ${draggedId === module.id
                                    ? 'border-teal-500 opacity-50'
                                    : 'border-slate-200 dark:border-transparent hover:border-slate-300 dark:hover:border-slate-600'
                                }`}
                        >
                            {/* Drag Handle */}
                            <div className="flex flex-col items-center gap-0.5">
                                <button
                                    onClick={() => moveUp(index)}
                                    disabled={index === 0}
                                    className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <ChevronUp className="w-4 h-4" />
                                </button>
                                <div className="text-slate-400 dark:text-slate-500 cursor-grab active:cursor-grabbing">
                                    <GripVertical className="w-5 h-5" />
                                </div>
                                <button
                                    onClick={() => moveDown(index)}
                                    disabled={index === modules.length - 1}
                                    className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <ChevronDown className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Module Info */}
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-900 dark:text-white font-medium">{module.name}</span>
                                    {module.is_system && (
                                        <span className="px-1.5 py-0.5 text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded">
                                            System
                                        </span>
                                    )}
                                </div>
                                <span className="text-sm text-slate-500 dark:text-slate-400">
                                    {module.description || module.key}
                                </span>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-3">
                                {/* Toggle Switch */}
                                <button
                                    onClick={() => toggleModule(module)}
                                    disabled={loading[module.id]}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${module.is_enabled
                                            ? 'bg-teal-600'
                                            : 'bg-slate-300 dark:bg-slate-600'
                                        }`}
                                >
                                    {loading[module.id] ? (
                                        <span className="absolute inset-0 flex items-center justify-center">
                                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                                        </span>
                                    ) : (
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform ${module.is_enabled ? 'translate-x-6' : 'translate-x-1'
                                                }`}
                                        />
                                    )}
                                </button>

                                {/* Edit Fields */}
                                <Link
                                    href={`/crm/settings/fields?module=${module.id}`}
                                    className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                                    title="Edit Fields"
                                >
                                    <Pencil className="w-4 h-4" />
                                </Link>

                                {/* Delete (non-system only) */}
                                {!module.is_system && (
                                    <button
                                        onClick={() => deleteModule(module)}
                                        disabled={loading[module.id]}
                                        className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50"
                                        title="Delete Module"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}

                    {modules.length === 0 && (
                        <div className="text-center py-12">
                            <AlertCircle className="w-12 h-12 mx-auto text-slate-400 mb-3" />
                            <p className="text-slate-500 dark:text-slate-400">No modules found</p>
                            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                                Click "New Module" to create your first module
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Help Text */}
            <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    <strong className="text-slate-700 dark:text-slate-300">Tip:</strong> System modules cannot be deleted,
                    but they can be disabled. Disabling a module hides it from the sidebar but
                    preserves all data. Drag modules to reorder them or use the up/down arrows.
                </p>
            </div>
        </div>
    );
}
