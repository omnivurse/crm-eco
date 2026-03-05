'use client';

import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Textarea } from '@crm-eco/ui/components/textarea';
import { Button } from '@crm-eco/ui/components/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { Plus, Trash2 } from 'lucide-react';
import type { FeaturesSectionData, FeatureItem } from '@/lib/landing-pages/types';

interface FeaturesEditorProps {
  data: FeaturesSectionData;
  onChange: (data: FeaturesSectionData) => void;
}

export function FeaturesEditor({ data, onChange }: FeaturesEditorProps) {
  const update = (partial: Partial<FeaturesSectionData>) => onChange({ ...data, ...partial });

  const addItem = () => {
    const newItem: FeatureItem = {
      id: crypto.randomUUID(),
      icon: 'star',
      title: 'New Feature',
      description: 'Description here',
    };
    update({ items: [...(data.items || []), newItem] });
  };

  const updateItem = (id: string, updates: Partial<FeatureItem>) => {
    update({ items: (data.items || []).map((i) => (i.id === id ? { ...i, ...updates } : i)) });
  };

  const deleteItem = (id: string) => {
    update({ items: (data.items || []).filter((i) => i.id !== id) });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Title</Label>
        <Input value={data.title} onChange={(e) => update({ title: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Subtitle</Label>
        <Input value={data.subtitle} onChange={(e) => update({ subtitle: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Columns</Label>
        <Select value={String(data.columns)} onValueChange={(v) => update({ columns: Number(v) as 2 | 3 | 4 })}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2">2 Columns</SelectItem>
            <SelectItem value="3">3 Columns</SelectItem>
            <SelectItem value="4">4 Columns</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Features ({(data.items || []).length})</Label>
        {(data.items || []).map((item) => (
          <div key={item.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <Input
                value={item.title}
                onChange={(e) => updateItem(item.id, { title: e.target.value })}
                className="h-7 text-xs flex-1 mr-2"
                placeholder="Feature title"
              />
              <button onClick={() => deleteItem(item.id)} className="text-slate-400 hover:text-red-500">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Textarea
                  value={item.description}
                  onChange={(e) => updateItem(item.id, { description: e.target.value })}
                  className="text-xs"
                  rows={2}
                  placeholder="Description"
                />
              </div>
              <div>
                <Select value={item.icon} onValueChange={(v) => updateItem(item.id, { icon: v })}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="heart">Heart</SelectItem>
                    <SelectItem value="shield">Shield</SelectItem>
                    <SelectItem value="dollar-sign">Dollar</SelectItem>
                    <SelectItem value="star">Star</SelectItem>
                    <SelectItem value="zap">Zap</SelectItem>
                    <SelectItem value="users">Users</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addItem} className="w-full">
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add Feature
        </Button>
      </div>
    </div>
  );
}
