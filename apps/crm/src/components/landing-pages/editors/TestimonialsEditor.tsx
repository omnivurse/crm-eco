'use client';

import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Textarea } from '@crm-eco/ui/components/textarea';
import { Button } from '@crm-eco/ui/components/button';
import { Plus, Trash2 } from 'lucide-react';
import type { TestimonialsSectionData, Testimonial } from '@/lib/landing-pages/types';

interface TestimonialsEditorProps {
  data: TestimonialsSectionData;
  onChange: (data: TestimonialsSectionData) => void;
}

export function TestimonialsEditor({ data, onChange }: TestimonialsEditorProps) {
  const update = (partial: Partial<TestimonialsSectionData>) => onChange({ ...data, ...partial });

  const addItem = () => {
    const newItem: Testimonial = {
      id: crypto.randomUUID(),
      name: 'Name',
      role: 'Member',
      company: '',
      quote: 'Their quote here...',
      avatarUrl: '',
    };
    update({ items: [...(data.items || []), newItem] });
  };

  const updateItem = (id: string, updates: Partial<Testimonial>) => {
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
        <Label className="text-xs">Testimonials ({(data.items || []).length})</Label>
        {(data.items || []).map((item) => (
          <div key={item.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                value={item.name}
                onChange={(e) => updateItem(item.id, { name: e.target.value })}
                className="h-7 text-xs flex-1"
                placeholder="Name"
              />
              <button onClick={() => deleteItem(item.id)} className="text-slate-400 hover:text-red-500">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={item.role}
                onChange={(e) => updateItem(item.id, { role: e.target.value })}
                className="h-7 text-xs"
                placeholder="Role"
              />
              <Input
                value={item.company}
                onChange={(e) => updateItem(item.id, { company: e.target.value })}
                className="h-7 text-xs"
                placeholder="Company"
              />
            </div>
            <Textarea
              value={item.quote}
              onChange={(e) => updateItem(item.id, { quote: e.target.value })}
              className="text-xs"
              rows={2}
              placeholder="Quote"
            />
            <Input
              value={item.avatarUrl}
              onChange={(e) => updateItem(item.id, { avatarUrl: e.target.value })}
              className="h-7 text-xs"
              placeholder="Avatar URL (optional)"
            />
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addItem} className="w-full">
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add Testimonial
        </Button>
      </div>
    </div>
  );
}
