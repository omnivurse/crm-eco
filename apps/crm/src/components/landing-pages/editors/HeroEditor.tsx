'use client';

import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Textarea } from '@crm-eco/ui/components/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import type { HeroSectionData } from '@/lib/landing-pages/types';

interface HeroEditorProps {
  data: HeroSectionData;
  onChange: (data: HeroSectionData) => void;
}

export function HeroEditor({ data, onChange }: HeroEditorProps) {
  const update = (partial: Partial<HeroSectionData>) => onChange({ ...data, ...partial });

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Headline</Label>
        <Input
          value={data.headline}
          onChange={(e) => update({ headline: e.target.value })}
          placeholder="Main headline"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Subheadline</Label>
        <Textarea
          value={data.subheadline}
          onChange={(e) => update({ subheadline: e.target.value })}
          placeholder="Supporting text"
          rows={2}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Layout</Label>
        <Select value={data.layout} onValueChange={(v) => update({ layout: v as any })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="centered">Centered</SelectItem>
            <SelectItem value="left-aligned">Left Aligned</SelectItem>
            <SelectItem value="split">Split</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Background Color</Label>
        <div className="flex gap-2">
          <Input
            type="color"
            value={data.backgroundColor || '#0d9488'}
            onChange={(e) => update({ backgroundColor: e.target.value })}
            className="w-10 h-9 p-1"
          />
          <Input
            value={data.backgroundColor || '#0d9488'}
            onChange={(e) => update({ backgroundColor: e.target.value })}
            className="flex-1"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Background Image URL</Label>
        <Input
          value={data.backgroundImageUrl}
          onChange={(e) => update({ backgroundImageUrl: e.target.value })}
          placeholder="https://..."
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">CTA Button Text</Label>
        <Input
          value={data.ctaText}
          onChange={(e) => update({ ctaText: e.target.value })}
          placeholder="Get Started"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">CTA Button Link</Label>
        <Input
          value={data.ctaLink}
          onChange={(e) => update({ ctaLink: e.target.value })}
          placeholder="#form"
        />
      </div>
    </div>
  );
}
