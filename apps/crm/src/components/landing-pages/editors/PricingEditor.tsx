'use client';

import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Textarea } from '@crm-eco/ui/components/textarea';
import { Button } from '@crm-eco/ui/components/button';
import { Switch } from '@crm-eco/ui/components/switch';
import { Plus, Trash2 } from 'lucide-react';
import type { PricingSectionData, PricingTier } from '@/lib/landing-pages/types';

interface PricingEditorProps {
  data: PricingSectionData;
  onChange: (data: PricingSectionData) => void;
}

export function PricingEditor({ data, onChange }: PricingEditorProps) {
  const update = (partial: Partial<PricingSectionData>) => onChange({ ...data, ...partial });

  const addTier = () => {
    const newTier: PricingTier = {
      id: crypto.randomUUID(),
      planName: 'New Plan',
      price: '$0',
      period: '/month',
      features: ['Feature 1'],
      ctaText: 'Get Started',
      highlighted: false,
    };
    update({ tiers: [...(data.tiers || []), newTier] });
  };

  const updateTier = (id: string, updates: Partial<PricingTier>) => {
    update({ tiers: (data.tiers || []).map((t) => (t.id === id ? { ...t, ...updates } : t)) });
  };

  const deleteTier = (id: string) => {
    update({ tiers: (data.tiers || []).filter((t) => t.id !== id) });
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

      <div className="space-y-2">
        <Label className="text-xs">Pricing Tiers ({(data.tiers || []).length})</Label>
        {(data.tiers || []).map((tier) => (
          <div key={tier.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                value={tier.planName}
                onChange={(e) => updateTier(tier.id, { planName: e.target.value })}
                className="h-7 text-xs flex-1"
                placeholder="Plan name"
              />
              <button onClick={() => deleteTier(tier.id)} className="text-slate-400 hover:text-red-500">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Input
                value={tier.price}
                onChange={(e) => updateTier(tier.id, { price: e.target.value })}
                className="h-7 text-xs"
                placeholder="$199"
              />
              <Input
                value={tier.period}
                onChange={(e) => updateTier(tier.id, { period: e.target.value })}
                className="h-7 text-xs"
                placeholder="/month"
              />
              <Input
                value={tier.ctaText}
                onChange={(e) => updateTier(tier.id, { ctaText: e.target.value })}
                className="h-7 text-xs"
                placeholder="CTA text"
              />
            </div>
            <div>
              <Label className="text-[10px]">Features (one per line)</Label>
              <Textarea
                value={(tier.features || []).join('\n')}
                onChange={(e) => updateTier(tier.id, { features: e.target.value.split('\n').filter(Boolean) })}
                className="text-xs"
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={tier.highlighted}
                onCheckedChange={(checked) => updateTier(tier.id, { highlighted: checked })}
              />
              <Label className="text-[10px]">Highlighted (Popular)</Label>
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addTier} className="w-full">
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add Tier
        </Button>
      </div>
    </div>
  );
}
