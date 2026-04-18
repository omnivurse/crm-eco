'use client';

/**
 * NoteTemplatePicker — modal launched from the V2 header "Note Template"
 * split button. Lists the built-in templates from
 * `@/lib/crm/note-templates` plus a "Blank note" escape hatch.
 *
 * Behaviour:
 *   - Selecting a template renders it with the record's context (name,
 *     email, phone, owner), then calls `onApply(renderedBody, template)`.
 *   - The caller is responsible for opening the note editor with the
 *     prefilled body.
 *   - Selecting "Blank note" calls `onApply('', null)` so the editor opens
 *     empty.
 *
 * Future: when `crm_note_templates` ships, swap the default catalog for a
 * SWR hook that merges org-level templates on top of the defaults.
 */

import { useMemo, useState } from 'react';
import { FileText, StickyNote, Phone, Users, CalendarDays, Search, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@crm-eco/ui/components/dialog';
import { Input } from '@crm-eco/ui/components/input';
import { Button } from '@crm-eco/ui/components/button';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  DEFAULT_NOTE_TEMPLATES,
  renderNoteTemplate,
  type CrmNoteTemplate,
  type NoteTemplateContext,
} from '@/lib/crm/note-templates';

const CATEGORY_META: Record<NonNullable<CrmNoteTemplate['category']>, { label: string; Icon: typeof Phone }> = {
  call: { label: 'Calls', Icon: Phone },
  meeting: { label: 'Meetings', Icon: CalendarDays },
  followup: { label: 'Follow-up', Icon: Users },
  general: { label: 'General', Icon: FileText },
};

export interface NoteTemplatePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: NoteTemplateContext;
  /**
   * Fires with the fully-rendered body string and (if a template was
   * chosen) the template metadata. `null` template indicates the user
   * chose "Blank note".
   */
  onApply: (body: string, template: CrmNoteTemplate | null) => void;
}

export function NoteTemplatePicker({
  open,
  onOpenChange,
  context,
  onApply,
}: NoteTemplatePickerProps) {
  const [query, setQuery] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(
    DEFAULT_NOTE_TEMPLATES[0]?.id ?? null,
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DEFAULT_NOTE_TEMPLATES;
    return DEFAULT_NOTE_TEMPLATES.filter(
      (t) =>
        t.label.toLowerCase().includes(q) ||
        (t.description?.toLowerCase().includes(q) ?? false) ||
        t.body.toLowerCase().includes(q),
    );
  }, [query]);

  const grouped = useMemo(() => {
    const acc: Record<string, CrmNoteTemplate[]> = {};
    for (const t of filtered) {
      const key = t.category ?? 'general';
      if (!acc[key]) acc[key] = [];
      acc[key].push(t);
    }
    return acc;
  }, [filtered]);

  const preview = useMemo(() => {
    const t = DEFAULT_NOTE_TEMPLATES.find((x) => x.id === previewId);
    if (!t) return null;
    return { template: t, body: renderNoteTemplate(t, context) };
  }, [previewId, context]);

  const apply = () => {
    if (!preview) return;
    onApply(preview.body, preview.template);
    onOpenChange(false);
  };

  const applyBlank = () => {
    onApply('', null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden p-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-slate-100 dark:border-white/5">
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <StickyNote className="w-5 h-5 text-teal-600" />
            Pick a note template
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Merge fields like {'{{name}}'} are filled from this record automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 max-h-[60vh]">
          {/* Left column: searchable list */}
          <div className="border-r border-slate-100 dark:border-white/5 flex flex-col min-h-0">
            <div className="p-3 border-b border-slate-100 dark:border-white/5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search templates"
                  className="h-8 pl-7 text-xs"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-3">
              {Object.entries(grouped).length === 0 ? (
                <p className="p-4 text-xs text-slate-500 text-center">
                  No templates match &ldquo;{query}&rdquo;.
                </p>
              ) : (
                Object.entries(grouped).map(([cat, list]) => {
                  const meta = CATEGORY_META[cat as keyof typeof CATEGORY_META] ?? CATEGORY_META.general;
                  const Icon = meta.Icon;
                  return (
                    <div key={cat}>
                      <div className="flex items-center gap-1.5 px-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        <Icon className="w-3 h-3" />
                        {meta.label}
                      </div>
                      <ul className="space-y-0.5">
                        {list.map((t) => {
                          const isActive = t.id === previewId;
                          return (
                            <li key={t.id}>
                              <button
                                type="button"
                                onClick={() => setPreviewId(t.id)}
                                className={cn(
                                  'w-full text-left px-2.5 py-1.5 rounded-md transition-colors group',
                                  isActive
                                    ? 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300'
                                    : 'hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300',
                                )}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-medium truncate">{t.label}</span>
                                  {isActive && <Check className="w-3.5 h-3.5 shrink-0" />}
                                </div>
                                {t.description && (
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                    {t.description}
                                  </p>
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right column: preview */}
          <div className="flex flex-col min-h-0">
            <div className="px-4 py-2.5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Preview
              </span>
              {preview && (
                <span className="text-[10px] text-slate-400">{preview.template.label}</span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap font-sans">
              {preview?.body || 'Select a template to preview.'}
            </div>
            <div className="p-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-900/40">
              <Button variant="ghost" size="sm" onClick={applyBlank}>
                Blank note
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={apply}
                  disabled={!preview}
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                >
                  Use template
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
