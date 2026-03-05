'use client';

import { useState } from 'react';
import { cn } from '@crm-eco/ui/lib/utils';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Textarea } from '@crm-eco/ui/components/textarea';
import { Button } from '@crm-eco/ui/components/button';
import { Switch } from '@crm-eco/ui/components/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import type { FormSectionData, FormField, FormFieldType, FormTemplate } from '@/lib/landing-pages/types';
import { FORM_TEMPLATES } from '@/lib/landing-pages/types';

// ── Sortable Form Field ────────────────────────────────────────
function SortableField({
  field,
  onUpdate,
  onDelete,
}: {
  field: FormField;
  onUpdate: (updates: Partial<FormField>) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });

  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 transition-all',
        isDragging && 'opacity-50',
      )}
    >
      <div className="flex items-center gap-2 px-2 py-1.5">
        <button className="cursor-grab active:cursor-grabbing text-slate-400" {...attributes} {...listeners}>
          <GripVertical className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => setExpanded(!expanded)} className="text-slate-400">
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
        <span className="flex-1 text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
          {field.label || 'Untitled Field'}
        </span>
        <span className="text-[10px] text-slate-400 uppercase">{field.type}</span>
        <button onClick={onDelete} className="text-slate-400 hover:text-red-500">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-2 border-t border-slate-100 dark:border-slate-700">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Label</Label>
              <Input
                value={field.label}
                onChange={(e) => onUpdate({ label: e.target.value })}
                className="h-7 text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px]">Type</Label>
              <Select value={field.type} onValueChange={(v) => onUpdate({ type: v as FormFieldType })}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="textarea">Textarea</SelectItem>
                  <SelectItem value="select">Dropdown</SelectItem>
                  <SelectItem value="checkbox">Checkbox</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-[10px]">Placeholder</Label>
            <Input
              value={field.placeholder}
              onChange={(e) => onUpdate({ placeholder: e.target.value })}
              className="h-7 text-xs"
            />
          </div>
          {field.type === 'select' && (
            <div>
              <Label className="text-[10px]">Options (one per line)</Label>
              <Textarea
                value={(field.options || []).join('\n')}
                onChange={(e) => onUpdate({ options: e.target.value.split('\n').filter(Boolean) })}
                className="text-xs"
                rows={3}
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <Switch
              checked={field.required}
              onCheckedChange={(checked) => onUpdate({ required: checked })}
            />
            <Label className="text-[10px]">Required</Label>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Form Editor ───────────────────────────────────────────
interface FormEditorProps {
  data: FormSectionData;
  onChange: (data: FormSectionData) => void;
}

export function FormEditor({ data, onChange }: FormEditorProps) {
  const update = (partial: Partial<FormSectionData>) => onChange({ ...data, ...partial });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = data.fields.findIndex((f) => f.id === active.id);
    const newIndex = data.fields.findIndex((f) => f.id === over.id);
    update({ fields: arrayMove(data.fields, oldIndex, newIndex) });
  };

  const addField = () => {
    const newField: FormField = {
      id: crypto.randomUUID(),
      type: 'text',
      label: 'New Field',
      placeholder: '',
      required: false,
    };
    update({ fields: [...data.fields, newField] });
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    update({
      fields: data.fields.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    });
  };

  const deleteField = (id: string) => {
    update({ fields: data.fields.filter((f) => f.id !== id) });
  };

  const applyTemplate = (template: FormTemplate) => {
    update({
      title: template.name,
      fields: template.fields.map((f) => ({ ...f, id: crypto.randomUUID() })),
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Form Title</Label>
        <Input
          value={data.title}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="Request a Quote"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Description</Label>
        <Textarea
          value={data.description}
          onChange={(e) => update({ description: e.target.value })}
          placeholder="Brief description..."
          rows={2}
        />
      </div>

      {/* Templates */}
      <div className="space-y-1.5">
        <Label className="text-xs">Quick Templates</Label>
        <div className="flex flex-wrap gap-1.5">
          {FORM_TEMPLATES.map((t) => (
            <button
              key={t.name}
              onClick={() => applyTemplate(t)}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            >
              <FileText className="w-3 h-3" />
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-1.5">
        <Label className="text-xs">Form Fields ({data.fields.length})</Label>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={data.fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1.5">
              {data.fields.map((field) => (
                <SortableField
                  key={field.id}
                  field={field}
                  onUpdate={(updates) => updateField(field.id, updates)}
                  onDelete={() => deleteField(field.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <Button variant="outline" size="sm" onClick={addField} className="w-full mt-2">
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add Field
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Submit Button Text</Label>
        <Input
          value={data.submitButtonText}
          onChange={(e) => update({ submitButtonText: e.target.value })}
          placeholder="Submit"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Success Message</Label>
        <Textarea
          value={data.successMessage}
          onChange={(e) => update({ successMessage: e.target.value })}
          placeholder="Thank you!"
          rows={2}
        />
      </div>
    </div>
  );
}
