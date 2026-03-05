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
import type { ContentSectionData } from '@/lib/landing-pages/types';

interface ContentEditorProps {
  data: ContentSectionData;
  onChange: (data: ContentSectionData) => void;
}

export function ContentEditor({ data, onChange }: ContentEditorProps) {
  const update = (partial: Partial<ContentSectionData>) => onChange({ ...data, ...partial });

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Heading</Label>
        <Input
          value={data.heading}
          onChange={(e) => update({ heading: e.target.value })}
          placeholder="Section heading"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Body Content (HTML)</Label>
        <Textarea
          value={data.bodyHtml}
          onChange={(e) => update({ bodyHtml: e.target.value })}
          placeholder="<p>Your content here...</p>"
          rows={6}
          className="font-mono text-xs"
        />
        <p className="text-[10px] text-slate-400">Supports HTML formatting</p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Image URL</Label>
        <Input
          value={data.imageUrl}
          onChange={(e) => update({ imageUrl: e.target.value })}
          placeholder="https://..."
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Image Position</Label>
        <Select value={data.imagePosition} onValueChange={(v) => update({ imagePosition: v as any })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Image</SelectItem>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="right">Right</SelectItem>
            <SelectItem value="background">Background</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
