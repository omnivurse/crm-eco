'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Badge } from '@crm-eco/ui/components/badge';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import {
  GitBranch,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Star,
  Trophy,
  XCircle,
  Loader2,
} from 'lucide-react';
import type { Pipeline, PipelineStage, PipelineType, PipelineWithStages } from './types';

const PIPELINE_TYPES: { value: PipelineType; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'lead', label: 'Lead' },
  { value: 'enrollment', label: 'Enrollment' },
  { value: 'support', label: 'Support' },
  { value: 'custom', label: 'Custom' },
];

const STAGE_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#f59e0b', '#10b981', '#14b8a6',
  '#06b6d4', '#3b82f6', '#64748b',
];

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

interface Props {
  initialPipelines: PipelineWithStages[];
  canDelete: boolean;
}

export function PipelineSettingsClient({ initialPipelines, canDelete }: Props) {
  const router = useRouter();
  const [pipelines, setPipelines] = useState<PipelineWithStages[]>(initialPipelines);
  const [selectedId, setSelectedId] = useState<string | null>(initialPipelines[0]?.id ?? null);
  const [pipelineDialogOpen, setPipelineDialogOpen] = useState(false);
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<PipelineStage | null>(null);
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  const selected = pipelines.find((p) => p.id === selectedId) ?? null;

  const refresh = () => startTransition(() => router.refresh());

  // ---------- Pipelines ----------

  const handleCreatePipeline = async (form: { name: string; pipeline_type: PipelineType; description: string }) => {
    setBusy(true);
    try {
      const res = await fetch('/api/crm/pipelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          key: slugify(form.name) || `pipeline_${Date.now()}`,
          pipeline_type: form.pipeline_type,
          description: form.description || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.[0]?.message || json.error || 'Failed to create');
      const created: Pipeline = json.pipeline;
      const withStages: PipelineWithStages = { ...created, crm_pipeline_stages: [] };
      setPipelines((prev) => [...prev, withStages]);
      setSelectedId(created.id);
      setPipelineDialogOpen(false);
      toast.success('Pipeline created');
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create pipeline');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdatePipeline = async (id: string, updates: Partial<Pipeline>) => {
    setBusy(true);
    try {
      const res = await fetch('/api/crm/pipelines', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.[0]?.message || json.error || 'Failed to update');
      const updated: Pipeline = json.pipeline;
      setPipelines((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...updated } : p)),
      );
      toast.success('Pipeline updated');
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update pipeline');
    } finally {
      setBusy(false);
    }
  };

  const handleDeletePipeline = async (id: string) => {
    if (!confirm('Delete this pipeline? Stages will be removed.')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/crm/pipelines?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to delete');
      }
      setPipelines((prev) => prev.filter((p) => p.id !== id));
      if (selectedId === id) setSelectedId(pipelines.find((p) => p.id !== id)?.id ?? null);
      toast.success('Pipeline deleted');
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete pipeline');
    } finally {
      setBusy(false);
    }
  };

  // ---------- Stages ----------

  const handleSaveStage = async (form: {
    id?: string;
    name: string;
    color: string;
    probability: number;
    is_won: boolean;
    is_lost: boolean;
  }) => {
    if (!selected) return;
    setBusy(true);
    try {
      let res: Response;
      if (form.id) {
        res = await fetch('/api/crm/pipelines/stages', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: form.id,
            name: form.name,
            color: form.color,
            probability: form.probability,
            is_won: form.is_won,
            is_lost: form.is_lost,
          }),
        });
      } else {
        res = await fetch('/api/crm/pipelines/stages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pipeline_id: selected.id,
            name: form.name,
            key: slugify(form.name) || `stage_${Date.now()}`,
            color: form.color,
            probability: form.probability,
            is_won: form.is_won,
            is_lost: form.is_lost,
          }),
        });
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.[0]?.message || json.error || 'Failed to save stage');
      const stage: PipelineStage = json.stage;
      setPipelines((prev) =>
        prev.map((p) => {
          if (p.id !== selected.id) return p;
          const stages = form.id
            ? p.crm_pipeline_stages.map((s) => (s.id === stage.id ? stage : s))
            : [...p.crm_pipeline_stages, stage];
          return { ...p, crm_pipeline_stages: stages.sort((a, b) => a.display_order - b.display_order) };
        }),
      );
      setStageDialogOpen(false);
      setEditingStage(null);
      toast.success(form.id ? 'Stage updated' : 'Stage added');
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save stage');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteStage = async (stageId: string) => {
    if (!confirm('Remove this stage? It will be deactivated, not hard-deleted.')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/crm/pipelines/stages?id=${stageId}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to remove stage');
      }
      setPipelines((prev) =>
        prev.map((p) =>
          p.id === selected?.id
            ? { ...p, crm_pipeline_stages: p.crm_pipeline_stages.filter((s) => s.id !== stageId) }
            : p,
        ),
      );
      toast.success('Stage removed');
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove stage');
    } finally {
      setBusy(false);
    }
  };

  const handleReorderStage = async (stageId: string, direction: 'up' | 'down') => {
    if (!selected) return;
    const stages = [...selected.crm_pipeline_stages];
    const idx = stages.findIndex((s) => s.id === stageId);
    if (idx === -1) return;
    const swapWith = direction === 'up' ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= stages.length) return;
    [stages[idx], stages[swapWith]] = [stages[swapWith], stages[idx]];
    const reorderPayload = stages.map((s, i) => ({ id: s.id, display_order: i + 1 }));

    // Optimistic update
    setPipelines((prev) =>
      prev.map((p) =>
        p.id === selected.id
          ? {
              ...p,
              crm_pipeline_stages: stages.map((s, i) => ({ ...s, display_order: i + 1 })),
            }
          : p,
      ),
    );

    setBusy(true);
    try {
      const res = await fetch('/api/crm/pipelines/stages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stages: reorderPayload }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to reorder');
      }
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reorder stage');
      // Revert on failure
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  // ---------- Render ----------

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
            <GitBranch className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Pipeline Management</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Pipelines, stages, win/loss flags, and probabilities.
            </p>
          </div>
        </div>
        <Button onClick={() => setPipelineDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New pipeline
        </Button>
      </div>

      {pipelines.length === 0 ? (
        <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-10 text-center">
          <GitBranch className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-700 dark:text-slate-300 font-medium">No pipelines yet</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">
            Create your first pipeline to start configuring stages.
          </p>
          <Button onClick={() => setPipelineDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New pipeline
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-6">
          {/* Pipeline list */}
          <div className="space-y-1.5">
            {pipelines.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                  selectedId === p.id
                    ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: p.color || '#6366f1' }}
                    />
                    <span className="font-medium text-sm text-slate-900 dark:text-white truncate">
                      {p.name}
                    </span>
                  </div>
                  {p.is_default && (
                    <Badge variant="secondary" className="text-[10px] flex-shrink-0">
                      <Star className="w-3 h-3 mr-1" />
                      Default
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 ml-4">
                  {p.pipeline_type} · {p.crm_pipeline_stages.length} stages
                </div>
              </button>
            ))}
          </div>

          {/* Selected pipeline */}
          <div>
            {selected ? (
              <PipelineDetail
                pipeline={selected}
                canDelete={canDelete}
                busy={busy}
                onUpdate={(updates) => handleUpdatePipeline(selected.id, updates)}
                onDelete={() => handleDeletePipeline(selected.id)}
                onAddStage={() => {
                  setEditingStage(null);
                  setStageDialogOpen(true);
                }}
                onEditStage={(stage) => {
                  setEditingStage(stage);
                  setStageDialogOpen(true);
                }}
                onDeleteStage={handleDeleteStage}
                onReorderStage={handleReorderStage}
              />
            ) : (
              <div className="text-sm text-slate-500 dark:text-slate-400 p-6">
                Select a pipeline on the left.
              </div>
            )}
          </div>
        </div>
      )}

      <CreatePipelineDialog
        open={pipelineDialogOpen}
        onOpenChange={setPipelineDialogOpen}
        busy={busy}
        onSubmit={handleCreatePipeline}
      />

      <StageDialog
        open={stageDialogOpen}
        onOpenChange={(o) => {
          setStageDialogOpen(o);
          if (!o) setEditingStage(null);
        }}
        busy={busy}
        stage={editingStage}
        onSubmit={handleSaveStage}
      />
    </div>
  );
}

// ============================================================================
// Pipeline detail panel
// ============================================================================

interface PipelineDetailProps {
  pipeline: PipelineWithStages;
  canDelete: boolean;
  busy: boolean;
  onUpdate: (updates: Partial<Pipeline>) => void;
  onDelete: () => void;
  onAddStage: () => void;
  onEditStage: (stage: PipelineStage) => void;
  onDeleteStage: (id: string) => void;
  onReorderStage: (id: string, dir: 'up' | 'down') => void;
}

function PipelineDetail({
  pipeline,
  canDelete,
  busy,
  onUpdate,
  onDelete,
  onAddStage,
  onEditStage,
  onDeleteStage,
  onReorderStage,
}: PipelineDetailProps) {
  const [name, setName] = useState(pipeline.name);
  const [description, setDescription] = useState(pipeline.description ?? '');

  const dirty = name !== pipeline.name || (description || '') !== (pipeline.description ?? '');

  return (
    <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-[1fr,auto] gap-3 items-end">
          <div className="space-y-2">
            <Label htmlFor="pipeline-name">Name</Label>
            <Input
              id="pipeline-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              disabled={!dirty || busy}
              onClick={() => onUpdate({ name, description: description || null })}
            >
              Save changes
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pipeline-desc">Description</Label>
          <Input
            id="pipeline-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this pipeline for?"
          />
        </div>
        <div className="flex items-center gap-3 pt-2">
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={pipeline.is_default}
              onChange={(e) => onUpdate({ is_default: e.target.checked })}
              className="rounded border-slate-300 dark:border-slate-600"
              disabled={busy}
            />
            Default pipeline
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={pipeline.is_active}
              onChange={(e) => onUpdate({ is_active: e.target.checked })}
              className="rounded border-slate-300 dark:border-slate-600"
              disabled={busy}
            />
            Active
          </label>
          {canDelete && !pipeline.is_default && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-500/10"
              onClick={onDelete}
              disabled={busy}
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Delete pipeline
            </Button>
          )}
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Stages</h2>
          <Button size="sm" variant="outline" onClick={onAddStage}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add stage
          </Button>
        </div>

        {pipeline.crm_pipeline_stages.length === 0 ? (
          <div className="text-sm text-slate-500 dark:text-slate-400 text-center py-6 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
            No stages yet. Add one to get started.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {pipeline.crm_pipeline_stages.map((stage, idx) => (
              <li
                key={stage.id}
                className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ background: stage.color || '#6366f1' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {stage.name}
                    </span>
                    {stage.is_won && (
                      <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                        <Trophy className="w-3 h-3 mr-1" />
                        Won
                      </Badge>
                    )}
                    {stage.is_lost && (
                      <Badge variant="secondary" className="text-[10px] bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400">
                        <XCircle className="w-3 h-3 mr-1" />
                        Lost
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {stage.probability ?? 0}% probability · key: {stage.key}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    disabled={idx === 0 || busy}
                    onClick={() => onReorderStage(stage.id, 'up')}
                    title="Move up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    disabled={idx === pipeline.crm_pipeline_stages.length - 1 || busy}
                    onClick={() => onReorderStage(stage.id, 'down')}
                    title="Move down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onEditStage(stage)}
                    disabled={busy}
                  >
                    Edit
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                    onClick={() => onDeleteStage(stage.id)}
                    disabled={busy}
                    title="Remove stage"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Create pipeline dialog
// ============================================================================

interface CreatePipelineDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  busy: boolean;
  onSubmit: (form: { name: string; pipeline_type: PipelineType; description: string }) => void;
}

function CreatePipelineDialog({ open, onOpenChange, busy, onSubmit }: CreatePipelineDialogProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<PipelineType>('standard');
  const [description, setDescription] = useState('');

  const reset = () => {
    setName('');
    setType('standard');
    setDescription('');
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New pipeline</DialogTitle>
          <DialogDescription>
            A pipeline is a set of stages that records move through.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="new-pipeline-name">Name</Label>
            <Input
              id="new-pipeline-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Lead intake, Enrollment, Renewal"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-pipeline-type">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as PipelineType)}>
              <SelectTrigger id="new-pipeline-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-pipeline-desc">Description (optional)</Label>
            <Input
              id="new-pipeline-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={() => onSubmit({ name: name.trim(), pipeline_type: type, description: description.trim() })}
            disabled={!name.trim() || busy}
          >
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Stage dialog (create + edit)
// ============================================================================

interface StageDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  busy: boolean;
  stage: PipelineStage | null;
  onSubmit: (form: {
    id?: string;
    name: string;
    color: string;
    probability: number;
    is_won: boolean;
    is_lost: boolean;
  }) => void;
}

function StageDialog({ open, onOpenChange, busy, stage, onSubmit }: StageDialogProps) {
  const [name, setName] = useState(stage?.name ?? '');
  const [color, setColor] = useState(stage?.color ?? STAGE_COLORS[0]);
  const [probability, setProbability] = useState(stage?.probability ?? 0);
  const [isWon, setIsWon] = useState(stage?.is_won ?? false);
  const [isLost, setIsLost] = useState(stage?.is_lost ?? false);

  // Reset form when the stage prop changes (open dialog with different stage)
  useStageEffect(stage, () => {
    setName(stage?.name ?? '');
    setColor(stage?.color ?? STAGE_COLORS[0]);
    setProbability(stage?.probability ?? 0);
    setIsWon(stage?.is_won ?? false);
    setIsLost(stage?.is_lost ?? false);
  });

  const isEdit = !!stage;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit stage' : 'Add stage'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="stage-name">Name</Label>
            <Input
              id="stage-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Qualified, Proposal sent, Closed won"
            />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {STAGE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    color === c ? 'border-slate-900 dark:border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ background: c }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="stage-prob">Win probability ({probability}%)</Label>
            <input
              id="stage-prob"
              type="range"
              min={0}
              max={100}
              step={5}
              value={probability}
              onChange={(e) => setProbability(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={isWon}
                onChange={(e) => {
                  setIsWon(e.target.checked);
                  if (e.target.checked) setIsLost(false);
                }}
                className="rounded border-slate-300 dark:border-slate-600"
              />
              <Trophy className="w-3.5 h-3.5 text-emerald-600" />
              Won stage
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={isLost}
                onChange={(e) => {
                  setIsLost(e.target.checked);
                  if (e.target.checked) setIsWon(false);
                }}
                className="rounded border-slate-300 dark:border-slate-600"
              />
              <XCircle className="w-3.5 h-3.5 text-red-600" />
              Lost stage
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onSubmit({
                id: stage?.id,
                name: name.trim(),
                color,
                probability,
                is_won: isWon,
                is_lost: isLost,
              })
            }
            disabled={!name.trim() || busy}
          >
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEdit ? 'Save' : 'Add stage'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Re-sync local form state when the `stage` prop changes (e.g. dialog reopened
// targeting a different stage). Tracks the stage id to avoid resetting on
// every render.
function useStageEffect(stage: PipelineStage | null, fn: () => void) {
  const ref = useRef<string | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    const key = stage?.id ?? null;
    if (ref.current !== key) {
      ref.current = key;
      fnRef.current();
    }
  }, [stage]);
}
