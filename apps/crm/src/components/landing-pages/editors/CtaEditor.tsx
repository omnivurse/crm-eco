'use client';

import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Textarea } from '@crm-eco/ui/components/textarea';
import type { CtaSectionData } from '@/lib/landing-pages/types';

interface CtaEditorProps {
  data: CtaSectionData;
  onChange: (data: CtaSectionData) => void;
}

export function CtaEditor({ data, onChange }: CtaEditorProps) {
  const update = (partial: Partial<CtaSectionData>) => onChange({ ...data, ...partial });

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Headline</Label>
        <Input value={data.headline} onChange={(e) => update({ headline: e.target.value })} />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Description</Label>
        <Textarea value={data.description} onChange={(e) => update({ description: e.target.value })} rows={2} />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Background Color</Label>
        <div className="flex gap-2">
          <Input type="color" value={data.backgroundColor || '#0d9488'} onChange={(e) => update({ backgroundColor: e.target.value })} className="w-10 h-9 p-1" />
          <Input value={data.backgroundColor || '#0d9488'} onChange={(e) => update({ backgroundColor: e.target.value })} className="flex-1" />
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-white/10 pt-3 space-y-3">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Primary Button</p>
        <div className="space-y-1.5">
          <Label className="text-xs">Text</Label>
          <Input value={data.primaryButtonText} onChange={(e) => update({ primaryButtonText: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Link</Label>
          <Input value={data.primaryButtonLink} onChange={(e) => update({ primaryButtonLink: e.target.value })} placeholder="#form" />
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-white/10 pt-3 space-y-3">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Secondary Button</p>
        <div className="space-y-1.5">
          <Label className="text-xs">Text</Label>
          <Input value={data.secondaryButtonText} onChange={(e) => update({ secondaryButtonText: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Link</Label>
          <Input value={data.secondaryButtonLink} onChange={(e) => update({ secondaryButtonLink: e.target.value })} placeholder="#features" />
        </div>
      </div>
    </div>
  );
}
