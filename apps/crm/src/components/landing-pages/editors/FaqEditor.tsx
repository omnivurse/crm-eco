'use client';

import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Textarea } from '@crm-eco/ui/components/textarea';
import { Button } from '@crm-eco/ui/components/button';
import { Plus, Trash2 } from 'lucide-react';
import type { FaqSectionData, FaqItem } from '@/lib/landing-pages/types';

interface FaqEditorProps {
  data: FaqSectionData;
  onChange: (data: FaqSectionData) => void;
}

export function FaqEditor({ data, onChange }: FaqEditorProps) {
  const update = (partial: Partial<FaqSectionData>) => onChange({ ...data, ...partial });

  const addItem = () => {
    const newItem: FaqItem = {
      id: crypto.randomUUID(),
      question: 'New Question',
      answer: 'Answer here...',
    };
    update({ items: [...(data.items || []), newItem] });
  };

  const updateItem = (id: string, updates: Partial<FaqItem>) => {
    update({ items: (data.items || []).map((i) => (i.id === id ? { ...i, ...updates } : i)) });
  };

  const deleteItem = (id: string) => {
    update({ items: (data.items || []).filter((i) => i.id !== id) });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Section Title</Label>
        <Input value={data.title} onChange={(e) => update({ title: e.target.value })} />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Questions ({(data.items || []).length})</Label>
        {(data.items || []).map((item) => (
          <div key={item.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                value={item.question}
                onChange={(e) => updateItem(item.id, { question: e.target.value })}
                className="h-7 text-xs flex-1"
                placeholder="Question"
              />
              <button onClick={() => deleteItem(item.id)} className="text-slate-400 hover:text-red-500">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <Textarea
              value={item.answer}
              onChange={(e) => updateItem(item.id, { answer: e.target.value })}
              className="text-xs"
              rows={2}
              placeholder="Answer"
            />
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addItem} className="w-full">
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add Question
        </Button>
      </div>
    </div>
  );
}
