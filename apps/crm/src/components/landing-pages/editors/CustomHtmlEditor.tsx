'use client';

import { Label } from '@crm-eco/ui/components/label';
import { Textarea } from '@crm-eco/ui/components/textarea';
import type { CustomHtmlSectionData } from '@/lib/landing-pages/types';

interface CustomHtmlEditorProps {
  data: CustomHtmlSectionData;
  onChange: (data: CustomHtmlSectionData) => void;
}

export function CustomHtmlEditor({ data, onChange }: CustomHtmlEditorProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">HTML Content</Label>
        <Textarea
          value={data.html}
          onChange={(e) => onChange({ html: e.target.value })}
          placeholder="<div>Your HTML here</div>"
          rows={12}
          className="font-mono text-xs"
        />
        <p className="text-[10px] text-slate-400">
          Enter raw HTML. Content is rendered as-is in the page.
        </p>
      </div>
    </div>
  );
}
